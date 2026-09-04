/**
 * The design's own knobs.
 *
 * Every value here is a coefficient inside a fixed expression, never a raw
 * pixel size — so tuning changes the proportion and the document still holds
 * together on Letter, at 375px, and in the builder's preview pane. That is
 * the whole reason this is a set of sliders rather than a drag-and-drop
 * canvas.
 *
 * Whatever you land on gets pasted into styles/proposal-tokens.css and the
 * template is locked.
 */

export interface Tunable {
  /** CSS custom property this drives. */
  variable: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  /** Builds the property value from the slider number. */
  render: (value: number) => string;
  /** How to show the number next to the label. */
  format?: (value: number) => string;
}

export interface TunableGroup {
  id: string;
  label: string;
  /** Clicking an element whose class contains one of these selects this group. */
  matches: string[];
  tunables: Tunable[];
}

const px = (v: number) => `${v}px`;

const WEIGHT_NAMES: Record<number, string> = {
  200: 'extra light',
  300: 'light',
  400: 'regular',
  500: 'medium',
  600: 'semibold',
  700: 'bold',
};

export const TUNABLE_GROUPS: TunableGroup[] = [
  {
    id: 'heading',
    label: 'Headings',
    matches: ['headingLine', 'headingClip', 'coverHeading'],
    tunables: [
      {
        variable: '--heading-fill',
        label: 'Width covered',
        hint: 'Share of the measure an interior heading line spans. The cover always spans it all.',
        min: 0.5, max: 1, step: 0.01, initial: 1,
        render: (v) => String(v),
        format: (v) => `${Math.round(v * 100)}%`,
      },
      {
        variable: '--heading-overlap',
        label: 'Line overlap',
        hint: 'Line-height. Below the 0.70 cap height, line 2 rises into line 1.',
        min: 0.45, max: 1, step: 0.01, initial: 0.64,
        render: (v) => String(v),
        format: (v) => `${Math.round((0.7 - v) * 143)}% of cap`,
      },
      {
        variable: '--heading-weight-1',
        label: 'Line 1 weight',
        hint: 'Bai Jamjuree runs 200 (extra light) to 700 (bold).',
        min: 200, max: 700, step: 100, initial: 700,
        render: (v) => String(v),
        format: (v) => `${v} · ${WEIGHT_NAMES[v] ?? ''}`,
      },
      {
        variable: '--heading-weight-2',
        label: 'Line 2 weight',
        min: 200, max: 700, step: 100, initial: 500,
        render: (v) => String(v),
        format: (v) => `${v} · ${WEIGHT_NAMES[v] ?? ''}`,
      },
      {
        variable: '--heading-size',
        label: 'Interior heading size',
        hint: 'Every page heading except the cover is set at this. A heading too long to fit shrinks.',
        min: 5, max: 22, step: 0.25, initial: 12,
        render: (v) => `clamp(24px, ${v}cqw, 100px)`,
        format: (v) => `${v}cqw`,
      },
      {
        variable: '--display-2-max',
        label: 'Cover size ceiling',
        hint: 'Below about 19cqw the cover stops spanning the full width.',
        min: 10, max: 40, step: 0.5, initial: 20,
        render: (v) => `${v}cqw`,
        format: (v) => `${v}cqw`,
      },
    ],
  },
  {
    id: 'cover',
    label: 'Cover photo',
    matches: ['coverFigure', 'coverImage', 'coverCaption'],
    tunables: [
      {
        variable: '--cover-ratio',
        label: 'Shape',
        hint: 'Width ÷ height. Higher is shorter.',
        min: 1, max: 3.5, step: 0.05, initial: 1.05,
        render: (v) => `${v} / 1`,
        format: (v) => `${v.toFixed(2)} : 1`,
      },
      {
        variable: '--cover-offset',
        label: 'Vertical position',
        hint: 'Below zero the heading tucks behind the photo; above it, the photo sits clear.',
        min: -0.25, max: 0.3, step: 0.005, initial: 0.09,
        render: (v) => String(v),
        format: (v) => (v < 0 ? `tucked ${Math.abs(v).toFixed(3)}` : `clear ${v.toFixed(3)}`),
      },
      {
        variable: '--cover-brightness',
        label: 'Darkness',
        min: 0.2, max: 1, step: 0.01, initial: 0.55,
        render: (v) => String(v),
        format: (v) => `${Math.round(v * 100)}%`,
      },
      {
        variable: '--cover-tint',
        label: 'Duotone strength',
        min: 0, max: 1, step: 0.01, initial: 1,
        render: (v) => String(v),
        format: (v) => `${Math.round(v * 100)}%`,
      },
    ],
  },
  {
    id: 'page',
    label: 'Page margins',
    matches: ['page', 'runningHeader'],
    tunables: [
      {
        variable: '--pad-inline',
        label: 'Side margin',
        min: 2, max: 12, step: 0.1, initial: 5.4,
        render: (v) => `clamp(18px, ${v}cqw, 64px)`,
        format: (v) => `${v.toFixed(1)}cqw`,
      },
      {
        variable: '--pad-block',
        label: 'Top and bottom margin',
        min: 1.5, max: 9, step: 0.1, initial: 3.5,
        render: (v) => `clamp(20px, ${v}cqw, 40px)`,
        format: (v) => `${v.toFixed(1)}cqw`,
      },
    ],
  },
  {
    id: 'type',
    label: 'Body type',
    matches: ['prose', 'panelBody', 'kicker', 'featureDescription', 'actionDescription'],
    tunables: [
      {
        variable: '--body',
        label: 'Body size',
        min: 0.8, max: 2, step: 0.02, initial: 1.2,
        render: (v) => `clamp(9.5px, ${v}cqw, 12px)`,
        format: (v) => `${v.toFixed(2)}cqw`,
      },
      {
        variable: '--lede',
        label: 'Intro size',
        min: 0.9, max: 2.2, step: 0.02, initial: 1.3,
        render: (v) => `clamp(10.5px, ${v}cqw, 13px)`,
        format: (v) => `${v.toFixed(2)}cqw`,
      },
      {
        variable: '--label',
        label: 'Label size',
        min: 0.7, max: 1.8, step: 0.02, initial: 1.12,
        render: (v) => `clamp(8px, ${v}cqw, 10.5px)`,
        format: (v) => `${v.toFixed(2)}cqw`,
      },
    ],
  },
  {
    id: 'panels',
    label: 'Panels',
    matches: ['panel', 'featureItem', 'pricingRow', 'phaseBody', 'phaseChip', 'timelineItem'],
    tunables: [
      {
        variable: '--panel-radius',
        label: 'Corner radius',
        min: 0, max: 24, step: 1, initial: 10,
        render: px,
        format: px,
      },
    ],
  },
];

