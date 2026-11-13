// A client's choice of tier and extras on an estimate (migration 061): the
// selection cleaned against the lines, and its total as the page shows it.

import { defaultSelection, formatLineMoney, hasRange, rangeText, rangeTotals, selectLines, splitTotals, totalCents, type LineItem, type LineSelection } from './lineItems';

export function choiceTotal(lines: LineItem[], selection?: Partial<LineSelection> | null) {
  const sel = defaultSelection(lines, selection);
  const split = splitTotals(lines, sel);
  // A price range (migration 063): "$4,000 – $7,500"; total_cents is the low end.
  const ranged = hasRange(selectLines(lines, sel));
  const ends = ranged ? rangeTotals(lines, sel) : null;
  const label = ends ? rangeText(ends.low, ends.high) : split.monthly && !split.oneTime ? `${formatLineMoney(split.monthly)}/mo`
    : split.monthly ? `${formatLineMoney(split.oneTime)} + ${formatLineMoney(split.monthly)}/mo`
    : formatLineMoney(split.oneTime);
  return { selection: sel, total_cents: totalCents(lines, sel), label, ranged };
}
