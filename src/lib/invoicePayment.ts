// Marks a portal invoice paid from a Stripe Checkout session — shared by the
// webhook and the portal's return-page confirm. Nothing on the session is
// trusted except what Stripe itself reports: the invoice must exist, belong to
// the client the session was opened for, and the amount Stripe collected must
// match the invoice to the cent.

import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PaidResult =
  | { ok: true; invoiceId: string }
  | { ok: false; reason: string };

export async function markInvoicePaid(db: SupabaseClient, session: Stripe.Checkout.Session): Promise<PaidResult> {
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not paid' };
  const invoiceId = session.metadata?.invoiceId;
  const clientId = session.metadata?.clientId;
  if (!invoiceId || !clientId) return { ok: false, reason: 'missing invoice reference' };

  const { data: invoice } = await db
    .from('portal_invoices')
    .select('id, client_id, amount_cents, status')
    .eq('id', invoiceId)
    .single();
  if (!invoice || invoice.client_id !== clientId) return { ok: false, reason: 'invoice not found' };
  if ((session.currency ?? '').toLowerCase() !== 'usd' || session.amount_total !== invoice.amount_cents) {
    console.error('[stripe] amount mismatch', { invoiceId, expected: invoice.amount_cents, got: session.amount_total, currency: session.currency });
    return { ok: false, reason: 'amount mismatch' };
  }
  if (invoice.status === 'paid') return { ok: true, invoiceId };

  const { error } = await db
    .from('portal_invoices')
    .update({ status: 'paid', stripe_checkout_session_id: session.id })
    .eq('id', invoiceId);
  if (error) {
    console.error('[stripe] could not mark invoice paid', invoiceId, error.message);
    return { ok: false, reason: 'update failed' };
  }
  return { ok: true, invoiceId };
}
