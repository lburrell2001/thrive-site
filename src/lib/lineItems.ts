// Invoice and estimate lines typed as a list, one item per line. Pure, so the
// builder's preview, the API and the PDF all read lines the same way.
//
//   Homepage design | Custom layout for phone and desktop | $600
//   Extra pages | Three inner pages | 6h @ $100        → 6 hours, $600
//   Photo editing | 2.5h | $200                        → 2.5 hours, $200 flat
//   Logo design - two concepts $750                    → no bars needed
//     - Three rounds of revisions                      → adds to the line above
//   Hosting setup | Included                           → $0, shows "Included"
//   Returning client discount | -$100
//   Friends & family discount | 50% off                → minus 50% of the one-time total
//
// Fields split on | or a tab (so a pasted spreadsheet works). The price is the
// line total; "@ $100" or "$100/hr" makes it a rate times the hours. A line
// that starts with a space, "-", "•" or "*" continues the description above.
// Lines starting with // are ignored. A line starting with "# " is a heading:
// the lines under it belong to that category (for the "Totals only" PDF's
// subtotals). A description ending in "/mo" marks a monthly line. A
// description starting with "~" is kept for Lauren but left off the client's
// PDF ("Show description" off). A price of "50% off" (or "-50%") is a
// percentage discount: its amount is worked out from the one-time lines that
// aren't discounts (monthly lines and other discounts don't count), so it
// stays right when items change (applyPercents).
//
// Tiers and optional items (migration 061): a line "Tier: Template store"
// starts a tier — the items under it belong to that option, until the next
// "Tier:" line ("Tier: none" goes back to lines every tier includes). The
// client picks one tier. A name ending "(Optional)" is an extra the client can
// tick. Totals, the invoice and the deposit follow the client's choice
// (selectLines); until they choose, the first tier and no extras.
//
// Phases (migration 062): a line "Phase: Discovery | 50% to start · 50% on
// delivery" starts a phase — the items under it belong to it, with those
// payment terms ("Phase: none" ends it). A phased list shows each phase's
// subtotal and terms and no grand total; the client approves the phases they
// want and Lauren makes an estimate from them (phaseEstimateLines). Phases
// don't mix with tiers or optional extras.

import { z } from 'zod';

export type LineItem = {
  name: string;
  description: string;
  hours: number | null;
  rate_cents: number | null;
  amount_cents: number;
  /** From a "# Heading" line above it; absent when typed without one. */
  category?: string;
  /** "Show description" off: the PDF leaves the description out. Only set when true. */
  hide_description?: boolean;
  /** A percentage discount ("50% off"): amount_cents is minus this share of the base. Only set on those lines. */
  percent?: number;
  /** The tier (option) this line belongs to; absent = every tier includes it. */
  tier?: string;
  /** An extra the client can tick; not in the total unless chosen. Only set when true. */
  optional?: boolean;
  /** The phase this line is in (migration 062), and that phase's payment terms (the same on each of its lines). */
  phase?: string;
  phase_terms?: string;
  /** Display only (rows sent to the client's page): the line's index in the estimate, for ticking an extra. */
  source?: number;
};

/**
 * What the client chose: one tier (null when there are none) and the indexes
 * of the optional lines they ticked. On a phased estimate: the phases they
 * approved, and the estimates Lauren has made from them since.
 */
export type LineSelection = {
  tier: string | null; optional: number[];
  phases?: string[];
  made?: { phases: string[]; estimate_id: string; estimate_number: string }[];
};

export type LineProblem = { line: number; message: string };

const NUM = String.raw`[\d,]*\.?\d+`;
const MONEY = String.raw`(-)?\s*\$?\s*(-)?\s*(${NUM})`;
const HOURS_WORD = String.raw`(?:h|hrs?|hours?)`;

const RE_HOURS_AT = new RegExp(String.raw`^(${NUM})\s*${HOURS_WORD}\s*(?:@|x|×|at)\s*${MONEY}(?:\s*\/\s*${HOURS_WORD})?$`, 'i');
const RE_HOURS = new RegExp(String.raw`^(${NUM})\s*${HOURS_WORD}$`, 'i');
const RE_RATE = new RegExp(String.raw`^@?\s*${MONEY}\s*\/\s*${HOURS_WORD}$`, 'i');
const RE_PRICE = new RegExp(String.raw`^${MONEY}$`);
const RE_INCLUDED = /^(included|free|no charge|n\/a)$/i;
const RE_PERCENT = new RegExp(String.raw`^-?\s*(${NUM})\s*%(?:\s*off)?$`, 'i');

