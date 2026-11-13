import styles from '../proposal.module.css';
import { ClippedHeading, Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { TimelineBlock } from '@/types/proposal';

/**
 * A vertical timeline. Each step hangs off a rule down the left: a dot in the
 * accent, the dates in the accent, a bold title and one line under it. The
 * last step's dot is filled solid so the run reads as arriving somewhere.
 */
export function TimelineBlockView({ block, ctx, startsPage }: BlockProps<TimelineBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;
  const entries = c.entries.filter((e) => e.when.trim() || e.title.trim() || e.description.trim());

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="timeline">
      <ClippedHeading line1={c.headingLine1} line2={c.headingLine2} weights={ctx.headingWeights} />
      {c.intro?.trim() && <p className={styles.tlIntro}>{c.intro.trim()}</p>}
      <ol className={styles.tlList}>
        {entries.map((entry, i) => (
          <li key={i} className={styles.tlItem}>
            <span className={styles.tlDot} aria-hidden />
            {entry.when.trim() && <p className={styles.tlWhen}>{entry.when.trim()}</p>}
            {entry.title.trim() && <p className={styles.tlTitle}>{entry.title.trim()}</p>}
            {entry.description.trim() && <p className={styles.tlBody}>{entry.description.trim()}</p>}
          </li>
        ))}
      </ol>
    </Page>
  );
}
