// Zod validation for proposal block content.
//
// One schema per block type, keyed off `type`. Every write path — the builder's
// autosave, the seed script, template instantiation — runs content through
// `parseBlock` / `parseBlocks` before it reaches the database, so a malformed
// block can never be persisted and the renderer never has to defend itself.

import { z } from 'zod';
import type { BlockType, ProposalBlock } from '@/types/proposal';

const accent = z.enum(['green', 'orange', 'magenta', 'purple', 'blue']);
const overlay = z.enum(['green', 'orange', 'magenta', 'purple', 'blue', 'none']);

/**
 * Storage path inside the private `proposal-media` bucket.
 *
 * Empty is allowed: the builder creates a moodboard tile or showcase card
 * before an image is chosen for it, and autosave has to be able to persist
 * that half-finished state. An empty path renders as a labelled placeholder.
 */
const storagePath = z.string().max(500);

/**
 * Titles may be blank. A required title would mean the builder could not save
 * a row the moment it was added, and one empty field anywhere would reject
 * the whole document on autosave. Completeness is a publish-time question,
 * not a write-time one.
 */
const titleDescription = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
});

// ---------------------------------------------------------------- content

const coverContent = z.object({
  eyebrow: z.string().default(''),
  titleLine1: z.string().default(''),
  titleLine2: z.string().default(''),
  subtitle: z.string().default(''),
  dateLabel: z.string().default(''),
  preparedFor: z.string().default(''),
  preparedBy: z.string().default(''),
  heroImagePath: storagePath.nullable().default(null),
  heroOverlay: overlay.default('orange'),
  projectName: z.string().max(160).optional(),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).max(6).optional(),
  tagline: z.string().optional(),
});

const narrativeContent = z.object({
  headingLine1: z.string().default(''),
  headingLine2: z.string().default(''),
  kicker: z.string().optional(),
  body: z.string().default(''),
});

const featureListContent = z.object({
  kicker: z.string().optional(),
  items: z.array(titleDescription).default([]),
});

const moodboardContent = z.object({
  headingLine1: z.string().default(''),
  headingLine2: z.string().default(''),
  caption: z.string().default(''),
  images: z
    .array(
      z.object({
        path: storagePath,
        alt: z.string().default(''),
        span: z.union([z.literal(1), z.literal(2)]).optional(),
      }),
    )
    .default([]),
});

const showcaseContent = z.object({
  kicker: z.string().optional(),
  intro: z.string().default(''),
  cards: z
    .array(
      z.object({
        imagePath: storagePath,
        title: z.string().default(''),
        subtitle: z.string().default(''),
      }),
    )
    .max(4)
    .default([]),
});

const pricingContent = z.object({
  kicker: z.string().optional(),
  intro: z.string().default(''),
  // Deliberately defaults to false: the client sees a single total unless
  // Lauren explicitly turns line-item prices on in the builder.
  showLineItemPrices: z.boolean().default(false),
  deliverables: z.array(titleDescription).default([]),
  totalLabel: z.string().default('TOTAL'),
  footnote: z.string().optional(),
});

const phasesContent = z.object({
  kicker: z.string().optional(),
  phases: z
    .array(
      z.object({
        label: z.string().default(''),
        name: z.string().default(''),
        description: z.string().default(''),
      }),
    )
    .default([]),
});

const splitNarrativeContent = z.object({
  left: z.object({ heading: z.string().default(''), body: z.string().default('') }),
  right: z.object({ heading: z.string().default(''), body: z.string().default('') }),
});

const actionItemsContent = z.object({
  kicker: z.string().optional(),
  items: z.array(titleDescription).default([]),
  closing: z.string().optional(),
});

const deliveryTimelineContent = z.object({
  kicker: z.string().optional(),
  milestones: z
    .array(z.object({ label: z.string().default(''), description: z.string().default('') }))
    .default([]),
});

const signatureContent = z.object({
  agencySignerName: z.string().default(''),
  agencySignerTitle: z.string().default(''),
  clientSignerLabel: z.string().default('Client Approval'),
  termsUrl: z.string().url().optional(),
});

