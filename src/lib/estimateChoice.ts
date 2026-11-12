// A client's choice of tier and extras on an estimate (migration 061): the
// selection cleaned against the lines, and its total as the page shows it.

import { defaultSelection, formatLineMoney, splitTotals, totalCents, type LineItem, type LineSelection } from './lineItems';

export function choiceTotal(lines: LineItem[], selection?: Partial<LineSelection> | null) {
  const sel = defaultSelection(lines, selection);
  const split = splitTotals(lines, sel);
  const label = split.monthly && !split.oneTime ? `${formatLineMoney(split.monthly)}/mo`
    : split.monthly ? `${formatLineMoney(split.oneTime)} + ${formatLineMoney(split.monthly)}/mo`
    : formatLineMoney(split.oneTime);
  return { selection: sel, total_cents: totalCents(lines, sel), label };
}