// The same, at the end of a line typed without bars.
const RE_TAIL_HOURS_AT = new RegExp(String.raw`\s(${NUM}\s*${HOURS_WORD}\s*(?:@|x|×|at)\s*-?\s*\$?\s*-?\s*${NUM}(?:\s*\/\s*${HOURS_WORD})?)$`, 'i');
const RE_TAIL_RATE = new RegExp(String.raw`\s(@?\s*-?\s*\$\s*-?\s*${NUM}\s*\/\s*${HOURS_WORD})$`, 'i');
const RE_TAIL_PRICE = new RegExp(String.raw`\s(-?\s*\$\s*-?\s*${NUM}|-?${NUM})$`);
const RE_TAIL_INCLUDED = /\s(included|free|no charge)$/i;
const RE_TAIL_PERCENT = new RegExp(String.raw`\s(-?\s*${NUM}\s*%(?:\s*off)?)$`, 'i');
const RE_TAIL_HOURS = new RegExp(String.raw`\s(${NUM}\s*${HOURS_WORD})$`, 'i');

const RE_TIER = /^\s*tier\s*:\s*(.*?)\s*$/i;
const RE_OPTIONAL = /\s*\(optional\)\s*$/i;
const RE_PHASE = /^\s*phase\s*:\s*(.*?)\s*$/i;
/** "Discovery | 50% to start" → the name and its terms; "none" (or nothing) ends the phase. */
function phaseHead(s: string): { name: string; terms: string } {
  const [name = '', ...rest] = s.split('|');
  const n = name.trim();
  if (/^(none|end|no phase)?$/i.test(n)) return { name: '', terms: '' };
  return { name: n.slice(0, 80), terms: rest.join('|').trim().slice(0, 300) };
}
/** "none", "all", "shared" or nothing: back to lines every tier includes. */
const tierName = (s: string) => (/^(none|all|shared|everyone|every tier)?$/i.test(s.trim()) ? '' : s.trim().slice(0, 80));

function cents(minus1: string | undefined, minus2: string | undefined, n: string): number {
  const value = Math.round(parseFloat(n.replace(/,/g, '')) * 100);
  return minus1 || minus2 ? -value : value;
}

const hoursOf = (n: string) => Math.round(parseFloat(n.replace(/,/g, '')) * 100) / 100;

type Money = { hours?: number; rate?: number; price?: number; included?: boolean; percent?: number };

/** What a field says about money or time, or null if it's words. */
function readField(field: string): Money | null {
  let m: RegExpMatchArray | null;
  if ((m = field.match(RE_HOURS_AT))) return { hours: hoursOf(m[1]), rate: cents(m[2], m[3], m[4]) };
  if ((m = field.match(RE_HOURS))) return { hours: hoursOf(m[1]) };
  if ((m = field.match(RE_RATE))) return { rate: cents(m[1], m[2], m[3]) };
  if ((m = field.match(RE_PRICE))) return { price: cents(m[1], m[2], m[3]) };
  if (RE_INCLUDED.test(field)) return { included: true };
  if ((m = field.match(RE_PERCENT))) return { percent: parseFloat(m[1].replace(/,/g, '')) };
  return null;
}

/** "Logo design - two concepts 3h $750" → words and money fields. */
function splitLoose(line: string): string[] {
  let rest = line;
  const tail: string[] = [];
  for (const re of [RE_TAIL_PERCENT, RE_TAIL_HOURS_AT, RE_TAIL_RATE, RE_TAIL_PRICE, RE_TAIL_INCLUDED]) {
    const m = rest.match(re);
    if (m) { tail.unshift(m[1].trim()); rest = rest.slice(0, m.index).trimEnd(); break; }
  }
  const h = rest.match(RE_TAIL_HOURS);
  if (h) { tail.unshift(h[1].trim()); rest = rest.slice(0, h.index).trimEnd(); }
  const dash = rest.match(/\s[-–—]\s/);
  const words = dash ? [rest.slice(0, dash.index).trim(), rest.slice(dash.index! + dash[0].length).trim()] : [rest.trim()];
  return [...words, ...tail];
}

