import type { CSSProperties, ReactNode } from 'react';
import { HEADING_WEIGHTS, displayWidthEm, type HeadingWeights } from '@/lib/displayMetrics';
import styles from './proposal.module.css';
import type { RenderContext } from './context';
import type { AccentName } from '@/types/proposal';

/**
 * One block on the page. Owns the running header, the accent scope, and the
 * overflow:hidden that lets an oversized heading line clip at the page edge.
 */
export function Page({
  ctx,
  accent,
  children,
  bare = false,
  startsPage = true,
  type,
}: {
  ctx: RenderContext;
  accent: AccentName;
  children: ReactNode;
  /** Cover pages paint edge to edge and supply their own padding. */
  bare?: boolean;
  /** Opens a new sheet and carries the running header. */
  startsPage?: boolean;
  /** Lets the stylesheet pair particular blocks into columns. */
  type?: string;
}) {
  return (
    <section
      className={`${styles.page} ${startsPage ? styles.pageStart : styles.pageContinues}`}
      data-accent={accent}
      data-type={type}
    >
      {!bare && startsPage && <RunningHeader ctx={ctx} />}
      {children}
    </section>
  );
}

export function RunningHeader({ ctx }: { ctx: RenderContext }) {
  return (
    <header className={styles.runningHeader}>
      <span>{ctx.agencyName}</span>
      <span className={styles.runningHeaderNote}>{ctx.headerNote}</span>
    </header>
  );
}

export function Kicker({ children }: { children?: string }) {
  if (!children) return null;
  return <p className={styles.kicker}>{children}</p>;
}

/**
 * The signature move: line 1 white and contained, line 2 in the accent and
 * large enough to bleed past the page edge, cropped by overflow:hidden.
 */
export function ClippedHeading({
  line1,
  line2,
  weights = HEADING_WEIGHTS,
}: {
  line1: string;
  line2: string;
  weights?: HeadingWeights;
}) {
  // Rendered trimmed, because that is what headingStyle measures. A stray
  // trailing space typed into the builder is invisible in the field but a
  // whole space wide on the page, which would push the line past its box.
  const l1 = line1.trim();
  const l2 = line2.trim();
  if (!l1 && !l2) return null;
  return (
    <h2 className={styles.headingClip} style={headingStyle(l1, l2, 'shared', weights)}>
      {l1 && <span className={styles.headingLine1}>{l1}</span>}
      {l2 && <span className={styles.headingLine2}>{l2}</span>}
    </h2>
  );
}

/**
 * Sizes both heading lines.
 *
 * Each line is set to fill the page's content width on its own, so the two
 * stack as one block of type with a common left and right edge. That means
 * they take different point sizes — a short word like PROJECT needs more
 * size than PROPOSAL to cover the same distance — which is what makes the
 * pair read as matched rather than one trailing off short.
 *
 * Widths come from summing the face's real advance widths rather than
 * counting characters, because "WORK" is far wider per letter than
 * "PRICING". Returned as custom properties so the spans, and the cover
 * photograph's overlap, all derive from the same numbers.
 */
export function headingStyle(
  line1: string,
  line2: string,
  mode: 'perLine' | 'shared' = 'perLine',
  weights: HeadingWeights = HEADING_WEIGHTS,
): CSSProperties {
  // Measured at the weight each line is rendered in, and the weights are set
  // here too, so the two can never drift apart.
  const em1 = displayWidthEm(line1.trim(), weights.line1);
  const em2 = displayWidthEm(line2.trim(), weights.line2);
  const weightVars = {
    '--heading-weight-1': weights.line1,
    '--heading-weight-2': weights.line2,
  };

  // 'shared' sets both lines at one size, taken from the wider of the two,
  // so the longer line reaches the page edge and the shorter sits under it
  // at matching scale. That is how the interior pages are set.
  //
  // 'perLine' sizes each line to fill the width on its own, so both share a
  // right-hand edge at different point sizes. That is the cover treatment.
  if (mode === 'shared') {
    // Both lines take one size, from the wider of the two. How much of the
    // measure that size covers is --heading-fill, set in CSS so it can be
    // tuned without a redeploy.
    const widest = Math.max(em1, em2);
    return { ...weightVars, '--l1-em': widest, '--l2-em': widest } as CSSProperties;
  }

  return { ...weightVars, '--l1-em': em1, '--l2-em': em2 } as CSSProperties;
}

/** Trim for display so what is drawn matches what headingStyle measured. */
export function displayLine(value: string): string {
  return value.trim();
}
