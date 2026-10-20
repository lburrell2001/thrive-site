import styles from '../proposal.module.css';
import { Markdown } from '@/lib/miniMarkdown';
import { Kicker, Page } from '../Page';
import { depositLine, formatMoney, resolveAccent, type BlockProps } from '../context';
import type { PricingBlock } from '@/types/proposal';

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
  const deposit = depositLine(ctx.depositPercent);
  const hasRows = itemised || c.deliverables.length > 0;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="pricing">
      <Kicker>{c.kicker}</Kicker>
      <Markdown source={c.intro} className={styles.prose} />

      {hasRows && <div className={styles.pricingList}>
        {itemised
          ? ctx.lineItems.map((item) => (
              <div key={item.id} className={styles.pricingRow}>
                <div className={styles.pricingRowText}>
                  <p className={styles.pricingRowTitle}>{item.label}</p>
                  {item.description && (
                    <p className={styles.pricingRowDescription}>{item.description}</p>
                  )}
                </div>
                <div className={styles.pricingRowAmount}>
                  {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}
                </div>
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

      <div className={styles.pricingTotal}>
        <span className={styles.pricingTotalLabel}>{c.totalLabel}</span>
        <div className={styles.pricingTotalRight}>
          <div className={styles.pricingTotalValue}>
            {formatMoney(ctx.totalCents, ctx.currency)}
          </div>
          {deposit && <div className={styles.pricingDeposit}>{deposit}</div>}
        </div>
      </div>

      {c.footnote && <Markdown source={c.footnote} className={styles.pricingFootnote} />}
    </Page>
  );
}
