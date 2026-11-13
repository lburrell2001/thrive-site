// Tiers and optional extras on a proposal (migration 061): what the client can
// choose when they sign, and the total of a choice. Proposal lines can't be
// negative, so a total is the option's lines plus the ticked extras.

import type { ProposalLineItem } from '@/types/proposal';

export type ProposalChoices = {
  tiers: { name: string; total_cents: number }[];
  extras: { id: string; label: string; description: string | null; amount_cents: number }[];
};
export type ProposalSelection = { tier: string | null; optional: string[] };

const tierOf = (i: Pick<ProposalLineItem, 'tier'>) => i.tier?.trim() || null;
const cents = (i: Pick<ProposalLineItem, 'quantity' | 'unit_price_cents'>) => Math.round(Number(i.quantity) * i.unit_price_cents);

/** Null when the proposal has no tiers or extras. */
export function proposalChoices(items: ProposalLineItem[]): ProposalChoices | null {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const names = [...new Set(sorted.map(tierOf).filter((t): t is string => !!t))];
  const extras = sorted.filter((i) => i.is_optional);
  if (!names.length && !extras.length) return null;
  const optionTotal = (t: string | null) => sorted.filter((i) => !i.is_optional && (!tierOf(i) || tierOf(i) === t)).reduce((n, i) => n + cents(i), 0);
  return {
    tiers: names.map((name) => ({ name, total_cents: optionTotal(name) })),
    extras: extras.map((i) => ({ id: i.id, label: i.label, description: i.description, amount_cents: cents(i) })),
  };
}

export type ProposalPhase = { name: string; terms: string; total_cents: number; monthly_cents: number };

/** Phases (migration 062): each phase in order with its payment terms and subtotal; null when there are none. */
export function proposalPhases(items: Pick<ProposalLineItem, 'phase' | 'phase_terms' | 'quantity' | 'unit_price_cents' | 'position' | 'description' | 'label'>[]): ProposalPhase[] | null {
  const out: ProposalPhase[] = [];
  for (const i of [...items].sort((a, b) => a.position - b.position)) {
    const name = i.phase?.trim();
    if (!name || !i.label.trim()) continue;
    let p = out.find((x) => x.name === name);
    if (!p) { p = { name, terms: '', total_cents: 0, monthly_cents: 0 }; out.push(p); }
    if (!p.terms && i.phase_terms?.trim()) p.terms = i.phase_terms.trim();
    const c = cents(i);
    if (/\/\s*mo(nth)?\.?\s*$/i.test((i.description ?? '').trim())) p.monthly_cents += c; else p.total_cents += c;
  }
  return out.length ? out : null;
}

/** A choice made valid (an unknown tier → the first; unknown extras dropped) and its total. */
export function choiceTotalFor(items: ProposalLineItem[], selection?: Partial<ProposalSelection> | null) {
  const choices = proposalChoices(items);
  if (!choices) return null;
  const tier = choices.tiers.some((t) => t.name === selection?.tier) ? selection!.tier! : choices.tiers[0]?.name ?? null;
  const optional = (selection?.optional ?? []).filter((id) => choices.extras.some((e) => e.id === id));
  const base = tier ? choices.tiers.find((t) => t.name === tier)!.total_cents
    : items.filter((i) => !i.is_optional && !tierOf(i)).reduce((n, i) => n + cents(i), 0);
  const total = base + choices.extras.filter((e) => optional.includes(e.id)).reduce((n, e) => n + e.amount_cents, 0);
  return { selection: { tier, optional } as ProposalSelection, total_cents: total };
}
