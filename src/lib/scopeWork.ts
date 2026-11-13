// Out-of-scope work (the price list's "Hourly design/development — Custom or
// out-of-scope work") always says what the work is, on paper: the client's
// estimate, invoice, PDF and proposal. Its description can't be blank, can't
// be the price list's generic wording, can't be hidden, and the line never
// folds into a "Totals only" category subtotal. Pure, so the builders, the
// line schema and the PDF share it.

const OUT_OF_SCOPE = /out[\s-]+of[\s-]+scope/i;
const HOURLY_WORK = /^hourly\s+design\s*\/\s*development\b/i;
/** The price list's own wording, which says nothing about the actual work. */
const PLACEHOLDER = /^\s*(custom\s+(or|\/)\s+)?out[\s-]+of[\s-]+scope(\s+work)?\.?\s*$/i;

const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '').trim();
const bareName = (n: string) => n.replace(/\s*\(optional\)\s*$/i, '').replace(/\s*\(x[\d.]+\)\s*$/i, '').trim();

/** A line for out-of-scope (or custom hourly) work. */
export function isScopeWork(line: { name: string; description?: string | null }): boolean {
  return HOURLY_WORK.test(bareName(line.name)) || OUT_OF_SCOPE.test(line.description ?? '');
}

/** True when the line still needs its own description of the work. */
export function needsWorkDescription(line: { name: string; description?: string | null }): boolean {
  if (!isScopeWork(line)) return false;
  const d = stripMo(line.description ?? '');
  return !d || PLACEHOLDER.test(d);
}

/** What's wrong with an out-of-scope line, or null. */
export function scopeWorkProblem(line: { name: string; description?: string | null; hide_description?: boolean }): string | null {
  if (!isScopeWork(line)) return null;
  if (needsWorkDescription(line)) return `"${bareName(line.name)}": describe the out-of-scope work — it always prints on the client’s paper`;
  if (line.hide_description) return `"${bareName(line.name)}": out-of-scope work always shows its description — turn “Show description” on`;
  return null;
}