export function parseLineItems(text: string): { items: LineItem[]; problems: LineProblem[] } {
  const items: LineItem[] = [];
  const problems: LineProblem[] = [];
  let category = '';
  let tier = '';
  let phase = { name: '', terms: '' };
  const lineOf: number[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim() || raw.trim().startsWith('//')) return;

    // "Tier: Custom store": the items below are that option (until the next "Tier:").
    const tierLine = raw.match(RE_TIER);
    if (tierLine) { tier = tierName(tierLine[1]); return; }
    // "Phase: Discovery | 50% to start": the items below are that phase, paid on those terms.
    const phaseLine = raw.match(RE_PHASE);
    if (phaseLine) { phase = phaseHead(phaseLine[1]); return; }

    // "# Website packages": the lines below belong to this category.
    const heading = raw.match(/^#+\s+(.*\S)\s*$/);
    if (heading) { category = heading[1].slice(0, 120); return; }

    // Continues the description of the item above.
    if (/^(\s+|[-•*]\s)/.test(raw)) {
      const note = raw.trim().replace(/^[-•*]\s*/, '');
      const prev = items[items.length - 1];
      if (!prev) { problems.push({ line, message: 'A description line needs an item above it' }); return; }
      prev.description = prev.description ? `${prev.description}\n${note}` : note;
      return;
    }

    const fields = /[|\t]/.test(raw)
      ? raw.split(/[|\t]/).map((f) => f.trim()).filter(Boolean)
      : splitLoose(raw.trim());

    const words: string[] = [];
    const money: Money = {};
    for (const f of fields) {
      const read = readField(f);
      if (!read) { words.push(f); continue; }
      Object.assign(money, read);
    }

    let name = words.shift() ?? '';
    // "Hosting (Optional)": an extra the client can tick.
    const optional = RE_OPTIONAL.test(name);
    if (optional) name = name.replace(RE_OPTIONAL, '').trim();
    if (!name) { problems.push({ line, message: 'Add a name for this item' }); return; }
    // "~description": hidden from the client.
    const hidden = words.length > 0 && words[0].startsWith('~');
    if (hidden) words[0] = words[0].replace(/^~\s*/, '');

    let amount: number;
    if (money.percent !== undefined) {
      if (!(money.percent > 0 && money.percent <= 100)) { problems.push({ line, message: `"${name}": a discount is between 1% and 100%` }); return; }
      amount = 0; // worked out below, from the other lines
    } else if (money.rate !== undefined) {
      if (money.hours === undefined) { problems.push({ line, message: `"${name}" has a rate but no hours (try 4h @ $100)` }); return; }
      amount = Math.round(money.hours * money.rate);
    } else if (money.price !== undefined) {
      amount = money.price;
    } else if (money.included) {
      amount = 0;
    } else {
      problems.push({ line, message: `"${name}" needs a price (or "Included")` });
      return;
    }

    items.push({
      name: name.slice(0, 200),
      description: words.join(' · ').slice(0, 2000),
      hours: money.hours ?? null,
      rate_cents: money.rate ?? null,
      amount_cents: amount,
      ...(category ? { category } : {}),
      ...(hidden ? { hide_description: true } : {}),
      ...(money.percent !== undefined ? { percent: money.percent } : {}),
      ...(tier ? { tier } : {}),
      ...(optional ? { optional: true } : {}),
      ...(phase.name ? { phase: phase.name, ...(phase.terms ? { phase_terms: phase.terms } : {}) } : {}),
    });
    lineOf.push(line);
  });

  // Phases (migration 062): every line in one, and no tiers or extras alongside them.
  if (items.some((it) => it.phase)) {
    const loose = items.findIndex((it) => !it.phase);
    if (loose >= 0) problems.push({ line: lineOf[loose], message: `Put "${items[loose].name}" in a phase (every item needs one once there are phases)` });
    const mixed = items.findIndex((it) => it.tier || it.optional);
    if (mixed >= 0) problems.push({ line: lineOf[mixed], message: 'Phases can’t be mixed with tiers or optional extras — use one or the other' });
  }

  return { items: applyPercents(items), problems };
}

/**
 * Sets each percentage discount's amount: minus that share of the one-time
 * lines that aren't discounts (monthly charges and other discounts aren't
 * discounted). Discounts don't stack on each other.
 */
