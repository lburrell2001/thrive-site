import type {
  ProposalBlock,
  ProposalLineItem,
  ProposalTheme,
  AccentName,
} from '@/types/proposal';
import type { HeadingWeights } from '@/lib/displayMetrics';

export type RenderMode = 'web' | 'print';

/** Everything a block component needs beyond its own row. */
export interface RenderContext {
  mode: RenderMode;
  theme: ProposalTheme;
  currency: string;
  totalCents: number;
  lineItems: ProposalLineItem[];
  /** Storage path -> signed URL, minted server-side. Missing = show a placeholder. */
  imageUrls: Record<string, string>;
  /** Running-header text, repeated on every page. */
  agencyName: string;
  headerNote: string;
  /**
   * Weights the two display lines are set in. Carried here because a heading
   * is sized from its own measured width, and that width depends on weight —
   * so the value used to measure has to be the value used to render.
   */
  headingWeights: HeadingWeights;
}

export interface BlockProps<B extends ProposalBlock = ProposalBlock> {
  block: B;
  ctx: RenderContext;
  /**
   * True when this block opens a page. A block with a display heading starts
   * a fresh sheet and carries the running header; everything after it flows
   * on beneath, which is how the printed document is laid out.
   */
  startsPage?: boolean;
}

const ACCENTS: AccentName[] = ['green', 'orange', 'magenta', 'purple', 'blue'];

/** Per-block accent wins; otherwise the proposal theme; otherwise lime. */
export function resolveAccent(block: ProposalBlock, theme: ProposalTheme): AccentName {
  const candidate = block.accent ?? theme.accent;
  return candidate && ACCENTS.includes(candidate) ? candidate : 'magenta';
}

export function imageUrl(ctx: RenderContext, path: string | null | undefined): string | null {
  if (!path) return null;
  return ctx.imageUrls[path] ?? null;
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
