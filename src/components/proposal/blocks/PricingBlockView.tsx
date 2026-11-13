import styles from '../proposal.module.css';
import { Markdown } from '@/lib/miniMarkdown';
import { Kicker, Page } from '../Page';
import { depositLine, formatMoney, resolveAccent, type BlockProps } from '../context';
import type { PricingBlock } from '@/types/proposal';
import { proposalPhases } from '@/lib/proposalChoices';

/**
 * Pricing is the one block where the default is to show the client LESS.
 *
 * With `showLineItemPrices` off (the default), the rows rendered come from
 * `content.deliverables`, which carries no money at all — the per-item
 * amounts live in `proposal_line_items` and are simply not reached. A price
 * cannot leak through this path by accident, only by Lauren turning the
 * toggle on. The total is always shown.
 */
export function PricingBlockView({ block, ctx, startsPage }: BlockProps<PricingBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;
  const itemised = c.showLineItemPrices && ctx.lineItems.length > 0;
  // The line under the total: Lauren's own wording, none (''), or from the deposit.
  const deposit = c.paymentTerms !== undefined ? (c.paymentTerms.trim() || null) : depositLine(ctx.depositPercent);
  const hasRows = itemised || c.deliverables.length > 0;
  // Monthly lines (from the price list, description ending "/mo") are shown
  // apart from the one-time total. Only the sums are rendered, never a line.
  const isMonthly = (d: string | null) => /\/\s*mo(nth)?\.?\s*$/i.test((d ?? '').trim());
  const monthlyCents = ctx.lineItems
    .filter((item) => isMonthly(item.description))
    .reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price_cents), 0);
  // Tiers and optional extras (migration 061): with tiers the total is the
  // lowest option ("Starting at"); the client picks theirs when they approve.
  const tierOf = (item: { tier?: string | null }) => item.tier?.trim() || null;
  const tiers = [...new Set(ctx.lineItems.map(tierOf).filter((t): t is string => !!t))];
  const extras = ctx.lineItems.filter((item) => item.is_optional);
  const choices = tiers.length > 0 || extras.length > 0;
  const inOption = (t: string | null) => ctx.lineItems.filter((item) => !item.is_optional && (!tierOf(item) || tierOf(item) === t));
  const sum = (items: typeof ctx.lineItems) => items.reduce((n, item) => n + Math.round(item.quantity * item.unit_price_cents), 0);
  const defaultLines = choices ? inOption(tiers[0] ?? null) : ctx.lineItems;
  const lowest = tiers.length ? tiers.reduce((best, t) => (sum(inOption(t)) < sum(inOption(best)) ? t : best), tiers[0]) : null;
  const shownLines = choices ? inOption(lowest) : defaultLines;
  const oneTimeCents = choices ? sum(shownLines) - shownLines.filter((item) => isMonthly(item.description)).reduce((n, item) => n + Math.round(item.quantity * item.unit_price_cents), 0) : ctx.totalCents - monthlyCents;
  const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');
  // How many of a per-unit item, when it's more than one: "Additional screen × 6", "$150 each" under the price.
  const qtyOf = (item: { quantity: number }) => (Number(item.quantity) !== 1 ? String(Number(item.quantity)) : null);
  // Phases (migration 062): each phase's lines, subtotal and payment terms — no grand total.
  const phases = proposalPhases(ctx.lineItems, c.phaseTimelines);
  if (phases) {
    const sorted = [...ctx.lineItems].sort((a, b) => a.position - b.position);
    return (
      <Page ctx={ctx} accent={accent} startsPage={startsPage} type="pricing">
        <Kicker>{c.kicker}</Kicker>
        <Markdown source={c.intro} className={styles.prose} />
        {phases.map((ph, n) => (
          <div key={ph.name} className={styles.pricingPhase}>
            <div className={styles.pricingList}>
              <p className={styles.pricingOptionHead}><span>Phase {n + 1} · {ph.name}{ph.timeline ? ` · ${ph.timeline}` : ''}</span></p>
              {sorted.filter((item) => item.phase?.trim() === ph.name && item.label.trim()).map((item) => (
                <div key={item.id} className={styles.pricingRow}>
                  <div className={styles.pricingRowText}>
                    <p className={styles.pricingRowTitle}>{item.label}{qtyOf(item) ? ` × ${qtyOf(item)}` : ''}</p>
                    {item.description && stripMo(item.description) && <p className={styles.pricingRowDescription}>{stripMo(item.description)}</p>}
                  </div>
                  {c.showLineItemPrices && (
                    <div className={styles.pricingRowAmount}>
                      {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}{isMonthly(item.description) ? '/mo' : ''}
                      {qtyOf(item) && <span className={styles.pricingRowQty}>{formatMoney(item.unit_price_cents, ctx.currency)} each</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className={`${styles.pricingTotal} ${styles.pricingPhaseTotal}`}>
              <span className={styles.pricingTotalLabel}>Phase {n + 1}</span>
              <div className={styles.pricingTotalRight}>
                <div className={styles.pricingTotalValue}>
                  {ph.monthly_cents > 0 && ph.total_cents <= 0 ? `${formatMoney(ph.monthly_cents, ctx.currency)}/mo` : formatMoney(ph.total_cents, ctx.currency)}
                </div>
                {ph.monthly_cents > 0 && ph.total_cents > 0 && <div className={styles.pricingDeposit}>+ {formatMoney(ph.monthly_cents, ctx.currency)}/mo</div>}
                <div className={styles.pricingDeposit}>{ph.terms || 'Payment terms to follow'}</div>
              </div>
            </div>
          </div>
        ))}
        <p className={styles.pricingPhaseNote}>Approve the phases you’re ready for — we’ll send an estimate for each phase before anything is invoiced.</p>
        {c.footnote && <Markdown source={c.footnote} className={styles.pricingFootnote} />}
      </Page>
    );
  }

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="pricing">
      <Kicker>{c.kicker}</Kicker>
      <Markdown source={c.intro} className={styles.prose} />

      {/* The items first (with tiers, each option's own lines tagged), then each option's total, then the extras. */}
      {(hasRows || tiers.length > 0) && <div className={styles.pricingList}>
        {itemised || tiers.length > 0
          ? ctx.lineItems.filter((item) => !item.is_optional).map((item) => (
              <div key={item.id} className={styles.pricingRow}>
                <div className={styles.pricingRowText}>
                  <p className={styles.pricingRowTitle}>
                    {item.label}{qtyOf(item) ? ` × ${qtyOf(item)}` : ''}
                    {tierOf(item) && <span className={styles.pricingTierTag}>{tierOf(item)}</span>}
                  </p>
                  {item.description && stripMo(item.description) && (
                    <p className={styles.pricingRowDescription}>{stripMo(item.description)}</p>
                  )}
                </div>
                {itemised && (
                  <div className={styles.pricingRowAmount}>
                    {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}
                    {isMonthly(item.description) ? '/mo' : ''}
                    {qtyOf(item) && <span className={styles.pricingRowQty}>{formatMoney(item.unit_price_cents, ctx.currency)} each</span>}
                  </div>
                )}
              </div>
            ))
          : c.deliverables.map((item, i) => (
              <div key={i} className={styles.pricingRow}>
                <div className={styles.pricingRowText}>
                  <p className={styles.pricingRowTitle}>{item.title}</p>
                  {item.description && (
                    <p className={styles.pricingRowDescription}>{item.description}</p>
                  )}
                </div>
              </div>
            ))}
      </div>}

      {tiers.length > 0 && (
        <div className={styles.pricingOptions}>
          {tiers.map((t, i) => (
            <div key={t} className={styles.pricingOption}>
              <span className={styles.pricingOptionKicker}>Option {i + 1}</span>
              <span className={styles.pricingOptionName}>{t}</span>
              <span className={styles.pricingOptionTotal}>{formatMoney(sum(inOption(t)), ctx.currency)}</span>
            </div>
          ))}
        </div>
      )}

      {extras.length > 0 && (
        <div className={styles.pricingList}>
          <p className={styles.pricingOptionHead}>Optional extras</p>
          {extras.map((item) => (
            <div key={item.id} className={styles.pricingRow}>
              <div className={styles.pricingRowText}>
                <p className={styles.pricingRowTitle}>{item.label}</p>
                {item.description && stripMo(item.description) && <p className={styles.pricingRowDescription}>{stripMo(item.description)}</p>}
              </div>
              <div className={styles.pricingRowAmount}>
                + {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}{isMonthly(item.description) ? '/mo' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.pricingTotal}>
        <span className={styles.pricingTotalLabel}>{tiers.length > 0 ? 'Starting at' : c.totalLabel}</span>
        <div className={styles.pricingTotalRight}>
          <div className={styles.pricingTotalValue}>
            {monthlyCents > 0 && oneTimeCents <= 0
              ? `${formatMoney(monthlyCents, ctx.currency)}/mo`
              : formatMoney(oneTimeCents, ctx.currency)}
          </div>
          {monthlyCents > 0 && oneTimeCents > 0 && (
            <div className={styles.pricingDeposit}>+ {formatMoney(monthlyCents, ctx.currency)}/mo</div>
          )}
          {choices && <div className={styles.pricingDeposit}>{tiers.length ? 'Choose your option when you approve' : 'Plus any extras you add when you approve'}</div>}
          {deposit && <div className={styles.pricingDeposit}>{deposit}</div>}
        </div>
      </div>

      {c.footnote && <Markdown source={c.footnote} className={styles.pricingFootnote} />}
    </Page>
  );
}
