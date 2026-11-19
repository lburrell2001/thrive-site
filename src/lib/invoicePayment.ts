// Marks a portal invoice paid from a Stripe Checkout session — shared by the
// webhook and the portal's return-page confirm. Nothing on the session is
// trusted except what Stripe itself reports: the invoice must exist, belong to
// the client the session was opened for, and the amount Stripe collected must
// match the part being paid (the whole invoice, its deposit or its balance) to the cent.

import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dueNow, planFor, type DepositFields, type PayPart } from './invoiceDeposit';
import type { Installment } from './paymentPlan';
import { projectChecklistFromInvoice } from './projectWork';

export type PaidResult =
  /** fresh: this call recorded the payment (the other path may have already) — send the receipt only then. */
  | { ok: true; invoiceId: string; fresh?: boolean; part?: PayPart; index?: number }
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
  let found = await pick('id, client_id, amount_cents, status, due_date, deposit_cents, deposit_due_date, deposit_paid_at, deposit_session_id, balance_open, installments');
  if (found.error) found = await pick('id, client_id, amount_cents, status, due_date, deposit_cents, deposit_due_date, deposit_paid_at, deposit_session_id, balance_open');
  if (found.error) found = await pick('id, client_id, amount_cents, status, due_date');
  const invoice = found.data as unknown as (DepositFields & { id: string; client_id: string; deposit_session_id?: string | null }) | null;
  if (!invoice || invoice.client_id !== clientId) return { ok: false, reason: 'invoice not found' };

  // Already settled by this same session (webhook and confirm both arrive).
  if (part === 'deposit' && invoice.deposit_paid_at && invoice.deposit_session_id === session.id) return { ok: true, invoiceId };
  if (part !== 'deposit' && invoice.status === 'paid') return { ok: true, invoiceId };

  // Pay over time (069): a later payment, already recorded by this same session.
  const plan = planFor(invoice);
  const index = session.metadata?.index !== undefined ? Number(session.metadata.index) : undefined;
  if (part === 'installment' && plan && index !== undefined && plan[index]?.paid_at) return { ok: true, invoiceId };

  const due = dueNow(invoice);
  const expected = due.kind === 'pay' && due.part === part && (part !== 'installment' || due.index === index) ? due.cents : null;
  if (expected === null || (session.currency ?? '').toLowerCase() !== 'usd' || session.amount_total !== expected) {
    console.error('[stripe] amount or part mismatch', { invoiceId, part, due, got: session.amount_total, currency: session.currency });
    return { ok: false, reason: 'amount mismatch' };
  }

  if (part === 'installment' && plan && index !== undefined) {
    const recorded = await recordInstallment(db, invoiceId, plan, index, session.id);
    if (!recorded.ok) return { ok: false, reason: recorded.reason };
    if (!recorded.fresh) return { ok: true, invoiceId };
    if (recorded.last) await projectChecklistFromInvoice(db, invoiceId).catch(() => undefined);
    return { ok: true, invoiceId, fresh: true, part, index };
  }

  const update = part === 'deposit'
    ? { deposit_paid_at: new Date().toISOString(), deposit_session_id: session.id }
    : { status: 'paid', stripe_checkout_session_id: session.id };
  // Only one of the webhook and the return-page confirm records it (and sends the receipt).
  const q = db.from('portal_invoices').update(update).eq('id', invoiceId);
  const { data: updated, error } = await (part === 'deposit' ? q.is('deposit_paid_at', null) : q.neq('status', 'paid')).select('id');
  if (error) {
    console.error('[stripe] could not record the payment', invoiceId, error.message);
    return { ok: false, reason: 'update failed' };
  }
  if (!updated?.length) return { ok: true, invoiceId };
  // Paid: the work starts — its lines become the project's checklist if it has none.
  await projectChecklistFromInvoice(db, invoiceId).catch((e) => console.error('[stripe] checklist not made', e));
  return { ok: true, invoiceId, fresh: true, part, ...(plan && part === 'deposit' ? { index: 0 } : {}) };
}

/**
 * Records payment `index` (1+) of a plan — once: only if it's still unpaid.
 * The last one marks the whole invoice paid. Shared with "Mark payment paid".
 */
export async function recordInstallment(
  db: SupabaseClient, invoiceId: string, plan: Installment[], index: number, sessionId: string | null,
): Promise<{ ok: true; fresh: boolean; last: boolean } | { ok: false; reason: string }> {
  if (index < 1 || index >= plan.length) return { ok: false, reason: 'no such payment' };
  const next = plan.map((p, i) => (i === index ? { ...p, paid_at: new Date().toISOString(), ...(sessionId ? { session_id: sessionId } : {}) } : p));
  const last = next.slice(1).every((p) => p.paid_at);
  const { data, error } = await db.from('portal_invoices')
    .update({ installments: next, ...(last ? { status: 'paid', ...(sessionId ? { stripe_checkout_session_id: sessionId } : {}) } : {}) })
    .eq('id', invoiceId).is(`installments->${index}->>paid_at`, null).select('id');
  if (error) {
    console.error('[payment plan] could not record the payment', invoiceId, index, error.message);
    return { ok: false, reason: 'update failed' };
  }
  return { ok: true, fresh: !!data?.length, last };
}
