import styles from '../proposal.module.css';
import { Markdown } from '@/lib/miniMarkdown';
import { ClippedHeading, Kicker, Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { NarrativeBlock } from '@/types/proposal';

export function NarrativeBlockView({ block, ctx, startsPage }: BlockProps<NarrativeBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="narrative">
      <ClippedHeading
        line1={c.headingLine1}
        line2={c.headingLine2}
        weights={ctx.headingWeights}
      />
      <Kicker>{c.kicker}</Kicker>
      <Markdown source={c.body} className={styles.prose} />
    </Page>
  );
}
