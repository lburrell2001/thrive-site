// The service price catalog (migration 047, /admin/price-list). Pure, so the
// Price List page, the builder's "Add from price list" drawer and the seed
// script all read and write the same line format as src/lib/lineItems.ts:
//
//   Name | description | $price         flat
//   Name (Optional) | description | $price
//   Name | description | Included      $0
//   Name | description | 1h @ $45      hourly
//   Name | description /mo | $price    monthly
//
// Prices are copied into the Items box when inserted, so editing the catalog
// never changes a saved estimate or invoice.

import { z } from 'zod';

export const PRICE_TYPES = ['flat', 'hourly', 'included', 'monthly', 'percent'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  flat: 'Flat', hourly: 'Hourly', included: 'Included', monthly: 'Monthly', percent: 'Percent off',
};

export type PriceCategory = { id: string; name: string; description: string; sort_order: number };

export type PriceItem = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  /** Dollars. Null for included items. For hourly items, the hourly rate. */
  price: number | null;
  price_type: PriceType;
  hours: number | null;
  is_optional: boolean;
  is_active: boolean;
  sort_order: number;
  /** Per-unit items get a quantity box: "page", "slide", "image"… */
  unit: string | null;
  notes: string;
};

export type RuleType = 'requires' | 'suggests';
export type PriceRule = { id: string; item_id: string; rule_type: RuleType; related_item_id: string };

export type Catalog = { categories: PriceCategory[]; items: PriceItem[]; rules: PriceRule[] };

// ── Validation (API) ───────────────────────────────────────────────────────

export const categoryInput = z.object({
  name: z.string().trim().min(1, 'Name the category').max(120),
  description: z.string().max(2000).default(''),
});

export const itemInput = z.object({
  category_id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name the item').max(200).refine((n) => !/[|\t]/.test(n), 'No | in names'),
  description: z.string().trim().max(2000).refine((d) => !/[|\t\n]/.test(d), 'No | or line breaks in descriptions').default(''),
  price: z.number().min(0).max(1_000_000).nullable(),
  price_type: z.enum(PRICE_TYPES),
  hours: z.number().min(0).max(10_000).nullable(),
  is_optional: z.boolean().default(false),
  is_active: z.boolean().default(true),
  unit: z.string().trim().max(40).nullable().transform((u) => u || null),
  notes: z.string().max(4000).default(''),
});

// ── Money ──────────────────────────────────────────────────────────────────

