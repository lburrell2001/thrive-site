// Marks a portal invoice paid from a Stripe Checkout session — shared by the
// webhook and the portal's return-page confirm. Nothing on the session is
// trusted except what Stripe itself reports: the invoice must exist, belong to
// the client the session was opened for, and the amount Stripe collected must
// match the part being paid (the whole invoice, its deposit or its balance) to the cent.

import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dueNow, type DepositFields, type PayPart } from './invoiceDeposit';

export type PaidResult =
  | { ok: true; invoiceId: string }
  | { ok: false; reason: string };

/**
 * The session pays one part (metadata.part): the whole invoice, its deposit,
 * or its balance. Older sessions have no part and mean the whole invoice.
 * The amount must match what that part is due right now, to the cent.
 */
export async function markInvoicePaid(db: SupabaseClient, session: Stripe.Checkout.Session): Promise<PaidResult> {
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not paid' };
  const invoiceId = session.metadata?.invoiceId;
  const clientId = session.metadata?.clientId;
  const part = (session.metadata?.part ?? 'full') as PayPart;
  if (!invoiceId || !clientId) return { ok: false, reason: 'missing invoice reference' };

  const pick = (cols: string) => db.from('portal_invoices').select(cols).eq('id', invoiceId).single();
  let found = await pick('id, client_id, amount_cents, status, due_date, deposit_cents, deposit_due_date, deposit_paid_at, deposit_session_id, balance_open');
  if (found.error) found = await pick('id, client_id, amount_cents, status, due_date');
  const invoice = found.data as unknown as (DepositFields & { id: string; client_id: string; deposit_session_id?: string | null }) | null;
  if (!invoice || invoice.client_id !== clientId) return { ok: false, reason: 'invoice not found' };

  // Already settled by this same session (webhook and confirm both arrive).
  if (part === 'deposit' && invoice.deposit_paid_at && invoice.deposit_session_id === session.id) return { ok: true, invoiceId };
  if (part !== 'deposit' && invoice.status === 'paid') return { ok: true, invoiceId };

  const due = dueNow(invoice);
  const expected = due.kind === 'pay' && due.part === part ? due.cents : null;
  if (expected === null || (session.currency ?? '').toLowerCase() !== 'usd' || session.amount_total !== expected) {
    console.error('[stripe] amount or part mismatch', { invoiceId, part, due, got: session.amount_total, currency: session.currency });
    return { ok: false, reason: 'amount mismatch' };
  }

  const update = part === 'deposit'
    ? { deposit_paid_at: new Date().toISOString(), deposit_session_id: session.id }
    : { status: 'paid', stripe_checkout_session_id: session.id };
  const { error } = await db.from('portal_invoices').update(update).eq('id', invoiceId);
  if (error) {
    console.error('[stripe] could not record the payment', invoiceId, error.message);
    return { ok: false, reason: 'update failed' };
  }
  return { ok: true, invoiceId };
}
