// Retainer deals: a monthly price for a number of months (migration 033).
// Pure, so the pipeline, the contact panel and server totals agree. The
// database keeps value_cents = monthly × months; this works out where a
// retainer is in its term.

export interface RetainerFields {
  stage: string;
  stage_changed_at: string;
  monthly_cents: number | null;
  term_months: number | null;
  starts_on: string | null;
}

export const isRetainer = (d: Pick<RetainerFields, 'monthly_cents'>) => d.monthly_cents != null;

/** YYYY-MM-DD plus whole months (the 31st becomes the month's last day). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export interface RetainerProgress {
  startsOn: string;
  /** The day after the last month — when it's over. */
  endsOn: string;
  /** 1-based month it's in; 0 before it starts, term + 1 once ended. */
  month: number;
  term: number;
  status: 'upcoming' | 'active' | 'ended';
  /** Still to bill: the months not yet started. */
  remainingCents: number;
}

/** Where a won retainer is today. Null for one-off deals, unwon deals, or no term. */
export function retainerProgress(d: RetainerFields, today: string): RetainerProgress | null {
  if (d.monthly_cents == null || d.term_months == null || d.stage !== 'won') return null;
  const startsOn = d.starts_on ?? d.stage_changed_at.slice(0, 10);
  const term = d.term_months;
  const endsOn = addMonths(startsOn, term);
  if (today < startsOn) return { startsOn, endsOn, month: 0, term, status: 'upcoming', remainingCents: d.monthly_cents * term };
  if (today >= endsOn) return { startsOn, endsOn, month: term + 1, term, status: 'ended', remainingCents: 0 };
  let month = 1;
  while (month < term && addMonths(startsOn, month) <= today) month += 1;
  return { startsOn, endsOn, month, term, status: 'active', remainingCents: d.monthly_cents * (term - month) };
}

/** Monthly income from won retainers that are running today. */
export function activeRetainers(deals: RetainerFields[], today: string) {
  const running = deals.filter((d) => retainerProgress(d, today)?.status === 'active');
  return { count: running.length, monthlyCents: running.reduce((s, d) => s + (d.monthly_cents ?? 0), 0) };
}

/** "$2,000/mo × 6" */
export function retainerLabel(d: Pick<RetainerFields, 'monthly_cents' | 'term_months'>, money: (cents: number) => string) {
  if (d.monthly_cents == null) return '';
  return `${money(d.monthly_cents)}/mo${d.term_months ? ` × ${d.term_months}` : ''}`;
}
