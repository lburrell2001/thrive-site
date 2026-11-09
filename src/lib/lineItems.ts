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
//
// Fields split on | or a tab (so a pasted spreadsheet works). The price is the
// line total; "@ $100" or "$100/hr" makes it a rate times the hours. A line
// that starts with a space, "-", "•" or "*" continues the description above.
// Lines starting with // are ignored. A line starting with "# " is a heading:
// the lines under it belong to that category (for the "Totals only" PDF's
// subtotals). A description ending in "/mo" marks a monthly line. A
// description starting with "~" is kept for Lauren but left off the client's
// PDF ("Show description" off).

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

// The same, at the end of a line typed without bars.
const RE_TAIL_HOURS_AT = new RegExp(String.raw`\s(${NUM}\s*${HOURS_WORD}\s*(?:@|x|×|at)\s*-?\s*\$?\s*-?\s*${NUM}(?:\s*\/\s*${HOURS_WORD})?)$`, 'i');
const RE_TAIL_RATE = new RegExp(String.raw`\s(@?\s*-?\s*\$\s*-?\s*${NUM}\s*\/\s*${HOURS_WORD})$`, 'i');
const RE_TAIL_PRICE = new RegExp(String.raw`\s(-?\s*\$\s*-?\s*${NUM}|-?${NUM})$`);
const RE_TAIL_INCLUDED = /\s(included|free|no charge)$/i;
const RE_TAIL_HOURS = new RegExp(String.raw`\s(${NUM}\s*${HOURS_WORD})$`, 'i');

function cents(minus1: string | undefined, minus2: string | undefined, n: string): number {
  const value = Math.round(parseFloat(n.replace(/,/g, '')) * 100);
  return minus1 || minus2 ? -value : value;
}

const hoursOf = (n: string) => Math.round(parseFloat(n.replace(/,/g, '')) * 100) / 100;

type Money = { hours?: number; rate?: number; price?: number; included?: boolean };

/** What a field says about money or time, or null if it's words. */
function readField(field: string): Money | null {
  let m: RegExpMatchArray | null;
  if ((m = field.match(RE_HOURS_AT))) return { hours: hoursOf(m[1]), rate: cents(m[2], m[3], m[4]) };
  if ((m = field.match(RE_HOURS))) return { hours: hoursOf(m[1]) };
  if ((m = field.match(RE_RATE))) return { rate: cents(m[1], m[2], m[3]) };
  if ((m = field.match(RE_PRICE))) return { price: cents(m[1], m[2], m[3]) };
  if (RE_INCLUDED.test(field)) return { included: true };
  return null;
}

/** "Logo design - two concepts 3h $750" → words and money fields. */
function splitLoose(line: string): string[] {
  let rest = line;
  const tail: string[] = [];
  for (const re of [RE_TAIL_HOURS_AT, RE_TAIL_RATE, RE_TAIL_PRICE, RE_TAIL_INCLUDED]) {
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

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim() || raw.trim().startsWith('//')) return;

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

    const name = words.shift() ?? '';
    if (!name) { problems.push({ line, message: 'Add a name for this item' }); return; }
    // "~description": hidden from the client.
    const hidden = words.length > 0 && words[0].startsWith('~');
    if (hidden) words[0] = words[0].replace(/^~\s*/, '');

    let amount: number;
    if (money.rate !== undefined) {
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
    });
  });

  return { items, problems };
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
  const blocks: { start: number; end: number; category: string }[] = [];
  let category = '';
  lines.forEach((raw, i) => {
    if (!raw.trim() || raw.trim().startsWith('//')) return;
    const heading = raw.match(/^#+\s+(.*\S)\s*$/);
    if (heading) { category = heading[1].slice(0, 120); return; }
    if (/^(\s+|[-•*]\s)/.test(raw)) {
      const prev = blocks[blocks.length - 1];
      if (prev) prev.end = i;
      return;
    }
    blocks.push({ start: i, end: i, category });
  });
  return blocks.map((b) => {
    const own = lines.slice(b.start, b.end + 1).filter((l, j) => j === 0 || /^(\s+|[-•*]\s)/.test(l)).join('\n');
    const item = parseLineItems(own).items[0] ?? null;
    return { start: b.start, end: b.end, item: item ? { ...item, ...(b.category ? { category: b.category } : {}) } : null };
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
  const price = it.hours !== null && it.rate_cents !== null
    ? `${it.hours}h @ ${money(it.rate_cents)}`
    : [it.hours !== null ? `${it.hours}h` : '', it.amount_cents === 0 ? 'Included' : money(it.amount_cents)].filter(Boolean).join(' | ');
  const main = [it.name, first && it.hide_description ? `~${first}` : first, price].filter(Boolean).join(' | ');
  return [main, ...more.map((d) => `  - ${d}`)].join('\n');
}

export function lineItemsToText(items: LineItem[]): string {
  let category = '';
  return items.map((it) => {
    let head = '';
    if ((it.category ?? '') !== category) {
      category = it.category ?? '';
      // A line with no category after a heading can't get back out from under it.
      head = category ? `# ${category}\n` : '# Other\n';
    }
    return head + lineText(it);
  }).join('\n');
}

export const totalCents = (items: LineItem[]) => items.reduce((sum, it) => sum + it.amount_cents, 0);

/** A monthly charge: its description ends in "/mo" (the price list adds it). */
export const isMonthly = (it: LineItem) => /\/\s*mo(nth)?\.?\s*$/i.test(it.description.trim());

/** The same total, split into one-time and monthly. */
export function splitTotals(items: LineItem[]): { oneTime: number; monthly: number } {
  let oneTime = 0;
  let monthly = 0;
  for (const it of items) {
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

export type ClientRow = { name: string; description: string; hours: number | null; oneTime: number; monthly: number; group: boolean };

/**
 * The rows the client sees. Every line normally; with "Totals only", one row
 * per category — except that a line with no category, or the only line in
 * its category, shows under its own name (a lone "Other — $125" tells the
 * client nothing).
 */
export function clientRows(items: LineItem[], totalsOnly: boolean): ClientRow[] {
  const one = (it: LineItem): ClientRow => ({
    name: it.name,
    description: it.hide_description ? '' : it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, ''),
    hours: it.hours,
    oneTime: isMonthly(it) ? 0 : it.amount_cents,
    monthly: isMonthly(it) ? it.amount_cents : 0,
    group: false,
  });
  if (!totalsOnly) return items.map(one);
  return categoryTotals(items).flatMap((g): ClientRow[] => {
    const uncategorised = g.items.every((it) => !it.category?.trim());
    if (uncategorised || g.items.length === 1) return g.items.map((it) => ({ ...one(it), description: '', hours: null }));
    return [{ name: g.category, description: '', hours: null, oneTime: g.oneTime, monthly: g.monthly, group: true }];
  });
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
});

export const lineItemsSchema = z.array(lineItemSchema).min(1, 'Add at least one item').max(200);
