import styles from '../proposal.module.css';
import { Kicker, Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { PhasesBlock } from '@/types/proposal';

/**
 * A coloured chip naming the phase, paired with a bar carrying what happens
 * in it. The chip and the bar are different colours so the sequence reads
 * down the left edge at a glance.
 */
export function PhasesBlockView({ block, ctx, startsPage }: BlockProps<PhasesBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="phases">
      <Kicker>{c.kicker}</Kicker>
      <ol className={styles.phaseGrid}>
        {c.phases.map((phase, i) => (
          <li key={i} className={styles.phaseItem}>
            <div className={styles.phaseChip}>
              <p className={styles.phaseLabel}>{phase.label || `Phase ${i + 1}`}</p>
              {phase.name && <p className={styles.phaseName}>{phase.name}</p>}
            </div>
            <div className={styles.phaseBody}>
              <p className={styles.phaseDescription}>{phase.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Page>
  );
}
