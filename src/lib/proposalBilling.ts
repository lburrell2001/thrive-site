// Moving work between estimates, proposals and invoices without retyping.
// Pure, so the API route and the builder share it.
//
// Estimate → proposal: an estimate's lines become the proposal's line items
//   (hours × rate stays hours × rate; "Extra page (x3)" becomes quantity 3)
//   and its deliverables. Proposal prices can't be negative, so discount
//   lines are left out and reported.
// Proposal → invoice: the line items as typed lines for the invoice builder,
//   or just the deposit, or just the balance after the deposit.

import { formatLineMoney, type LineItem } from './lineItems';

export type ProposalLine = {
  label: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  position: number;
  tier?: string | null;
  is_optional?: boolean;
};

const isMonthly = (d: string | null) => /\/\s*mo(nth)?\.?\s*$/i.test((d ?? '').trim());
const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');

export function estimateToProposalLines(lines: LineItem[]): {
  lineItems: ProposalLine[];
  deliverables: { title: string; description: string }[];
  skipped: string[];
} {
  const lineItems: ProposalLine[] = [];
  const deliverables: { title: string; description: string }[] = [];
  const skipped: string[] = [];
  for (const line of lines) {
    if (line.amount_cents < 0) { skipped.push(line.name); continue; }
    const description = line.description.replace(/\n/g, ' · ').slice(0, 500) || null;
    let label = line.name;
    let quantity = 1;
    let unit = line.amount_cents;
    if (line.hours !== null && line.rate_cents !== null && line.rate_cents >= 0) {
      label = line.name.replace(/\s*\(x\d+\)/i, '');
      quantity = line.hours;
      unit = line.rate_cents;
    } else {
      const m = line.name.match(/\s*\(x(\d+)\)/i);
      const n = m ? Number(m[1]) : 1;
      if (n > 1 && line.amount_cents % n === 0) {
        label = line.name.replace(/\s*\(x\d+\)/i, '');
        quantity = n;
        unit = line.amount_cents / n;
      }
    }
    lineItems.push({
      label: label.slice(0, 200), description, quantity, unit_price_cents: unit, position: lineItems.length,
      ...(line.tier ? { tier: line.tier } : {}),
      ...(line.optional ? { is_optional: true } : {}),
    });
    const title = label.replace(/\s*\(optional\)\s*$/i, '');
    if (!deliverables.some((d) => d.title === title)) {
      deliverables.push({ title, description: stripMo(line.description.split('\n')[0] ?? '') });
    }
  }
  return { lineItems, deliverables, skipped };
}

export type InvoicePart = 'full' | 'deposit' | 'balance';

/** The proposal's one-time total (monthly lines left out) and its monthly total. */
export function proposalTotals(items: ProposalLine[]): { oneTime: number; monthly: number } {
  let oneTime = 0;
  let monthly = 0;
  for (const i of items) {
    const cents = Math.round(i.quantity * i.unit_price_cents);
    if (isMonthly(i.description)) monthly += cents;
    else oneTime += cents;
  }
  return { oneTime, monthly };
}

/**
 * Tiers and optional extras (migration 061): the lines a signed proposal's
 * client chose — their option, the shared lines and the extras they ticked
 * (the estimate's selection; extras by index in position order). Without a
 * choice yet: the first option, no extras.
 */
export function chosenProposalLines(items: ProposalLine[], selection?: { tier: string | null; optional: number[] } | null): ProposalLine[] {
  const order = [...items].sort((a, b) => a.position - b.position).filter((i) => i.label.trim());
  const tierOf = (i: ProposalLine) => i.tier?.trim() || null;
  if (!order.some((i) => tierOf(i) || i.is_optional)) return items;
  const tier = selection?.tier ?? order.map(tierOf).find((t) => t) ?? null;
  const ticked = new Set(selection?.optional ?? []);
  return order.filter((i, idx) => (i.is_optional ? ticked.has(idx) : !tierOf(i) || tierOf(i) === tier))
    .map(({ tier: _t, is_optional: _o, ...rest }) => { void _t; void _o; return rest; });
}

/** Typed lines for the invoice builder. */
export function proposalInvoiceText(
  part: InvoicePart,
  proposal: { title: string; deposit_percent: number },
  items: ProposalLine[],
): string {
  const clean = (s: string) => s.replace(/[|\t\r\n]+/g, ' ').trim();
  const { oneTime } = proposalTotals(items);
  const pct = Math.min(100, Math.max(0, proposal.deposit_percent));
  const deposit = Math.round((oneTime * pct) / 100);
  const title = clean(proposal.title) || 'Proposal';
  if (part === 'deposit') return `Deposit (${pct}%) | ${title} | ${formatLineMoney(deposit)}\n`;
  if (part === 'balance') return `Balance (${100 - pct}%) | ${title} | ${formatLineMoney(oneTime - deposit)}\n`;
  return items.map((i) => {
    const cents = Math.round(i.quantity * i.unit_price_cents);
    const name = clean(i.label).replace(/\s*\(x\d+\)/i, '') + (i.quantity !== 1 ? ` (x${i.quantity})` : '');
    const price = cents === 0 ? 'Included' : formatLineMoney(cents);
    return [name, clean(i.description ?? ''), price].filter(Boolean).join(' | ');
  }).join('\n') + '\n';
}

/**
 * Proposal → its estimate's lines. The proposal's pricing wins; what the
 * estimate knew about each line (its category, hours × rate, a hidden
 * description) is kept when the line is still there, matched by name.
 */
export function proposalToEstimateLines(items: ProposalLine[], previous: LineItem[] = []): LineItem[] {
  const base = (n: string) => n.replace(/\s*\(x[\d.]+\)/i, '').trim().toLowerCase();
  return [...items].sort((a, b) => a.position - b.position).filter((i) => i.label.trim()).map((i) => {
    const before = previous.find((p) => base(p.name) === base(i.label));
    const amount = Math.round(i.quantity * i.unit_price_cents);
    const hourly = before?.hours !== null && before?.hours !== undefined && before.rate_cents !== null;
    const label = i.label.replace(/\s*\(x[\d.]+\)/i, '').trim();
    const line: LineItem = {
      name: (hourly || i.quantity === 1 ? label : `${label} (x${i.quantity})`).slice(0, 200),
      description: (i.description ?? '').slice(0, 2000),
      hours: hourly ? i.quantity : null,
      rate_cents: hourly ? i.unit_price_cents : null,
      amount_cents: amount,
    };
    if (before?.category) line.category = before.category;
    if (before?.hide_description) line.hide_description = true;
    if (i.tier?.trim()) line.tier = i.tier.trim();
    if (i.is_optional) line.optional = true;
    return line;
  });
}
