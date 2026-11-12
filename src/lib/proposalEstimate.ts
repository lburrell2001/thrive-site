// Every proposal has an estimate (migration 050). The proposal's pricing is
// the source: this builds the estimate from it, or rebuilds the linked one,
// so the two always match. Called after each builder save, on create and on
// publish. The estimate's status follows the proposal's (a database trigger).
//
// Left alone: an estimate already turned into an invoice, and the estimate of
// a signed proposal (what was agreed shouldn't move).

import type { SupabaseClient } from '@supabase/supabase-js';
import { proposalToEstimateLines, type ProposalLine } from './proposalBilling';
import { nextEstimateNumber } from './estimates';
import { totalCents, type LineItem } from './lineItems';

export type LinkedEstimate = { id: string; estimate_number: string; status: string; total_cents: number };

type Result = { ok: true; estimate: LinkedEstimate | null } | { ok: false; error: string };

export async function syncProposalEstimate(db: SupabaseClient, proposalId: string): Promise<Result> {
  const { data: proposal, error } = await db.from('proposals')
    .select('id, title, status, proposal_date, valid_until, client_id, crm_deal_id, estimate_id')
    .eq('id', proposalId).maybeSingle();
  if (error) return { ok: false, error: /estimate_id/.test(error.message) ? 'Run migration 050 in Supabase to link estimates to proposals.' : error.message };
  if (!proposal) return { ok: false, error: 'Proposal not found' };

  const [{ data: items }, { data: client }, { data: pricing }, current] = await Promise.all([
    db.from('proposal_line_items').select('*').eq('proposal_id', proposalId),
    proposal.client_id
      ? db.from('proposal_clients').select('name, company, portal_client_id, crm_contact_id').eq('id', proposal.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('proposal_blocks').select('content').eq('proposal_id', proposalId).eq('type', 'pricing').limit(1).maybeSingle(),
    proposal.estimate_id
      ? db.from('estimates').select('id, estimate_number, status, total_cents, line_items').eq('id', proposal.estimate_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const existing = current.data as (LinkedEstimate & { line_items: LineItem[] }) | null;
  const summary = (e: LinkedEstimate | null) => (e ? { id: e.id, estimate_number: e.estimate_number, status: e.status, total_cents: e.total_cents } : null);

  // What was agreed, or already billed, stays as it is.
  if (existing && (existing.status === 'invoiced' || proposal.status === 'signed')) return { ok: true, estimate: summary(existing) };

  const lines = proposalToEstimateLines(((items ?? []) as ProposalLine[]).map((i) => ({ ...i, quantity: Number(i.quantity) })), existing?.line_items ?? []);
  // Nothing priced yet: nothing to estimate (an estimate needs a line).
  if (!lines.length) return { ok: true, estimate: summary(existing) };

  const showPrices = !!(pricing?.content as { showLineItemPrices?: boolean } | null)?.showLineItemPrices;
  const row = {
    title: proposal.title,
    client_name: client?.company || client?.name || '',
    portal_client_id: client?.portal_client_id ?? null,
    crm_contact_id: client?.portal_client_id ? null : client?.crm_contact_id ?? null,
    line_items: lines,
    total_cents: totalCents(lines),
    issue_date: proposal.proposal_date,
    valid_until: proposal.valid_until,
    // The client sees what the proposal shows: every price, or the totals.
    totals_only: !showPrices,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error: upErr } = await db.from('estimates').update(row).eq('id', existing.id)
      .select('id, estimate_number, status, total_cents').single();
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true, estimate: data as LinkedEstimate };
  }

  const status = proposal.status === 'signed' ? 'accepted'
    : proposal.status === 'declined' ? 'declined'
    : proposal.status === 'sent' || proposal.status === 'viewed' ? 'sent' : 'draft';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error: insErr } = await db.from('estimates').insert({
      ...row, estimate_number: await nextEstimateNumber(db), status,
      ...(proposal.crm_deal_id ? { crm_deal_id: proposal.crm_deal_id } : {}),
    }).select('id, estimate_number, status, total_cents').single();
    if (insErr?.code === '23505') continue;
    if (insErr) return { ok: false, error: insErr.message };
    const { error: linkErr } = await db.from('proposals').update({ estimate_id: data.id }).eq('id', proposalId);
    if (linkErr) return { ok: false, error: linkErr.message };
    return { ok: true, estimate: data as LinkedEstimate };
  }
  return { ok: false, error: 'Could not number the estimate. Try again.' };
}
