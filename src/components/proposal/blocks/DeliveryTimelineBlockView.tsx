import styles from '../proposal.module.css';
import { Kicker, Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { DeliveryTimelineBlock } from '@/types/proposal';

/** Milestones as filled panels — when it lands, and what lands. */
export function DeliveryTimelineBlockView({ block, ctx, startsPage }: BlockProps<DeliveryTimelineBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="delivery_timeline">
      <Kicker>{c.kicker}</Kicker>
      <dl className={styles.timelineList}>
        {c.milestones.map((milestone, i) => (
          <div key={i} className={styles.timelineItem}>
            <dt className={styles.timelineLabel}>{milestone.label}</dt>
            <dd className={styles.timelineDescription}>{milestone.description}</dd>
          </div>
        ))}
      </dl>
    </Page>
  );
}