export function applyPercents<T extends LineItem>(items: T[], selection?: LineSelection | null): T[] {
  if (!items.some((it) => it.percent)) return items;
  // The base is what's in the total: with tiers or extras, the chosen (or default) lines only.
  const inTotal = includedSet(items, selection);
  // Phases (migration 062): a discount comes off its own phase only.
  const baseOf = (phase: string | undefined) => items.reduce((sum, it, i) => (!inTotal.has(i) || it.percent || isMonthly(it) || it.amount_cents <= 0 || (it.phase ?? '') !== (phase ?? '') ? sum : sum + it.amount_cents), 0);
  return items.map((it) => (it.percent ? { ...it, hours: null, rate_cents: null, amount_cents: -Math.round((baseOf(it.phase) * it.percent) / 100) } : it));
}

// ── Tiers and optional items ─────────────────────────────────────────────────

/** The tiers in the order they first appear. */
export function tiersOf(items: Pick<LineItem, 'tier'>[]): string[] {
  const out: string[] = [];
  for (const it of items) if (it.tier && !out.includes(it.tier)) out.push(it.tier);
  return out;
}

export const hasChoices = (items: Pick<LineItem, 'tier' | 'optional'>[]) => items.some((it) => it.tier || it.optional);

/** Until the client chooses: the first tier, no extras. A saved choice for a tier that's gone falls back the same way. */
export function defaultSelection(items: Pick<LineItem, 'tier' | 'optional'>[], saved?: Partial<LineSelection> | null): LineSelection {
  const tiers = tiersOf(items);
  const tier = saved?.tier && tiers.includes(saved.tier) ? saved.tier : tiers[0] ?? null;
  const optional = (saved?.optional ?? []).filter((i) => Number.isInteger(i) && items[i]?.optional);
  return { tier, optional: [...new Set(optional)].sort((a, b) => a - b) };
}

function includedSet(items: Pick<LineItem, 'tier' | 'optional'>[], selection?: Partial<LineSelection> | null): Set<number> {
  const sel = defaultSelection(items, selection);
  const ticked = new Set(sel.optional);
  const out = new Set<number>();
  items.forEach((it, i) => {
    if (it.tier && it.tier !== sel.tier) return;
    if (it.optional && !ticked.has(i)) return;
    out.add(i);
  });
  return out;
}

/** The lines the client is buying: their tier's, the shared ones and the extras they ticked — discounts worked out on those. */
export function selectLines<T extends LineItem>(items: T[], selection?: Partial<LineSelection> | null): T[] {
  if (!hasChoices(items)) return items;
  const keep = includedSet(items, selection);
  const chosen = items.filter((_, i) => keep.has(i)).map((it) => {
    const { tier: _t, optional: _o, ...rest } = it;
    void _t; void _o;
    return rest as T;
  });
  return applyPercents(chosen);
}

/**
 * The builder's tier menu: puts item `index` (in parse order) into `tier`
 * (null = every option) and returns the typed text again, with each tier's
 * lines kept together after the shared ones.
 */
export function setTierInText(text: string, index: number, tier: string | null): string {
  const { items } = parseLineItems(text);
  if (!items[index]) return text;
  const moved = { ...items[index] };
  if (tier) moved.tier = tier; else delete moved.tier;
  const rest = items.filter((_, i) => i !== index);
  const order = [...new Set([...tiersOf(rest), ...(tier ? [tier] : [])])];
  const all = [...rest.slice(0, index), moved, ...rest.slice(index)];
  const sorted = [...all.filter((it) => !it.tier), ...order.flatMap((t) => all.filter((it) => it.tier === t))];
  return lineItemsToText(sorted);
}

/** One tier's total with no extras (shared lines included), for "Template store — $1,550". */
export function tierTotal(items: LineItem[], tier: string | null): number {
  return selectLines(items, { tier, optional: [] }).reduce((sum, it) => sum + it.amount_cents, 0);
}

// ── Phases (migration 062) ──────────────────────────────────────────────────

export const isPhased = (items: Pick<LineItem, 'phase'>[]) => items.some((it) => it.phase);

export type PhaseSummary = { name: string; terms: string; total_cents: number; oneTime: number; monthly: number; count: number };

