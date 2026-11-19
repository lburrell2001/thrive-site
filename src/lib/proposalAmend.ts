// Amending a sent proposal (migration 068). The version the client has is
// kept in proposal_versions before anything changes; the proposal's revision
// goes up, and the next publish (Send, or Copy the client link) puts it in
// front of them as the updated proposal.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadProposalById } from './proposalRepo';
import type { Proposal } from '@/types/proposal';

export type VersionRow = {
  id: string; revision: number; title: string; total_cents: number;
  status: string; sent_at: string | null; created_at: string;
};

export type AmendState = { revision: number; sentRevision: number; amendedAt: string | null; versions: VersionRow[] };

const NEEDS_068 = 'Run migration 068 in Supabase first (proposal amendments).';

export async function amendState(db: SupabaseClient, proposalId: string): Promise<AmendState | { error: string }> {
  const { data: p, error } = await db.from('proposals').select('revision, sent_revision, amended_at').eq('id', proposalId).maybeSingle();
  if (error) return { error: /revision/.test(error.message) ? NEEDS_068 : error.message };
  if (!p) return { error: 'Proposal not found' };
  const { data: versions } = await db.from('proposal_versions')
    .select('id, revision, title, total_cents, status, sent_at, created_at')
    .eq('proposal_id', proposalId).order('revision', { ascending: false });
  return { revision: p.revision, sentRevision: p.sent_revision, amendedAt: p.amended_at, versions: (versions ?? []) as VersionRow[] };
}

/** Keep the version the client has, and open the next revision for editing. */
export async function amendProposal(db: SupabaseClient, proposalId: string): Promise<{ ok: true; revision: number } | { ok: false; error: string; status?: number }> {
  const { data: found, error: rowErr } = await db.from('proposals').select('*').eq('id', proposalId).maybeSingle();
  if (rowErr) return { ok: false, error: rowErr.message };
  if (!found) return { ok: false, error: 'Proposal not found', status: 404 };
  const row = found as Proposal & { revision?: number; sent_revision?: number };
  if (row.revision == null) return { ok: false, error: NEEDS_068 };
  if (row.status === 'draft') return { ok: false, error: 'It hasn’t been sent yet. Just edit it.' };
  if (row.status === 'signed') return { ok: false, error: 'It’s signed: the signature and invoice belong to that version. Duplicate it for the new scope instead.' };
  // Already amending (changes not sent yet): nothing new to keep.
  if (row.revision > (row.sent_revision ?? 1)) return { ok: true, revision: row.revision };

  const r = await loadProposalById(db, proposalId);
  if (!r) return { ok: false, error: 'Proposal not found', status: 404 };
  const { data: estimate } = row.estimate_id
    ? await db.from('estimates').select('*').eq('id', row.estimate_id).maybeSingle()
    : { data: null };
  if (estimate) delete (estimate as Record<string, unknown>).access_token;

  const { error: insErr } = await db.from('proposal_versions').insert({
    proposal_id: proposalId,
    revision: row.revision,
    title: r.title,
    total_cents: r.totalCents,
    status: row.status,
    sent_at: row.sent_at,
    snapshot: {
      title: r.title, proposalDate: r.proposalDate, validUntil: r.validUntil, currency: r.currency,
      totalCents: r.totalCents, depositPercent: r.depositPercent, theme: r.theme,
      blocks: r.blocks, lineItems: r.lineItems,
    },
    estimate,
  });
  // A double click: the snapshot is already there.
  if (insErr && !/duplicate|unique/i.test(insErr.message)) return { ok: false, error: insErr.message };

  const next = row.revision + 1;
  const { error: upErr } = await db.from('proposals')
    .update({ revision: next, amended_at: new Date().toISOString() })
    .eq('id', proposalId).eq('revision', row.revision);
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, revision: next };
}

/** The version the client had before this one, for "was $X". */
export async function previousVersion(db: SupabaseClient, proposalId: string, revision: number) {
  const { data } = await db.from('proposal_versions')
    .select('revision, total_cents, sent_at').eq('proposal_id', proposalId).lt('revision', revision)
    .order('revision', { ascending: false }).limit(1).maybeSingle();
  return data as { revision: number; total_cents: number; sent_at: string | null } | null;
}
