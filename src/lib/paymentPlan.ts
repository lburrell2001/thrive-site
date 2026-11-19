// Pay over time (migration 069). Pure: the estimate builder, the client's
// estimate page, the PDF, invoices and Stripe all read plans through here.
//
// An estimate's plan is [{ cents, days }]: each payment's amount and how many
// days after acceptance it's due (0 = when they accept). Accepting turns it
// into the invoice's installments: [{ cents, due_date, paid_at }].

import { z } from 'zod';
import { formatLineMoney } from './lineItems';

export type PlanPayment = { cents: number; days: number };
export type Installment = { cents: number; due_date: string; paid_at: string | null };

export const MAX_PAYMENTS = 12;

export const paymentPlanSchema = z.array(z.object({
  cents: z.number().int().positive('Each payment needs an amount'),
  days: z.number().int().min(0).max(730),
})).min(2, 'A payment plan has at least 2 payments').max(MAX_PAYMENTS);

/** A usable plan, or null (a plan is 2+ payments). */
export function planOf(value: unknown): PlanPayment[] | null {
  const parsed = paymentPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function installmentsOf(value: unknown): Installment[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const ok = value.every((i) => i && typeof i.cents === 'number' && typeof i.due_date === 'string');
  return ok ? (value as Installment[]) : null;
}

/** What's wrong with a plan for this total, or null. */
export function planProblem(plan: PlanPayment[], totalCents: number): string | null {
  if (plan.length < 2) return 'Add at least 2 payments';
  if (plan.some((p) => !(p.cents > 0))) return 'Every payment needs an amount';
  for (let i = 1; i < plan.length; i++) if (plan[i].days < plan[i - 1].days) return 'Payments need to be in date order';
  const sum = plan.reduce((t, p) => t + p.cents, 0);
  if (sum !== totalCents) {
    const off = sum - totalCents;
    return `The payments add up to ${formatLineMoney(sum)}, ${formatLineMoney(Math.abs(off))} ${off > 0 ? 'more' : 'less'} than the ${formatLineMoney(totalCents)} total`;
  }
  return null;
}

/** N payments a month apart, the odd cents on the first. */
export function evenPlan(totalCents: number, n: number, gapDays = 30): PlanPayment[] {
  const base = Math.floor(totalCents / n / 100) * 100; // whole dollars
  const first = totalCents - base * (n - 1);
  return Array.from({ length: n }, (_, i) => ({ cents: i === 0 ? first : base, days: i * gapDays }));
}

export function whenText(days: number): string {
  if (days === 0) return 'when you accept';
  if (days % 30 === 0 && days <= 360) { const m = days / 30; return `${m} month${m === 1 ? '' : 's'} after you accept`; }
  if (days % 7 === 0) { const w = days / 7; return `${w} week${w === 1 ? '' : 's'} after you accept`; }
  return `${days} days after you accept`;
}

/** "Pay over time: $170 when you accept, $165 1 month after you accept and $165 2 months after you accept." */
export function planText(plan: PlanPayment[]): string {
  const parts = plan.map((p) => `${formatLineMoney(p.cents)} ${whenText(p.days)}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Payment terms: pay over time in ${plan.length} payments — ${list}. Each payment is ready to pay in your client portal on its date.`;
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The invoice's schedule, from the day they accept. */
export function installmentsFrom(plan: PlanPayment[], acceptedOn: string): Installment[] {
  return plan.map((p) => ({ cents: p.cents, due_date: addDays(acceptedOn, p.days), paid_at: null }));
}