/** Every tunable, flattened, for building the export. */
export const ALL_TUNABLES: Tunable[] = TUNABLE_GROUPS.flatMap((g) => g.tunables);

export function initialValues(): Record<string, number> {
  return Object.fromEntries(ALL_TUNABLES.map((t) => [t.variable, t.initial]));
}

/**
 * What to hand back so the template can be locked. Only what changed.
 *
 * Heading weights are called out separately: the renderer measures each line
 * at the weight it is set in, so they live in TypeScript
 * (lib/displayMetrics.ts) as well as the stylesheet.
 */
export function exportCss(values: Record<string, number>): string {
  const changed = ALL_TUNABLES.filter((t) => values[t.variable] !== t.initial);
  if (changed.length === 0) return '/* Nothing changed yet. */';

  const weights = changed.filter((t) => t.variable.startsWith('--heading-weight'));
  const rest = changed.filter((t) => !t.variable.startsWith('--heading-weight'));

  const out: string[] = [];
  if (rest.length > 0) {
    out.push('.thriveProposal {');
    out.push(...rest.map((t) => `  ${t.variable}: ${t.render(values[t.variable])};`));
    out.push('}');
  }
  if (weights.length > 0) {
    if (out.length) out.push('');
    out.push('/* HEADING_WEIGHTS in lib/displayMetrics.ts: */');
    out.push(
      `{ line1: ${values['--heading-weight-1']}, line2: ${values['--heading-weight-2']} }`,
    );
  }
  return out.join('\n');
}