/** Each phase in order, with its payment terms and subtotal (a discount only comes off its own phase). */
export function phasesOf(items: LineItem[]): PhaseSummary[] {
  const out: PhaseSummary[] = [];
  for (const it of items) {
    if (!it.phase) continue;
    let p = out.find((x) => x.name === it.phase);
    if (!p) { p = { name: it.phase, terms: '', total_cents: 0, oneTime: 0, monthly: 0, count: 0 }; out.push(p); }
    if (!p.terms && it.phase_terms) p.terms = it.phase_terms;
    p.count += 1;
    if (isMonthly(it)) p.monthly += it.amount_cents; else p.oneTime += it.amount_cents;
    p.total_cents += it.amount_cents;
  }
  return out;
}

/**
 * The lines of the chosen phases, as a plain estimate's (the phase taken off
 * each line) — for the estimate Lauren makes once the client approves.
 */
export function phaseLines(items: LineItem[], phases: string[]): LineItem[] {
  const want = new Set(phases);
  return applyPercents(items.filter((it) => it.phase && want.has(it.phase)).map((it) => {
    const { phase: _p, phase_terms: _t, ...rest } = it;
    void _p; void _t;
    return rest as LineItem;
  }));
}

/** "Discovery: 50% to start · 50% on delivery" lines for the new estimate's notes. */
export function phaseTermsNote(items: LineItem[], phases: string[]): string {
  const rows = phasesOf(items).filter((p) => phases.includes(p.name));
  if (!rows.length) return '';
  if (rows.length === 1) return rows[0].terms ? `Payment terms: ${rows[0].terms}` : '';
  const withTerms = rows.filter((p) => p.terms);
  return withTerms.length ? ['Payment terms', ...withTerms.map((p) => `${p.name}: ${p.terms}`)].join('\n') : '';
}

/**
 * The builder's phase menu: puts item `index` (in parse order) into `phase`
 * (null = none) and returns the typed text again, each phase's lines kept
 * together in order. A phase that's new gets `terms`.
 */
export function setPhaseInText(text: string, index: number, phase: string | null, terms = ''): string {
  const { items } = parseLineItems(text);
  if (!items[index]) return text;
  const moved: LineItem = { ...items[index] };
  delete moved.phase; delete moved.phase_terms;
  if (phase) {
    const known = items.find((it) => it.phase === phase && it.phase_terms)?.phase_terms ?? terms.trim();
    moved.phase = phase;
    if (known) moved.phase_terms = known;
  }
  const rest = items.filter((_, i) => i !== index);
  const order = [...new Set([...rest.map((it) => it.phase).filter((p): p is string => !!p), ...(phase ? [phase] : [])])];
  const all = [...rest.slice(0, index), moved, ...rest.slice(index)];
  return lineItemsToText([...all.filter((it) => !it.phase), ...order.flatMap((p) => all.filter((it) => it.phase === p))]);
}

/**
 * The typed text again with each tier's and each phase's lines kept together
 * (ungrouped lines first, then each group in the order it first appears).
 */
export function groupedText(items: LineItem[]): string {
  const key = (it: LineItem) => it.phase ?? it.tier ?? '';
  const order = [...new Set(items.map(key).filter(Boolean))];
  return lineItemsToText([...items.filter((it) => !key(it)), ...order.flatMap((k) => items.filter((it) => key(it) === k))]);
}

/** Adds items to a tier or a phase (or neither) and returns the typed text. */
export function addToGroupInText(text: string, add: LineItem[], tag: { tier?: string; phase?: string; phase_terms?: string }): string {
  const { items } = parseLineItems(text);
  const terms = tag.phase ? items.find((it) => it.phase === tag.phase && it.phase_terms)?.phase_terms ?? tag.phase_terms : undefined;
  const tagged = add.map((it) => {
    const next: LineItem = { ...it };
    delete next.tier; delete next.phase; delete next.phase_terms;
    if (tag.tier) next.tier = tag.tier;
    if (tag.phase) { next.phase = tag.phase; delete next.optional; if (terms) next.phase_terms = terms; }
    return next;
  });
  return groupedText([...items, ...tagged]);
}

/** Every line into one phase: the first phase added takes everything already on the list. */
export function setAllPhaseInText(text: string, phase: string, terms = ''): string {
  const { items } = parseLineItems(text);
  return lineItemsToText(items.map((it) => ({ ...it, phase, ...(terms.trim() ? { phase_terms: terms.trim() } : {}) })));
}

