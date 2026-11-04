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
// Lines starting with // are ignored.

import { z } from 'zod';

export type LineItem = {
  name: string;
  description: string;
  hours: number | null;
  rate_cents: number | null;
  amount_cents: number;
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

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim() || raw.trim().startsWith('//')) return;

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
    });
  });

  return { items, problems };
}

function money(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: abs % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Back to the typed form, for editing a saved estimate or invoice. */
export function lineItemsToText(items: LineItem[]): string {
  return items.map((it) => {
    const [first = '', ...more] = it.description ? it.description.split('\n') : [];
    const price = it.hours !== null && it.rate_cents !== null
      ? `${it.hours}h @ ${money(it.rate_cents)}`
      : [it.hours !== null ? `${it.hours}h` : '', it.amount_cents === 0 ? 'Included' : money(it.amount_cents)].filter(Boolean).join(' | ');
    const main = [it.name, first, price].filter(Boolean).join(' | ');
    return [main, ...more.map((d) => `  - ${d}`)].join('\n');
  }).join('\n');
}

export const totalCents = (items: LineItem[]) => items.reduce((sum, it) => sum + it.amount_cents, 0);

/** "$1,250", "$62.50", "-$100"; zero prints as "Included" on a line. */
export const formatLineMoney = money;

export const lineItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  hours: z.number().min(0).max(10000).nullable(),
  rate_cents: z.number().int().min(-100_000_000).max(100_000_000).nullable(),
  amount_cents: z.number().int().min(-100_000_000).max(100_000_000),
});

export const lineItemsSchema = z.array(lineItemSchema).min(1, 'Add at least one item').max(200);