/** 1250 → "$1,250"; 62.5 → "$62.50". */
export function dollars(n: number): string {
  const whole = Number.isInteger(n);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** What one of the item costs, in cents (hourly = hours × rate). */
export function unitCents(item: Pick<PriceItem, 'price' | 'price_type' | 'hours'>): number {
  if (item.price_type === 'included' || item.price_type === 'percent' || item.price === null) return 0;
  if (item.price_type === 'hourly') return Math.round((item.hours ?? 1) * item.price * 100);
  return Math.round(item.price * 100);
}

/** How the price reads in the catalog: "$1,250", "1h @ $45", "$100/mo", "Included". */
export function priceLabel(item: Pick<PriceItem, 'price' | 'price_type' | 'hours'>): string {
  if (item.price_type === 'included' || item.price === null) return 'Included';
  if (item.price_type === 'hourly') return `${item.hours ?? 1}h @ ${dollars(item.price)}`;
  if (item.price_type === 'monthly') return `${dollars(item.price)}/mo`;
  if (item.price_type === 'percent') return `${item.price}% off`;
  return dollars(item.price);
}

// ── Lines for the Items box ────────────────────────────────────────────────

const clean = (s: string) => s.replace(/[|\t\r\n]+/g, ' ').trim();

/** One catalog item as a typed line, ready for the parser. */
export function itemLine(item: PriceItem, qty = 1): string {
  const q = Math.max(1, Math.floor(qty) || 1);
  let name = clean(item.name);
  // Hourly lines carry the quantity in their hours.
  if (q > 1 && item.price_type !== 'hourly' && item.price_type !== 'percent') name += ` (x${q})`;
  if (item.is_optional) name += ' (Optional)';
  let desc = clean(item.description);
  if (item.price_type === 'monthly') desc = desc ? `${desc} /mo` : '/mo';

  let price: string;
  if (item.price_type === 'included' || item.price === null) price = 'Included';
  // A percentage discount: its amount comes from the other lines (lineItems.ts applyPercents).
  else if (item.price_type === 'percent') price = `${item.price}% off`;
  else if (item.price_type === 'hourly') price = `${(item.hours ?? 1) * q}h @ ${dollars(item.price)}`;
  else price = dollars((unitCents(item) * q) / 100);

  return [name, desc, price].filter(Boolean).join(' | ');
}

/** "Extra page (x3) (Optional)" → "Extra page": the catalog name behind a typed line. */
export function baseName(lineName: string): string {
  return lineName.replace(/\s*\(optional\)\s*$/i, '').replace(/\s*\(x\d+\)\s*$/i, '').replace(/\s*\(optional\)\s*$/i, '').trim();
}

const norm = (s: string) => s.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
export const sameName = (a: string, b: string) => norm(a) === norm(b);

/**
 * Adds lines to the Items text under "# <category>": after the last line of
 * that heading's group if there is one, otherwise as a new group at the end.
 */
export function insertUnderHeading(text: string, category: string, lines: string[]): string {
  if (!lines.length) return text;
  const rows = text.replace(/\s+$/, '').split('\n');
  const isHead = (r: string) => /^#+\s+/.test(r);
  const start = rows.findIndex((r) => isHead(r) && sameName(r.replace(/^#+\s+/, ''), category));
  if (start === -1) {
    const before = rows.length === 1 && !rows[0].trim() ? [] : [...rows, ''];
    return [...before, `# ${category}`, ...lines].join('\n') + '\n';
  }
  let end = start + 1;
  while (end < rows.length && !isHead(rows[end])) end++;
  // Keep a blank line before the next heading where there was one.
  let at = end;
  while (at > start + 1 && !rows[at - 1].trim()) at--;
  rows.splice(at, 0, ...lines);
  return rows.join('\n') + '\n';
}

// ── Rules ──────────────────────────────────────────────────────────────────

/** The catalog item a typed line came from, by name. */
export function itemForLine(items: PriceItem[], lineName: string): PriceItem | undefined {
  const b = baseName(lineName);
  return items.find((i) => sameName(i.name, b));
}

/** Required items missing from the box: [the item that needs it, what it needs]. */
export function missingRequired(catalog: Catalog, lineNames: string[]): { item: PriceItem; required: PriceItem }[] {
  const present = new Set(lineNames.map((n) => itemForLine(catalog.items, n)?.id).filter(Boolean));
  const out: { item: PriceItem; required: PriceItem }[] = [];
  for (const r of catalog.rules) {
    if (r.rule_type !== 'requires' || !present.has(r.item_id) || present.has(r.related_item_id)) continue;
    const item = catalog.items.find((i) => i.id === r.item_id);
    const required = catalog.items.find((i) => i.id === r.related_item_id);
    if (item && required && !out.some((o) => o.required.id === required.id)) out.push({ item, required });
  }
  return out;
}

/** Suggested add-ons for what's in the box, not already there. */
export function suggestionsFor(catalog: Catalog, lineNames: string[]): PriceItem[] {
  const present = new Set(lineNames.map((n) => itemForLine(catalog.items, n)?.id).filter(Boolean));
  const ids: string[] = [];
  for (const r of catalog.rules) {
    if (r.rule_type !== 'suggests' || !present.has(r.item_id) || present.has(r.related_item_id)) continue;
    if (!ids.includes(r.related_item_id)) ids.push(r.related_item_id);
  }
  return ids.map((id) => catalog.items.find((i) => i.id === id)).filter((i): i is PriceItem => !!i && i.is_active);
}

// ── Export / the docs file ─────────────────────────────────────────────────

/** The whole catalog as docs/thrive-price-list.md reads. */
export function exportCatalog(catalog: Catalog, opts: { includeInactive?: boolean } = {}): string {
  const out = [
    `THRIVE CREATIVE STUDIOS — PRICE LIST (exported ${new Date().toISOString().slice(0, 10)})`,
    'Format: Item | description | $price',
    '"(Optional)" in a name = optional add-on. "Included" = $0. "1h @ $45" = hourly.',
  ];
  const cats = [...catalog.categories].sort((a, b) => a.sort_order - b.sort_order);
  for (const c of cats) {
    const items = catalog.items
      .filter((i) => i.category_id === c.id && (opts.includeInactive || i.is_active))
      .sort((a, b) => a.sort_order - b.sort_order);
    // A category of monthly items is marked "(MONTHLY)", as the docs file has it.
    const monthlyCat = /monthly/i.test(c.name) || (items.length > 0 && items.every((i) => i.price_type === 'monthly'));
    out.push('', `=== ${c.name.toUpperCase()}${monthlyCat && !/monthly/i.test(c.name) ? ' (MONTHLY)' : ''} ===`);
    if (c.description.trim()) out.push(`Note: ${c.description.trim()}`);
    for (const i of items) {
      const name = i.is_optional ? `${i.name} (Optional)` : i.name;
      const marked = monthlyCat || /per month/i.test(i.description);
      const price = i.price_type === 'included' || i.price === null ? 'Included'
        : i.price_type === 'hourly' ? `${i.hours ?? 1}h @ ${dollars(i.price)}`
        : i.price_type === 'percent' ? `${i.price}% off`
        : i.price_type === 'monthly' && !marked ? `${dollars(i.price)}/mo`
        : dollars(i.price);
      out.push([name, i.description, price].filter(Boolean).join(' | '));
    }
  }
  return out.join('\n') + '\n';
}

export type ParsedCatalogItem = Omit<PriceItem, 'id' | 'category_id' | 'is_active' | 'sort_order' | 'notes' | 'unit'>;
export type ParsedCatalogCategory = { name: string; description: string; items: ParsedCatalogItem[] };

/** Reads the docs file (=== HEADINGS ===, "Note:" lines, one item per line). */
export function parsePriceList(text: string): ParsedCatalogCategory[] {
  const cats: ParsedCatalogCategory[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const head = line.match(/^===\s*(.+?)\s*===$/);
    if (head) { cats.push({ name: head[1], description: '', items: [] }); continue; }
    const cat = cats[cats.length - 1];
    if (!cat || !line) continue;
    if (/^note:/i.test(line)) { cat.description = line.replace(/^note:\s*/i, ''); continue; }
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 2) continue;
    const priceText = parts[parts.length - 1];
    let name = parts[0];
    const description = parts.slice(1, -1).join(' | ');
    const is_optional = /\(optional\)/i.test(name);
    name = name.replace(/\s*\(optional\)/i, '').trim();
    const monthly = /\(monthly\)/i.test(cat.name) || /per month/i.test(description);
    let m: RegExpMatchArray | null;
    if (/^included$/i.test(priceText)) {
      cats[cats.length - 1].items.push({ name, description, price: 0, price_type: 'included', hours: null, is_optional });
    } else if ((m = priceText.match(/^([\d.]+)\s*%\s*off$/i))) {
      cat.items.push({ name, description, price: parseFloat(m[1]), price_type: 'percent', hours: null, is_optional });
    } else if ((m = priceText.match(/^([\d.]+)\s*h\s*@\s*\$([\d,.]+)$/i))) {
      cat.items.push({ name, description, price: parseFloat(m[2].replace(/,/g, '')), price_type: 'hourly', hours: parseFloat(m[1]), is_optional });
    } else if ((m = priceText.match(/^\$([\d,.]+)(\s*\/\s*mo)?$/i))) {
      cat.items.push({ name, description, price: parseFloat(m[1].replace(/,/g, '')), price_type: monthly || m[2] ? 'monthly' : 'flat', hours: null, is_optional });
    } else {
      throw new Error(`Can't read the price on: ${line}`);
    }
  }
  return cats;
}

/** "Website care plans (monthly)" → "Website care plans"; titles like the brief's. */
export function categoryTitle(heading: string): string {
  const named: Record<string, string> = {
    'GENERAL': 'General',
    'RUSH FEES': 'Rush fees',
    'WEBSITE PACKAGES': 'Website packages',
    'WEBSITE ADD-ONS': 'Website add-ons',
    'WEBSITE CARE PLANS (MONTHLY)': 'Website care plans',
    'APP DEVELOPMENT': 'App development',
    'BRANDING': 'Branding',
    'SOCIAL MEDIA (MONTHLY)': 'Social media (monthly)',
    'MARKETING + PRINT DESIGN': 'Marketing + print design',
    'PHOTOGRAPHY': 'Photography',
    'SEO + LOCAL SEARCH': 'SEO + local search',
    'DISCOUNTS': 'Discounts',
  };
  return named[heading.toUpperCase()] ?? heading.charAt(0) + heading.slice(1).toLowerCase();
}
