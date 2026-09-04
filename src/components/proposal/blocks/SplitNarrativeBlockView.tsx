import styles from '../proposal.module.css';
import { Markdown } from '@/lib/miniMarkdown';
import { Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { SplitNarrativeBlock } from '@/types/proposal';

export function SplitNarrativeBlockView({ block, ctx, startsPage }: BlockProps<SplitNarrativeBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="split_narrative">
      <div className={styles.splitGrid}>
        {[c.left, c.right].map((column, i) => (
          <div key={i}>
            <h2 className={styles.splitHeading}>{column.heading}</h2>
            <Markdown source={column.body} className={styles.prose} />
          </div>
        ))}
      </div>
    </Page>
  );
}