/** A phase's payment terms, changed on its "Phase:" lines (and so on every line in it). */
export function setPhaseTermsInText(text: string, phase: string, terms: string): string {
  const clean = terms.replace(/[\r\n|]+/g, ' ').trim().slice(0, 300);
  return text.split('\n').map((raw) => {
    const m = raw.match(RE_PHASE);
    if (!m || phaseHead(m[1]).name !== phase) return raw;
    return `Phase: ${phase}${clean ? ` | ${clean}` : ''}`;
  }).join('\n');
}

/** One item in the typed text: its line, any "-" lines under it, and what it reads as. */
export type LineBlock = { start: number; end: number; item: LineItem | null };

/**
 * The items with the lines they came from, so the builder can show them as
 * rows and remove or change one by editing just its lines. Follows the same
 * rules as parseLineItems (headings, continuation lines, comments).
 */
export function lineBlocks(text: string): LineBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: { start: number; end: number; category: string; tier: string; phase: { name: string; terms: string } }[] = [];
  let category = '';
  let tier = '';
  let phase = { name: '', terms: '' };
  lines.forEach((raw, i) => {
    if (!raw.trim() || raw.trim().startsWith('//')) return;
    const tierLine = raw.match(RE_TIER);
    if (tierLine) { tier = tierName(tierLine[1]); return; }
    const phaseLine = raw.match(RE_PHASE);
    if (phaseLine) { phase = phaseHead(phaseLine[1]); return; }
    const heading = raw.match(/^#+\s+(.*\S)\s*$/);
    if (heading) { category = heading[1].slice(0, 120); return; }
    if (/^(\s+|[-•*]\s)/.test(raw)) {
      const prev = blocks[blocks.length - 1];
      if (prev) prev.end = i;
      return;
    }
    blocks.push({ start: i, end: i, category, tier, phase });
  });
  return blocks.map((b) => {
    const own = lines.slice(b.start, b.end + 1).filter((l, j) => j === 0 || /^(\s+|[-•*]\s)/.test(l)).join('\n');
    const item = parseLineItems(own).items[0] ?? null;
    return { start: b.start, end: b.end, item: item ? {
      ...item, ...(b.category ? { category: b.category } : {}), ...(b.tier ? { tier: b.tier } : {}),
      ...(b.phase.name ? { phase: b.phase.name, ...(b.phase.terms ? { phase_terms: b.phase.terms } : {}) } : {}),
    } : null };
  }).map((b, _i, all) => {
    // A percentage discount read on its own has nothing to take off: use every row.
    if (!b.item?.percent) return b;
    const items = applyPercents(all.map((x) => x.item).filter((x): x is LineItem => Boolean(x)));
    return { ...b, item: items.find((x) => x.percent === b.item!.percent && x.name === b.item!.name) ?? b.item };
  });
}

