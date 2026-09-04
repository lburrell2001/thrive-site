import styles from '../proposal.module.css';
import { ClippedHeading, Page } from '../Page';
import { imageUrl, resolveAccent, type BlockProps } from '../context';
import type { MoodboardBlock } from '@/types/proposal';

export function MoodboardBlockView({ block, ctx, startsPage }: BlockProps<MoodboardBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;

  return (
    <Page ctx={ctx} accent={accent} startsPage={startsPage} type="moodboard">
      <ClippedHeading
        line1={c.headingLine1}
        line2={c.headingLine2}
        weights={ctx.headingWeights}
      />

      <div className={styles.moodGrid}>
        {c.images.map((image, i) => {
          const url = imageUrl(ctx, image.path);
          return (
            <figure
              key={i}
              className={`${styles.moodCell} ${image.span === 2 ? styles.moodCellWide : ''}`}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL, unoptimized by design
                <img src={url} alt={image.alt} className={styles.moodImage} />
              ) : (
                <div className={styles.moodPlaceholder}>{image.alt || 'Image'}</div>
              )}
            </figure>
          );
        })}
      </div>

      {c.caption && (
        <div className={styles.moodCaptionRow}>
          <p className={styles.moodCaption}>{c.caption}</p>
        </div>
      )}
    </Page>
  );
}
