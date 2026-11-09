// Invoice deposits (migration 048). Pure, so the portal, Stripe, reminders,
// admin and the PDF agree on what's owed and when.
//
//   no deposit             → the whole invoice is due by due_date
//   deposit not paid yet   → only the deposit is payable, by deposit_due_date
//   deposit paid, held     → nothing payable: the balance waits for Lauren
//   deposit paid, open     → the balance is payable, by due_date
//   status 'paid'          → nothing owed

export type DepositFields = {
  amount_cents: number;
  status: string;
  due_date: string;
  deposit_cents?: number | null;
  deposit_due_date?: string | null;
  deposit_paid_at?: string | null;
  balance_open?: boolean | null;
};

export type PayPart = 'full' | 'deposit' | 'balance';

export type DueNow =
  | { kind: 'pay'; part: PayPart; cents: number; dueDate: string | null }
  | { kind: 'held'; cents: number }
  | { kind: 'paid' };

export const hasDeposit = (inv: DepositFields) => !!inv.deposit_cents && inv.deposit_cents > 0;

/** What the client owes right now, and for which part. */
export function dueNow(inv: DepositFields): DueNow {
  if (inv.status === 'paid') return { kind: 'paid' };
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
  if (d.kind === 'pay' && d.part === 'deposit') return 'Deposit due';
  if (d.kind === 'held') return 'Deposit paid · balance on hold';
  if (d.kind === 'pay' && d.part === 'balance') return 'Deposit paid · balance due';
  return null;
}

export const PART_LABEL: Record<PayPart, string> = { full: 'Invoice', deposit: 'Deposit', balance: 'Balance' };