function money(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: abs % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Back to the typed form, for editing a saved estimate or invoice. */
/** One item as typed lines (its "-" lines included, no heading). */
export function lineText(it: LineItem): string {
  const [first = '', ...more] = it.description ? it.description.split('\n') : [];
  const price = it.percent ? `${it.percent}% off`
    : it.hours !== null && it.rate_cents !== null
    ? `${it.hours}h @ ${money(it.rate_cents)}`
    : [it.hours !== null ? `${it.hours}h` : '', it.amount_cents === 0 ? 'Included' : money(it.amount_cents)].filter(Boolean).join(' | ');
  const main = [it.optional ? `${it.name} (Optional)` : it.name, first && it.hide_description ? `~${first}` : first, price].filter(Boolean).join(' | ');
  return [main, ...more.map((d) => `  - ${d}`)].join('\n');
}

export function lineItemsToText(items: LineItem[]): string {
  let category = '';
  let tier = '';
  let phase = '';
  return items.map((it) => {
    let head = '';
    if ((it.phase ?? '') !== phase) {
      phase = it.phase ?? '';
      head += phase ? `Phase: ${phase}${it.phase_terms ? ` | ${it.phase_terms.replace(/[\r\n|]+/g, ' ')}` : ''}\n` : 'Phase: none\n';
    }
    if ((it.tier ?? '') !== tier) {
      tier = it.tier ?? '';
      head += tier ? `Tier: ${tier}\n` : 'Tier: none\n';
    }
    if ((it.category ?? '') !== category) {
      category = it.category ?? '';
      // A line with no category after a heading can't get back out from under it.
      head += category ? `# ${category}\n` : '# Other\n';
    }
    return head + lineText(it);
  }).join('\n');
}

/** The total: with tiers or optional extras, of the client's choice (or the default one: first tier, no extras). */
export const totalCents = (items: LineItem[], selection?: Partial<LineSelection> | null) =>
  selectLines(items, selection).reduce((sum, it) => sum + it.amount_cents, 0);

/** A monthly charge: its description ends in "/mo" (the price list adds it). */
export const isMonthly = (it: LineItem) => /\/\s*mo(nth)?\.?\s*$/i.test(it.description.trim());

/** The same total, split into one-time and monthly. */
export function splitTotals(items: LineItem[], selection?: Partial<LineSelection> | null): { oneTime: number; monthly: number } {
  let oneTime = 0;
  let monthly = 0;
  for (const it of selectLines(items, selection)) {
    if (isMonthly(it)) monthly += it.amount_cents;
    else oneTime += it.amount_cents;
  }
  return { oneTime, monthly };
}

export const OTHER_CATEGORY = 'Other';

export type CategoryTotal = { category: string; items: LineItem[]; oneTime: number; monthly: number };

/** Lines grouped by category in the order they first appear, with subtotals. */
export function categoryTotals(items: LineItem[]): CategoryTotal[] {
  const groups = new Map<string, CategoryTotal>();
  for (const it of items) {
    const key = it.category?.trim() || OTHER_CATEGORY;
    let g = groups.get(key);
    if (!g) { g = { category: key, items: [], oneTime: 0, monthly: 0 }; groups.set(key, g); }
    g.items.push(it);
    if (isMonthly(it)) g.monthly += it.amount_cents;
    else g.oneTime += it.amount_cents;
  }
  return [...groups.values()];
}

/** "$1,250", "$100/mo", "$1,250 + $100/mo", "Included": an amount as the PDF prints it. */
export function amountText(oneTime: number, monthly: number): string {
  if (!oneTime && !monthly) return 'Included';
  if (!monthly) return money(oneTime);
  if (!oneTime) return `${money(monthly)}/mo`;
  return `${money(oneTime)} + ${money(monthly)}/mo`;
}

export type ClientRow = {
  name: string; description: string; hours: number | null; oneTime: number; monthly: number; group: boolean;
  /** Tiers and extras (migration 061): which option the row is in, whether the client can tick it, and its line index. */
  tier?: string; optional?: boolean; source?: number;
  /** Phases (migration 062): the row's phase and that phase's payment terms. */
  phase?: string; phase_terms?: string;
};

/**
 * The rows the client sees. Every line normally; with "Totals only", one row
 * per category — except that a line with no category, or the only line in
 * its category, shows under its own name and with its description (a lone
 * "Other — $125" tells the client nothing). "Show description" off leaves a
 * description out either way.
 */
export function clientRows(items: LineItem[], totalsOnly: boolean): ClientRow[] {
  const one = (it: LineItem, source?: number): ClientRow => ({
    name: it.name,
    description: it.hide_description ? '' : it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, ''),
    hours: it.hours,
    oneTime: isMonthly(it) ? 0 : it.amount_cents,
    monthly: isMonthly(it) ? it.amount_cents : 0,
    group: false,
    ...(it.tier ? { tier: it.tier } : {}),
    // Rows already collapsed for a client keep the index they came with.
    ...(it.optional ? { optional: true, source: it.source ?? source } : {}),
    ...(it.phase ? { phase: it.phase, ...(it.phase_terms ? { phase_terms: it.phase_terms } : {}) } : {}),
  });
  if (!totalsOnly) return items.map((it, i) => one(it, i));
  if (isPhased(items)) {
    // Each phase summed on its own, its rows carrying the phase.
    return phasesOf(items).flatMap((ph) => {
      const tag = { phase: ph.name, ...(ph.terms ? { phase_terms: ph.terms } : {}) };
      return categoryTotals(items.filter((it) => it.phase === ph.name)).flatMap((g): ClientRow[] => {
        const uncategorised = g.items.every((it) => !it.category?.trim());
        if (uncategorised || g.items.length === 1) return g.items.map((it) => ({ ...one(it), hours: null }));
        return [{ name: g.category, description: '', hours: null, oneTime: g.oneTime, monthly: g.monthly, group: true, ...tag }];
      });
    });
  }
  if (hasChoices(items)) {
    // Each option is summed on its own; an extra always shows on its own, since the client ticks it.
    const shared = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.tier && !it.optional);
    const rowsOf = (part: { it: LineItem; i: number }[], tier?: string) =>
      categoryTotals(part.map((p) => p.it)).flatMap((g): ClientRow[] => {
        const uncategorised = g.items.every((it) => !it.category?.trim());
        if (uncategorised || g.items.length === 1) return g.items.map((it) => ({ ...one(it), hours: null }));
        return [{ name: g.category, description: '', hours: null, oneTime: g.oneTime, monthly: g.monthly, group: true, ...(tier ? { tier } : {}) }];
      });
    return [
      ...rowsOf(shared),
      ...tiersOf(items).flatMap((t) => rowsOf(items.map((it, i) => ({ it, i })).filter(({ it }) => it.tier === t && !it.optional), t)),
      ...items.map((it, i) => ({ it, i })).filter(({ it }) => it.optional).map(({ it, i }) => ({ ...one(it, i), hours: null })),
    ];
  }
  return categoryTotals(items).flatMap((g): ClientRow[] => {
    const uncategorised = g.items.every((it) => !it.category?.trim());
    // Shown on its own: keeps its description unless "Show description" is off.
    if (uncategorised || g.items.length === 1) return g.items.map((it) => ({ ...one(it), hours: null }));
    return [{ name: g.category, description: '', hours: null, oneTime: g.oneTime, monthly: g.monthly, group: true }];
  });
}

