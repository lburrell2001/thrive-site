// Invoice deposits (migration 048). Pure, so the portal, Stripe, reminders,
// admin and the PDF agree on what's owed and when.
//
//   no deposit             → the whole invoice is due by due_date
//   deposit not paid yet   → only the deposit is payable, by deposit_due_date
//   deposit paid, held     → nothing payable: the balance waits for Lauren
//   deposit paid, open     → the balance is payable, by due_date
//   status 'paid'          → nothing owed
//   declined by the client → nothing payable until Lauren reopens it (058)
//   pay over time (069)    → payment 1 is the deposit; then each installment
//                            in turn, by its own date; the last one pays it off

import { installmentsOf, type Installment } from './paymentPlan';

export type DepositFields = {
  amount_cents: number;
  status: string;
  due_date: string;
  deposit_cents?: number | null;
  deposit_due_date?: string | null;
  deposit_paid_at?: string | null;
  balance_open?: boolean | null;
  /** The client declined it in the portal (migration 058). */
  declined_at?: string | null;
  /** Pay over time (migration 069): the schedule; payment 1 is also the deposit. */
  installments?: unknown;
};

export type PayPart = 'full' | 'deposit' | 'balance' | 'installment';

export type DueNow =
  /** On a payment plan, index is the payment (0-based) and of the number of payments. */
  | { kind: 'pay'; part: PayPart; cents: number; dueDate: string | null; index?: number; of?: number }
  | { kind: 'held'; cents: number }
  | { kind: 'declined'; cents: number }
  | { kind: 'paid' };

export const hasDeposit = (inv: DepositFields) => !!inv.deposit_cents && inv.deposit_cents > 0;

/** The payment plan (migration 069), when the invoice has one. */
export const planFor = (inv: DepositFields): Installment[] | null => installmentsOf(inv.installments);

/** Payments made so far on a plan (payment 1 counts once the deposit is paid). */
export function paidOnPlan(inv: DepositFields, plan: Installment[]): number {
  return plan.reduce((t, p, i) => t + ((i === 0 ? inv.deposit_paid_at : p.paid_at) ? p.cents : 0), 0);
}

/** What the client owes right now, and for which part. */
export function dueNow(inv: DepositFields): DueNow {
  if (inv.status === 'paid') return { kind: 'paid' };
  if (inv.declined_at) return { kind: 'declined', cents: remainingCents(inv) };
  const plan = planFor(inv);
  if (plan) {
    for (let i = 0; i < plan.length; i++) {
      const paid = i === 0 ? !!inv.deposit_paid_at : !!plan[i].paid_at;
      if (!paid) return { kind: 'pay', part: i === 0 ? 'deposit' : 'installment', cents: plan[i].cents, dueDate: plan[i].due_date, index: i, of: plan.length };
    }
    return { kind: 'paid' };
  }
  if (!hasDeposit(inv)) return { kind: 'pay', part: 'full', cents: inv.amount_cents, dueDate: inv.due_date || null };
  const deposit = inv.deposit_cents!;
  if (!inv.deposit_paid_at) return { kind: 'pay', part: 'deposit', cents: deposit, dueDate: inv.deposit_due_date ?? inv.due_date ?? null };
  const balance = inv.amount_cents - deposit;
  if (inv.balance_open === false) return { kind: 'held', cents: balance };
  return { kind: 'pay', part: 'balance', cents: balance, dueDate: inv.due_date || null };
}

/** Everything still owed on the invoice (a held balance included). */
export function remainingCents(inv: DepositFields): number {
  if (inv.status === 'paid') return 0;
  const plan = planFor(inv);
  if (plan) return inv.amount_cents - paidOnPlan(inv, plan);
  return inv.amount_cents - (hasDeposit(inv) && inv.deposit_paid_at ? inv.deposit_cents! : 0);
}

/** Past its date: the part due now, with its own date. */
export function isOverdue(inv: DepositFields, today: string): boolean {
  const d = dueNow(inv);
  return d.kind === 'pay' && !!d.dueDate && d.dueDate < today;
}

/** "Deposit due", "Balance on hold"… a short status for lists. */
export function depositLabel(inv: DepositFields): string | null {
  if (!hasDeposit(inv) || inv.status === 'paid') return null;
  const d = dueNow(inv);
  if (d.kind === 'pay' && d.of) return `Payment ${d.index! + 1} of ${d.of} due`;
  if (d.kind === 'pay' && d.part === 'deposit') return 'Deposit due';
  if (d.kind === 'held') return 'Deposit paid · balance on hold';
  if (d.kind === 'pay' && d.part === 'balance') return 'Deposit paid · balance due';
  return null;
}

export const PART_LABEL: Record<PayPart, string> = { full: 'Invoice', deposit: 'Deposit', balance: 'Balance', installment: 'Payment' };

/** "deposit", "balance", "payment 2 of 3", or '' for the whole invoice — for sentences. */
export function partWord(due: DueNow): string {
  if (due.kind !== 'pay') return '';
  if (due.of) return `payment ${due.index! + 1} of ${due.of}`;
  return due.part === 'full' ? '' : due.part;
}
