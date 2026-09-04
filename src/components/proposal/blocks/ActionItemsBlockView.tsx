import styles from '../proposal.module.css';
import { Kicker, Page } from '../Page';
import { resolveAccent, type BlockProps } from '../context';
import type { ActionItemsBlock } from '@/types/proposal';

export function ActionItemsBlockView({ block, ctx, startsPage }: BlockProps<ActionItemsBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="action_items">
      <Kicker>{c.kicker}</Kicker>
      <ol className={styles.actionList}>
        {c.items.map((item, i) => (
          <li key={i} className={styles.actionItem}>
            <span className={styles.actionNumber} aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h3 className={styles.actionTitle}>{item.title}</h3>
              <p className={styles.actionDescription}>{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {c.closing && <p className={styles.actionClosing}>{c.closing}</p>}
    </Page>
  );
}