/**
 * Rows in the order a client reads choices: what every option includes, then
 * each option with its total (shared lines included, no extras), then the
 * extras. Works on full lines or on client rows (each has tier/optional).
 */
export type ChoiceSection<R> = { kind: 'shared' | 'tier' | 'extras'; tier?: string; rows: R[] };
export function choiceSections<R extends { tier?: string; optional?: boolean }>(rows: R[]): ChoiceSection<R>[] {
  const out: ChoiceSection<R>[] = [];
  const shared = rows.filter((r) => !r.tier && !r.optional);
  if (shared.length) out.push({ kind: 'shared', rows: shared });
  for (const t of tiersOf(rows)) out.push({ kind: 'tier', tier: t, rows: rows.filter((r) => r.tier === t && !r.optional) });
  const extras = rows.filter((r) => r.optional);
  if (extras.length) out.push({ kind: 'extras', rows: extras });
  return out;
}

/** "One-time: $2,675 · Monthly: $100/mo", or just the one that applies. */
export function totalsLabel(items: LineItem[]): string {
  const { oneTime, monthly } = splitTotals(items);
  if (!monthly) return `One-time: ${money(oneTime)}`;
  if (!oneTime) return `Monthly: ${money(monthly)}/mo`;
  return `One-time: ${money(oneTime)} · Monthly: ${money(monthly)}/mo`;
}

/** "$1,250", "$62.50", "-$100"; zero prints as "Included" on a line. */
export const formatLineMoney = money;

export const lineItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  hours: z.number().min(0).max(10000).nullable(),
  rate_cents: z.number().int().min(-100_000_000).max(100_000_000).nullable(),
  amount_cents: z.number().int().min(-100_000_000).max(100_000_000),
  category: z.string().trim().max(120).optional(),
  hide_description: z.boolean().optional(),
  percent: z.number().gt(0).max(100).optional(),
  tier: z.string().trim().min(1).max(80).optional(),
  optional: z.boolean().optional(),
  phase: z.string().trim().min(1).max(80).optional(),
  phase_terms: z.string().trim().max(300).optional(),
});

export const lineSelectionSchema = z.object({
  tier: z.string().trim().max(80).nullable(),
  optional: z.array(z.number().int().min(0).max(199)).max(200),
  /** Phased estimates (migration 062): the phases the client approves. */
  phases: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

/** Percentage discounts are worked out again on the server, so a saved total always matches its lines. */
export const lineItemsSchema = z.array(lineItemSchema).min(1, 'Add at least one item').max(200).transform((items) => applyPercents(items));
