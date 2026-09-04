import styles from '../proposal.module.css';
import { Page, displayLine, headingStyle } from '../Page';
import { imageUrl, resolveAccent, type BlockProps } from '../context';
import type { CoverBlock } from '@/types/proposal';

/**
 * Cover page: running header, the display heading, then a contained duotone
 * photograph whose top edge cuts across the tail of line 2, and the
 * prepared-for / prepared-by line along the bottom.
 *
 * The photograph is a block on the page, not the page's background — the
 * page itself stays black.
 */
export function CoverBlockView({ block, ctx, startsPage }: BlockProps<CoverBlock>) {
  const accent = resolveAccent(block, ctx.theme);
  const c = block.content;
  const hero = imageUrl(ctx, c.heroImagePath);
  const titleLine1 = displayLine(c.titleLine1);
  const titleLine2 = displayLine(c.titleLine2);

  return (
    <Page ctx={ctx} accent={accent} bare startsPage={startsPage} type="cover">
      {/* --l2-em lives on the wrapper so the photograph's overlap can be
          derived from line 2's computed size as well as the heading itself. */}
      <div className={styles.cover} style={headingStyle(titleLine1, titleLine2, 'perLine', ctx.headingWeights)}>
        <header className={styles.coverHeader}>
          <span>{ctx.agencyName}</span>
          <span>{c.dateLabel || ctx.headerNote}</span>
        </header>

        {c.eyebrow && <p className={styles.coverEyebrow}>{c.eyebrow}</p>}

        <h1 className={styles.coverHeading}>
          {titleLine1 && <span className={styles.headingLine1}>{titleLine1}</span>}
          {titleLine2 && <span className={styles.headingLine2}>{titleLine2}</span>}
        </h1>

        <figure className={styles.coverFigure}>
          {hero ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, unoptimized by design */}
              <img src={hero} alt="" className={styles.coverImage} />
              {c.heroOverlay !== 'none' && (
                <>
                  <div className={styles.coverImageTint} data-accent={c.heroOverlay} />
                  <div className={styles.coverImageShade} />
                </>
              )}
            </>
          ) : (
            <div className={styles.moodPlaceholder}>Cover image</div>
          )}

          {/* The project name sits over the image; older covers put the
              subtitle there, so fall back to it rather than going blank. */}
          {(c.projectName || c.subtitle) && (
            <figcaption className={styles.coverCaption}>
              {c.projectName || c.subtitle}
            </figcaption>
          )}
        </figure>

        {c.tagline && <p className={styles.coverTagline}>{c.tagline}</p>}

        {c.stats && c.stats.length > 0 && (
          <div className={styles.coverStats}>
            {c.stats.map((stat, i) => (
              <div key={i}>
                <div className={styles.coverStatValue}>{stat.value}</div>
                <div className={styles.coverStatLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.coverMeta}>
          <div>
            <div className={styles.coverMetaLabel}>Prepared for:</div>
            <div className={styles.coverMetaValue}>{c.preparedFor}</div>
          </div>
          <div className={styles.coverMetaRight}>
            <div className={styles.coverMetaLabel}>Prepared by:</div>
            <div className={styles.coverMetaValue}>{c.preparedBy}</div>
          </div>
        </div>
      </div>
    </Page>
  );
}