export const BLOCK_CONTENT_SCHEMAS = {
  cover: coverContent,
  narrative: narrativeContent,
  feature_list: featureListContent,
  moodboard: moodboardContent,
  showcase: showcaseContent,
  pricing: pricingContent,
  phases: phasesContent,
  split_narrative: splitNarrativeContent,
  action_items: actionItemsContent,
  delivery_timeline: deliveryTimelineContent,
  signature: signatureContent,
} as const;

export const BLOCK_TYPES = Object.keys(BLOCK_CONTENT_SCHEMAS) as BlockType[];

// ---------------------------------------------------------------- blocks

const base = {
  id: z.string().min(1),
  position: z.number().int().min(0),
  visible: z.boolean().default(true),
  accent: accent.optional(),
};

/** Discriminated union mirroring `ProposalBlock` in types/proposal.ts. */
export const proposalBlockSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('cover'), content: coverContent }),
  z.object({ ...base, type: z.literal('narrative'), content: narrativeContent }),
  z.object({ ...base, type: z.literal('feature_list'), content: featureListContent }),
  z.object({ ...base, type: z.literal('moodboard'), content: moodboardContent }),
  z.object({ ...base, type: z.literal('showcase'), content: showcaseContent }),
  z.object({ ...base, type: z.literal('pricing'), content: pricingContent }),
  z.object({ ...base, type: z.literal('phases'), content: phasesContent }),
  z.object({ ...base, type: z.literal('split_narrative'), content: splitNarrativeContent }),
  z.object({ ...base, type: z.literal('action_items'), content: actionItemsContent }),
  z.object({ ...base, type: z.literal('delivery_timeline'), content: deliveryTimelineContent }),
  z.object({ ...base, type: z.literal('signature'), content: signatureContent }),
]);

export const proposalBlocksSchema = z.array(proposalBlockSchema);

/** Throws a ZodError describing exactly which field is wrong. */
export function parseBlock(input: unknown): ProposalBlock {
  return proposalBlockSchema.parse(input) as ProposalBlock;
}

export function parseBlocks(input: unknown): ProposalBlock[] {
  return proposalBlocksSchema.parse(input) as ProposalBlock[];
}

/**
 * Validate just the `content` half against the schema for `type`. Used by the
 * builder, which knows the block type already and only round-trips content.
 */
export function parseBlockContent(type: BlockType, content: unknown) {
  return BLOCK_CONTENT_SCHEMAS[type].parse(content);
}

/**
 * Drop blocks that fail validation instead of failing the whole render.
 * Read paths use this so one bad row cannot take a client-facing page down;
 * write paths use `parseBlocks`, which throws.
 */
export function parseBlocksLenient(input: unknown): ProposalBlock[] {
  if (!Array.isArray(input)) return [];
  const out: ProposalBlock[] = [];
  for (const raw of input) {
    const result = proposalBlockSchema.safeParse(raw);
    if (result.success) {
      out.push(result.data as ProposalBlock);
    } else {
      console.error('Skipping invalid proposal block', result.error.issues);
    }
  }
  return out;
}

/** A fresh block of the given type with empty-but-valid content. */
export function emptyBlock(type: BlockType, id: string, position: number): ProposalBlock {
  return parseBlock({
    id,
    type,
    position,
    visible: true,
    content: BLOCK_CONTENT_SCHEMAS[type].parse(emptySeed[type]),
  });
}

const emptySeed: Record<BlockType, Record<string, unknown>> = {
  // Every proposal cover reads PROJECT PROPOSAL. The lines stay editable
  // because the invoice and strategy documents will use the same block with
  // their own wording.
  cover: { titleLine1: 'PROJECT', titleLine2: 'PROPOSAL' },
  narrative: {},
  feature_list: { items: [{ title: '', description: '' }] },
  moodboard: { images: [] },
  showcase: { cards: [] },
  pricing: { deliverables: [{ title: '', description: '' }] },
  phases: { phases: [{ label: 'Phase 1', name: '', description: '' }] },
  split_narrative: { left: { heading: '', body: '' }, right: { heading: '', body: '' } },
  action_items: { items: [{ title: '', description: '' }] },
  delivery_timeline: { milestones: [{ label: '', description: '' }] },
  signature: {},
};
