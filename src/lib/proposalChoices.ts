// Tiers and optional extras on a proposal (migration 061): what the client can
// choose when they sign, and the total of a choice. Proposal lines can't be
// negative, so a total is the option's lines plus the ticked extras.

import type { ProposalLineItem } from '@/types/proposal';

export type ProposalChoices = {
  /** total_cents is the low end; high_cents the high end (the same without a price range, migration 063). */
  tiers: { name: string; total_cents: number; high_cents: number }[];
  extras: { id: string; label: string; description: string | null; amount_cents: number }[];
};
export type ProposalSelection = { tier: string | null; optional: string[] };

const tierOf = (i: Pick<ProposalLineItem, 'tier'>) => i.tier?.trim() || null;
const cents = (i: Pick<ProposalLineItem, 'quantity' | 'unit_price_cents'>) => Math.round(Number(i.quantity) * i.unit_price_cents);
const isMo = (i: Pick<ProposalLineItem, 'description'>) => /\/\s*mo(nth)?\.?\s*$/i.test((i.description ?? '').trim());
/** In this end of a price range (a line with no end is in both). */
const inEnd = (i: Pick<ProposalLineItem, 'range_end'>, end: 'low' | 'high') => !i.range_end || i.range_end === end;

// ── Price ranges (migration 063) ─────────────────────────────────────────────

export type EndCents = { oneTime: number; monthly: number };
export const hasProposalRange = (items: Pick<ProposalLineItem, 'range_end'>[]) => items.some((i) => i.range_end === 'low' || i.range_end === 'high');

/** The low and high ends of these lines. */
export function endTotals(items: Pick<ProposalLineItem, 'range_end' | 'quantity' | 'unit_price_cents' | 'description'>[]): { low: EndCents; high: EndCents } {
  const sum = (end: 'low' | 'high') => items.filter((i) => inEnd(i, end)).reduce((acc, i) => (isMo(i)
    ? { ...acc, monthly: acc.monthly + cents(i) } : { ...acc, oneTime: acc.oneTime + cents(i) }), { oneTime: 0, monthly: 0 });
  return { low: sum('low'), high: sum('high') };
}

/** "$4,000 – $7,500" (one amount when both ends match); `money` formats cents. */
export function rangeLabel(low: EndCents, high: EndCents, money: (c: number) => string): string {
  const one = (e: EndCents) => (e.monthly && !e.oneTime ? `${money(e.monthly)}/mo` : e.monthly ? `${money(e.oneTime)} + ${money(e.monthly)}/mo` : money(e.oneTime));
  if (low.oneTime === high.oneTime && low.monthly === high.monthly) return one(low);
  if (!low.monthly && !high.monthly) return `${money(low.oneTime)} – ${money(high.oneTime)}`;
  return `${one(low)} – ${one(high)}`;
}

/** Null when the proposal has no tiers or extras. */
export function proposalChoices(items: ProposalLineItem[]): ProposalChoices | null {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const names = [...new Set(sorted.map(tierOf).filter((t): t is string => !!t))];
  const extras = sorted.filter((i) => i.is_optional);
  if (!names.length && !extras.length) return null;
  const optionTotal = (t: string | null, end: 'low' | 'high' = 'low') =>
    sorted.filter((i) => !i.is_optional && inEnd(i, end) && (!tierOf(i) || tierOf(i) === t)).reduce((n, i) => n + cents(i), 0);
  return {
    tiers: names.map((name) => ({ name, total_cents: optionTotal(name), high_cents: optionTotal(name, 'high') })),
    extras: extras.map((i) => ({ id: i.id, label: i.label, description: i.description, amount_cents: cents(i) })),
  };
}

export type ProposalPhase = {
  name: string; terms: string; timeline: string;
  /** The low end (the whole phase without a price range). */
  total_cents: number; monthly_cents: number;
  /** Price ranges (migration 063): both ends, when the phase has a range. */
  range: { low: EndCents; high: EndCents } | null;
};

/** Phases (migration 062): each phase in order with its payment terms and subtotal; null when there are none. */
export function proposalPhases(items: Pick<ProposalLineItem, 'phase' | 'phase_terms' | 'quantity' | 'unit_price_cents' | 'position' | 'description' | 'label' | 'range_end'>[], timelines?: Record<string, string> | null): ProposalPhase[] | null {
  const out: ProposalPhase[] = [];
  const sorted = [...items].sort((a, b) => a.position - b.position).filter((i) => i.label.trim());
  for (const i of sorted) {
    const name = i.phase?.trim();
    if (!name) continue;
    let p = out.find((x) => x.name === name);
    if (!p) { p = { name, terms: '', timeline: timelines?.[name]?.trim() ?? '', total_cents: 0, monthly_cents: 0, range: null }; out.push(p); }
    if (!p.terms && i.phase_terms?.trim()) p.terms = i.phase_terms.trim();
  }
  for (const p of out) {
    const mine = sorted.filter((i) => i.phase?.trim() === p.name);
    const ends = endTotals(mine);
    p.total_cents = ends.low.oneTime;
    p.monthly_cents = ends.low.monthly;
    if (hasProposalRange(mine)) p.range = ends;
  }
  return out.length ? out : null;
}

/** A choice made valid (an unknown tier → the first; unknown extras dropped) and its total. */
export function choiceTotalFor(items: ProposalLineItem[], selection?: Partial<ProposalSelection> | null) {
  const choices = proposalChoices(items);
  if (!choices) return null;
  const tier = choices.tiers.some((t) => t.name === selection?.tier) ? selection!.tier! : choices.tiers[0]?.name ?? null;
  const optional = (selection?.optional ?? []).filter((id) => choices.extras.some((e) => e.id === id));
  const base = (end: 'low' | 'high') => tier ? (end === 'low' ? choices.tiers.find((t) => t.name === tier)!.total_cents : choices.tiers.find((t) => t.name === tier)!.high_cents)
    : items.filter((i) => !i.is_optional && !tierOf(i) && inEnd(i, end)).reduce((n, i) => n + cents(i), 0);
  const extras = choices.extras.filter((e) => optional.includes(e.id)).reduce((n, e) => n + e.amount_cents, 0);
  // With a price range, total_cents is the low end and high_cents the high end.
  return { selection: { tier, optional } as ProposalSelection, total_cents: base('low') + extras, high_cents: base('high') + extras };
}
