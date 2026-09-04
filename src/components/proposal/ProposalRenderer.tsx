import '@/styles/proposal-tokens.css';
import styles from './proposal.module.css';

import type {
  ProposalBlock,
  ProposalLineItem,
  ProposalTheme,
} from '@/types/proposal';
import type { RenderContext, RenderMode } from './context';
import { HEADING_WEIGHTS, type HeadingWeights } from '@/lib/displayMetrics';

import { CoverBlockView } from './blocks/CoverBlockView';
import { NarrativeBlockView } from './blocks/NarrativeBlockView';
import { FeatureListBlockView } from './blocks/FeatureListBlockView';
import { MoodboardBlockView } from './blocks/MoodboardBlockView';
import { ShowcaseBlockView } from './blocks/ShowcaseBlockView';
import { PricingBlockView } from './blocks/PricingBlockView';
import { PhasesBlockView } from './blocks/PhasesBlockView';
import { SplitNarrativeBlockView } from './blocks/SplitNarrativeBlockView';
import { ActionItemsBlockView } from './blocks/ActionItemsBlockView';
import { DeliveryTimelineBlockView } from './blocks/DeliveryTimelineBlockView';
import { SignatureBlockView } from './blocks/SignatureBlockView';

export interface ProposalRendererProps {
  blocks: ProposalBlock[];
  theme?: ProposalTheme;
  /** Web is a continuous scroll; print lays the same blocks onto Letter pages. */
  mode?: RenderMode;
  currency?: string;
  totalCents?: number;
  lineItems?: ProposalLineItem[];
  /** Storage path -> signed URL. Paths with no entry render a labelled placeholder. */
  imageUrls?: Record<string, string>;
  /** Falls back to the theme, then to the studio name. */
  agencyName?: string;
  /** Right side of the running header — usually the proposal date. */
  headerNote?: string;
  /** Overrides the document's heading weights — used by the design tuner. */
  headingWeights?: HeadingWeights;
}

/**
 * The only proposal renderer. The public client view, the admin preview, and
 * the PDF page all mount this component; nothing forks it. Web and print
 * differ by the `mode` prop and the @media print rules in the stylesheet.
 */
export function ProposalRenderer({
  blocks,
  theme = {},
  mode = 'web',
  currency = 'USD',
  totalCents = 0,
  lineItems = [],
  imageUrls = {},
  agencyName,
  headerNote = '',
  headingWeights = HEADING_WEIGHTS,
}: ProposalRendererProps) {
  const ctx: RenderContext = {
    mode,
    theme,
    currency,
    totalCents,
    lineItems: [...lineItems].sort((a, b) => a.position - b.position),
    imageUrls,
    agencyName: agencyName ?? theme.agencyName ?? 'Thrive Creative Studios',
    headerNote: headerNote || theme.headerNote || '',
    headingWeights,
  };

  const ordered = blocks
    .filter((block) => block.visible)
    .sort((a, b) => a.position - b.position);

  return (
    <article
      className={`thriveProposal ${styles.proposal} ${
        mode === 'print' ? styles.modePrint : styles.modeWeb
      }`}
      data-accent={theme.accent ?? 'magenta'}
    >
      {ordered.map((block) => (
        <BlockView key={block.id} block={block} ctx={ctx} startsPage={startsPage(block)} />
      ))}
    </article>
  );
}

/**
 * A block opens a new page when it carries a display heading. Everything
 * without one — a feature list, a pricing table, a signature line — flows on
 * beneath the block above it, which is how the printed proposal reads: one
 * heading per sheet, with its content under it.
 */
function startsPage(block: ProposalBlock): boolean {
  switch (block.type) {
    case 'cover':
      return true;
    case 'narrative':
    case 'moodboard':
      return Boolean(block.content.headingLine1 || block.content.headingLine2);
    default:
      return false;
  }
}

function BlockView({
  block,
  ctx,
  startsPage,
}: {
  block: ProposalBlock;
  ctx: RenderContext;
  startsPage: boolean;
}) {
  switch (block.type) {
    case 'cover':
      return <CoverBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'narrative':
      return <NarrativeBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'feature_list':
      return <FeatureListBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'moodboard':
      return <MoodboardBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'showcase':
      return <ShowcaseBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'pricing':
      return <PricingBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'phases':
      return <PhasesBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'split_narrative':
      return <SplitNarrativeBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'action_items':
      return <ActionItemsBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'delivery_timeline':
      return <DeliveryTimelineBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    case 'signature':
      return <SignatureBlockView block={block} ctx={ctx} startsPage={startsPage} />;
    default: {
      // Exhaustiveness check — adding a BlockType without a component
      // becomes a compile error here rather than a blank page in front
      // of a client.
      const never: never = block;
      void never;
      return null;
    }
  }
}
