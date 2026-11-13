// Accepting without a portal (2026-11-11). Clients see and accept estimates
// (/e) and sign proposals (/p) without logging in. What happens next depends
// on whether they already have a portal login:
//
//   • They do: the invoice goes straight into their portal (invoiceForEstimate),
//     as before.
//   • They don't: nothing is created yet. The estimate stays "accepted" with no
//     invoice, which puts it on Home → "Accepted — set up their portal". One
//     click there (setUpFromEstimate) makes their login, the project and the
//     invoice, and sends one "your portal is ready" email that points at it.
//
// A signed proposal's deposit is read back from the proposal at setup time.

import type { SupabaseClient } from '@supabase/supabase-js';
import { invoiceForEstimate } from './estimateInvoice';
import { sendPortalInvite } from './portalSetup';
import { formatLineMoney, hasRange, isPhased, type LineItem } from './lineItems';

type Est = { id: string; portal_client_id: string | null; crm_contact_id: string | null; sent_to: string | null };

/** The portal login this estimate's client already has, if any. */
export async function existingPortalFor(db: SupabaseClient, est: Est): Promise<string | null> {
  if (est.portal_client_id) return est.portal_client_id;
  if (est.crm_contact_id) {
    const { data } = await db.from('crm_contacts').select('portal_client_id').eq('id', est.crm_contact_id).maybeSingle();
    if (data?.portal_client_id) return data.portal_client_id;
  }
  const email = (est.sent_to ?? '').trim().toLowerCase();
  if (email) {
    const { data } = await db.from('crm_contacts').select('portal_client_id').ilike('email', email).not('portal_client_id', 'is', null).limit(1).maybeSingle();
    if (data?.portal_client_id) return data.portal_client_id;
  }
  return null;
}

/** After an accept or a signature: invoice now if they have a portal, else wait for Lauren. */
export async function afterAccept(db: SupabaseClient, estimateId: string, opts: { depositPercent?: number } = {}) {
  const { data: est } = await db.from('estimates').select('id, portal_client_id, crm_contact_id, sent_to, invoice_id').eq('id', estimateId).maybeSingle();
  if (!est) return { invoiceReady: false, needsSetup: false, error: 'Estimate not found' };
  if (!est.invoice_id && !(await existingPortalFor(db, est))) return { invoiceReady: false, needsSetup: true };
  const inv = await invoiceForEstimate(db, estimateId, opts);
  return inv.ok ? { invoiceReady: true, needsSetup: false } : { invoiceReady: false, needsSetup: false, error: inv.error };
}

async function depositFor(db: SupabaseClient, estimateId: string): Promise<number | undefined> {
  const { data } = await db.from('proposals').select('deposit_percent, status').eq('estimate_id', estimateId).eq('status', 'signed').limit(1).maybeSingle();
  return data?.deposit_percent ? Number(data.deposit_percent) : undefined;
}

export type AcceptedWaiting = {
  estimate_id: string; estimate_number: string; title: string | null; client_name: string | null;
  total_cents: number; accepted_at: string; accepted_by: string | null; contact_id: string | null;
  email: string | null; from_proposal: boolean;
};

/** Accepted estimates and signed proposals still waiting for a portal. */
export async function acceptedWaiting(db: SupabaseClient): Promise<AcceptedWaiting[]> {
  const res = await db.from('estimates')
    .select('id, estimate_number, title, client_name, total_cents, accepted_at, accepted_by, crm_contact_id, sent_to, portal_client_id, invoice_id, status, line_items')
    .not('accepted_at', 'is', null).is('invoice_id', null).neq('status', 'declined')
    .order('accepted_at', { ascending: false }).limit(50);
  if (res.error || !res.data) return [];
  // Approved phases (migration 062) wait on Lauren's phase estimate instead, not a portal.
  // …and so does a price range (migration 063), which waits on the final estimate.
  const data = res.data.filter((e) => !isPhased((e.line_items ?? []) as LineItem[]) && !hasRange((e.line_items ?? []) as LineItem[]));
  const ids = data.map((e) => e.id);
  const { data: props } = ids.length
    ? await db.from('proposals').select('estimate_id').in('estimate_id', ids).eq('status', 'signed')
    : { data: [] as { estimate_id: string }[] };
  const signed = new Set((props ?? []).map((p) => p.estimate_id));
  return data.map((e) => ({
    estimate_id: e.id, estimate_number: e.estimate_number, title: e.title, client_name: e.client_name,
    total_cents: e.total_cents, accepted_at: e.accepted_at, accepted_by: e.accepted_by,
    contact_id: e.crm_contact_id, email: e.sent_to, from_proposal: signed.has(e.id),
  }));
}

/** Lauren's one click: login + project + invoice, then one email that says where it is. */
export async function setUpFromEstimate(db: SupabaseClient, estimateId: string, note?: string | null) {
  const { data: est } = await db.from('estimates').select('id, title, estimate_number, total_cents, accepted_at').eq('id', estimateId).maybeSingle();
  if (!est) return { ok: false as const, error: 'Estimate not found' };
  if (!est.accepted_at) return { ok: false as const, error: 'This estimate hasn’t been accepted yet' };
  const depositPercent = await depositFor(db, estimateId);
  const inv = await invoiceForEstimate(db, estimateId, { depositPercent, notify: false });
  if (!inv.ok) return { ok: false as const, error: inv.error };
  const { data: invoice } = await db.from('portal_invoices').select('invoice_number, amount_cents, deposit_cents').eq('id', inv.invoiceId).maybeSingle();
  const due = invoice?.deposit_cents ? `a ${formatLineMoney(invoice.deposit_cents)} deposit to get started` : formatLineMoney(invoice?.amount_cents ?? est.total_cents);
  const invoiceLine = `Your invoice${invoice?.invoice_number ? ` (${invoice.invoice_number})` : ''} is waiting under Invoices — ${due}.`;
  const invite = await sendPortalInvite(db, inv.portalId, {
    projectName: est.title,
    note: [invoiceLine, note?.trim()].filter(Boolean).join('\n\n'),
  });
  return { ok: true as const, portalId: inv.portalId, invoiceId: inv.invoiceId, invited: invite.ok, inviteError: invite.ok ? null : invite.error };
}
