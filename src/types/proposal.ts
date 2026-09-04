// Proposal block taxonomy.
//
// A proposal is an ordered list of typed blocks. Every block's `content` is
// stored as JSONB and validated with the matching Zod schema in
// `src/lib/proposalSchemas.ts` on every write.

export type BlockType =
  | 'cover'
  | 'narrative'
  | 'feature_list'
  | 'moodboard'
  | 'showcase'
  | 'pricing'
  | 'phases'
  | 'split_narrative'
  | 'action_items'
  | 'delivery_timeline'
  | 'signature';

export type AccentName = 'green' | 'orange' | 'magenta' | 'purple' | 'blue';
export type OverlayName = AccentName | 'none';

export interface BaseBlock {
  id: string;
  type: BlockType;
  position: number;
  visible: boolean;
  /** Optional per-block accent override; falls back to proposal theme.
   *  Constrained to the four brand accents, matching the CHECK constraint
   *  on proposal_blocks.accent. */
  accent?: AccentName;
}

export interface CoverBlock extends BaseBlock {
  type: 'cover';
  content: {
    eyebrow: string;          // "THRIVE CREATIVE STUDIOS"
    titleLine1: string;       // "PROJECT"
    titleLine2: string;       // "PROPOSAL"
    subtitle: string;         // "FOR DALLAS DERBY DAY"
    dateLabel: string;
    preparedFor: string;
    preparedBy: string;
    heroImagePath: string | null;   // Supabase storage path
    heroOverlay: OverlayName;
    /** Optional line set over the cover image. Falls back to `subtitle`. */
    projectName?: string;
    /** Optional stat strip under the title, as on the reference cover. */
    stats?: { value: string; label: string }[];
    /** Optional line under the subtitle, e.g. the campaign tagline. */
    tagline?: string;
  };
}

export interface NarrativeBlock extends BaseBlock {
  type: 'narrative';
  content: {
    headingLine1: string;
    headingLine2: string;     // second line renders in accent color
    kicker?: string;          // small orange rule label, e.g. "WHAT YOU ARE GETTING"
    body: string;             // markdown
  };
}

export interface FeatureListBlock extends BaseBlock {
  type: 'feature_list';
  content: {
    kicker?: string;
    items: { title: string; description: string }[];
  };
}

export interface MoodboardBlock extends BaseBlock {
  type: 'moodboard';
  content: {
    headingLine1: string;
    headingLine2: string;
    caption: string;                        // the pill label
    images: { path: string; alt: string; span?: 1 | 2 }[];
  };
}

export interface ShowcaseBlock extends BaseBlock {
  type: 'showcase';
  content: {
    kicker?: string;
    intro: string;
    cards: { imagePath: string; title: string; subtitle: string }[];
  };
}

export interface PricingBlock extends BaseBlock {
  type: 'pricing';
  content: {
    kicker?: string;
    intro: string;
    /** When false (default) the client sees deliverables and a single total only */
    showLineItemPrices: boolean;
    deliverables: { title: string; description: string }[];
    totalLabel: string;       // "TOTAL"
    /** Optional fine print under the total, e.g. the revision policy. */
    footnote?: string;
  };
  // amounts live in proposal_line_items, not here
}

export interface PhasesBlock extends BaseBlock {
  type: 'phases';
  content: {
    kicker?: string;
    phases: { label: string; name: string; description: string }[];
  };
}

export interface SplitNarrativeBlock extends BaseBlock {
  type: 'split_narrative';
  content: {
    left: { heading: string; body: string };
    right: { heading: string; body: string };
  };
}

export interface ActionItemsBlock extends BaseBlock {
  type: 'action_items';
  content: {
    kicker?: string;
    items: { title: string; description: string }[];
    /** Optional closing line under the list. */
    closing?: string;
  };
}

export interface DeliveryTimelineBlock extends BaseBlock {
  type: 'delivery_timeline';
  content: {
    kicker?: string;
    milestones: { label: string; description: string }[];
  };
}

export interface SignatureBlock extends BaseBlock {
  type: 'signature';
  content: {
    agencySignerName: string;
    agencySignerTitle: string;
    clientSignerLabel: string;
    termsUrl?: string;
  };
}

export type ProposalBlock =
  | CoverBlock
  | NarrativeBlock
  | FeatureListBlock
  | MoodboardBlock
  | ShowcaseBlock
  | PricingBlock
  | PhasesBlock
  | SplitNarrativeBlock
  | ActionItemsBlock
  | DeliveryTimelineBlock
  | SignatureBlock;

/** Narrow a ProposalBlock to one variant. */
export type BlockOfType<T extends BlockType> = Extract<ProposalBlock, { type: T }>;

export type ProposalStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired';

export interface ProposalTheme {
  /** Default accent for blocks that do not override it. */
  accent?: AccentName;
  /** Agency name in the running header. */
  agencyName?: string;
  /** Right-hand side of the running header. */
  headerNote?: string;
}

export interface ProposalLineItem {
  id: string;
  proposal_id: string;
  label: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  position: number;
}

export interface ProposalClient {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  portal_client_id: string | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  slug: string;
  access_token: string;
  title: string;
  client_id: string | null;
  template_id: string | null;
  status: ProposalStatus;
  proposal_date: string;
  valid_until: string | null;
  currency: string;
  total_cents: number;
  deposit_percent: number;
  theme: ProposalTheme;
  sent_at: string | null;
  first_viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Everything the renderer needs, with no secrets attached. */
export interface RenderableProposal {
  id: string;
  slug: string;
  title: string;
  status: ProposalStatus;
  proposalDate: string;
  validUntil: string | null;
  currency: string;
  totalCents: number;
  depositPercent: number;
  theme: ProposalTheme;
  blocks: ProposalBlock[];
  lineItems: ProposalLineItem[];
  client: ProposalClient | null;
  /** Resolved image URLs keyed by storage path — signed, server-side, short TTL. */
  imageUrls: Record<string, string>;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  cover: 'Cover',
  narrative: 'Narrative',
  feature_list: 'Feature list',
  moodboard: 'Moodboard',
  showcase: 'Showcase',
  pricing: 'Pricing',
  phases: 'Phases',
  split_narrative: 'Split narrative',
  action_items: 'Action items',
  delivery_timeline: 'Delivery timeline',
  signature: 'Signature',
};

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  cover: 'Title, date, prepared-for and prepared-by over a duotone hero image.',
  narrative: 'A two-line heading and a paragraph or two of prose.',
  feature_list: 'Repeating title and description pairs — the scope of work.',
  moodboard: 'An image grid with a single caption pill.',
  showcase: 'Intro plus two to four image cards with a title and subtitle.',
  pricing: 'Deliverables and a total. Line-item prices are hidden by default.',
  phases: 'A numbered sequence of named phases with descriptions.',
  split_narrative: 'Two side-by-side prose columns with their own headings.',
  action_items: 'A numbered checklist of what the client needs to do.',
  delivery_timeline: 'Milestone labels paired with what lands at each one.',
  signature: 'Client approval line, agency signature line, and dates.',
};
