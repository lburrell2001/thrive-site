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
  // The line under the total: Lauren's own wording, none (''), or from the deposit.
  const deposit = c.paymentTerms !== undefined ? (c.paymentTerms.trim() || null) : depositLine(ctx.depositPercent);
  const hasRows = itemised || c.deliverables.length > 0;
  // Monthly lines (from the price list, description ending "/mo") are shown
  // apart from the one-time total. Only the sums are rendered, never a line.
  const isMonthly = (d: string | null) => /\/\s*mo(nth)?\.?\s*$/i.test((d ?? '').trim());
  const monthlyCents = ctx.lineItems
    .filter((item) => isMonthly(item.description))
    .reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price_cents), 0);
  // Tiers and optional extras (migration 061): the total is the first option
  // with no extras; the client picks theirs when they sign.
  const tierOf = (item: { tier?: string | null }) => item.tier?.trim() || null;
  const tiers = [...new Set(ctx.lineItems.map(tierOf).filter((t): t is string => !!t))];
  const extras = ctx.lineItems.filter((item) => item.is_optional);
  const choices = tiers.length > 0 || extras.length > 0;
  const inOption = (t: string | null) => ctx.lineItems.filter((item) => !item.is_optional && (!tierOf(item) || tierOf(item) === t));
  const sum = (items: typeof ctx.lineItems) => items.reduce((n, item) => n + Math.round(item.quantity * item.unit_price_cents), 0);
  const defaultLines = choices ? inOption(tiers[0] ?? null) : ctx.lineItems;
  const monthlyDefault = defaultLines.filter((item) => isMonthly(item.description)).reduce((n, item) => n + Math.round(item.quantity * item.unit_price_cents), 0);
  const oneTimeCents = choices ? sum(defaultLines) - monthlyDefault : ctx.totalCents - monthlyCents;
  const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="pricing">
      <Kicker>{c.kicker}</Kicker>
      <Markdown source={c.intro} className={styles.prose} />

      {hasRows && <div className={styles.pricingList}>
        {itemised && choices
          ? (() => {
              const row = (item: (typeof ctx.lineItems)[number]) => (
                <div key={item.id} className={styles.pricingRow}>
                  <div className={styles.pricingRowText}>
                    <p className={styles.pricingRowTitle}>{item.label}{item.is_optional ? ' (optional)' : ''}</p>
                    {item.description && stripMo(item.description) && (
                      <p className={styles.pricingRowDescription}>{stripMo(item.description)}</p>
                    )}
                  </div>
                  <div className={styles.pricingRowAmount}>
                    {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}
                    {isMonthly(item.description) ? '/mo' : ''}
                  </div>
                </div>
              );
              const shared = ctx.lineItems.filter((item) => !tierOf(item) && !item.is_optional);
              return (
                <>
                  {shared.length > 0 && tiers.length > 0 && <p className={styles.pricingOptionHead}>Included in every option</p>}
                  {shared.map(row)}
                  {tiers.map((t, i) => (
                    <div key={t}>
                      <p className={styles.pricingOptionHead}><span>Option {i + 1}: {t}</span><span>{formatMoney(sum(inOption(t)), ctx.currency)}</span></p>
                      {ctx.lineItems.filter((item) => tierOf(item) === t && !item.is_optional).map(row)}
                    </div>
                  ))}
                  {extras.length > 0 && <p className={styles.pricingOptionHead}>Optional extras</p>}
                  {extras.map(row)}
                </>
              );
            })()
          : itemised
          ? ctx.lineItems.map((item) => (
              <div key={item.id} className={styles.pricingRow}>
                <div className={styles.pricingRowText}>
                  <p className={styles.pricingRowTitle}>{item.label}</p>
                  {item.description && stripMo(item.description) && (
                    <p className={styles.pricingRowDescription}>{stripMo(item.description)}</p>
                  )}
                </div>
                <div className={styles.pricingRowAmount}>
                  {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}
                  {isMonthly(item.description) ? '/mo' : ''}
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

      {!itemised && choices && (
        <div className={styles.pricingList}>
          {tiers.map((t, i) => (
            <p key={t} className={styles.pricingOptionHead}><span>Option {i + 1}: {t}</span><span>{formatMoney(sum(inOption(t)), ctx.currency)}</span></p>
          ))}
          {extras.length > 0 && <p className={styles.pricingOptionHead}>Optional extras</p>}
          {extras.map((item) => (
            <div key={item.id} className={styles.pricingRow}>
              <div className={styles.pricingRowText}>
                <p className={styles.pricingRowTitle}>{item.label}</p>
                {item.description && stripMo(item.description) && <p className={styles.pricingRowDescription}>{stripMo(item.description)}</p>}
              </div>
              <div className={styles.pricingRowAmount}>
                {formatMoney(Math.round(item.quantity * item.unit_price_cents), ctx.currency)}{isMonthly(item.description) ? '/mo' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.pricingTotal}>
        <span className={styles.pricingTotalLabel}>{c.totalLabel}</span>
        <div className={styles.pricingTotalRight}>
          <div className={styles.pricingTotalValue}>
            {monthlyCents > 0 && oneTimeCents <= 0
              ? `${formatMoney(monthlyCents, ctx.currency)}/mo`
              : formatMoney(oneTimeCents, ctx.currency)}
          </div>
          {monthlyCents > 0 && oneTimeCents > 0 && (
            <div className={styles.pricingDeposit}>+ {formatMoney(monthlyCents, ctx.currency)}/mo</div>
          )}
          {choices && <div className={styles.pricingDeposit}>{tiers[0] ? `${tiers[0]}${extras.length ? ', no extras' : ''}` : 'Without extras'} · choose yours when you sign</div>}
          {deposit && <div className={styles.pricingDeposit}>{deposit}</div>}
        </div>
      </div>

      {c.footnote && <Markdown source={c.footnote} className={styles.pricingFootnote} />}
    </Page>
  );
}
