import styles from '../proposal.module.css';
import { Kicker, Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { FeatureListBlock } from '@/types/proposal';

export function FeatureListBlockView({ block, ctx, startsPage }: BlockProps<FeatureListBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="feature_list">
      <Kicker>{c.kicker}</Kicker>
      <div className={styles.featureGrid}>
        {c.items.map((item, i) => (
          <div key={i} className={styles.featureItem}>
            <h3 className={styles.featureTitle}>{item.title}</h3>
            <p className={styles.featureDescription}>{item.description}</p>
          </div>
        ))}
      </div>
    </Page>
  );
}
