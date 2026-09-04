import styles from '../proposal.module.css';
import { Markdown } from '@/lib/miniMarkdown';
import { Kicker, Page } from '../Page';
import { imageUrl, resolveAccent, type BlockProps } from '../context';
import type { ShowcaseBlock } from '@/types/proposal';

export function ShowcaseBlockView({ block, ctx, startsPage }: BlockProps<ShowcaseBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="showcase">
      <Kicker>{c.kicker}</Kicker>
      <Markdown source={c.intro} className={styles.prose} />

      <div className={styles.showcaseGrid}>
        {c.cards.map((card, i) => {
          const url = imageUrl(ctx, card.imagePath);
          return (
            <figure key={i}>
              <div className={styles.showcaseFrame}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL, unoptimized by design
                  <img src={url} alt={card.title} className={styles.showcaseImage} />
                ) : (
                  <div className={styles.moodPlaceholder}>{card.title || 'Image'}</div>
                )}
              </div>
              <figcaption>
                <h3 className={styles.showcaseTitle}>{card.title}</h3>
                <p className={styles.showcaseSubtitle}>{card.subtitle}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </Page>
  );
}
