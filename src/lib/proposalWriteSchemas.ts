// Zod schemas for everything the builder writes.
//
// The builder is trusted UI, but it is still a browser posting JSON. Nothing
// reaches the database without passing through here first — including the
// block content, which is re-validated against its own per-type schema.

import { z } from 'zod';
import { proposalBlockSchema } from '@/lib/proposalSchemas';

export const proposalStatusSchema = z.enum([
  'draft',
  'sent',
  'viewed',
  'signed',
  'declined',
  'expired',
]);

export const themeSchema = z.object({
  accent: z.enum(['green', 'orange', 'magenta', 'purple', 'blue']).optional(),
  agencyName: z.string().max(120).optional(),
  headerNote: z.string().max(160).optional(),
});

/**
 * Fields on the proposal row the builder is allowed to change.
 *
 * Text fields accept an empty string. Autosave sends the whole document on a
 * debounce, so requiring a value anywhere means clearing a field to retype it
 * rejects the entire save — the user loses unrelated edits because they were
 * mid-keystroke. Whether a proposal is complete is checked when it is
 * published, not on every keypress.
 */
export const proposalPatchSchema = z.object({
  title: z.string().max(200).optional(),
  client_id: z.string().uuid().nullable().optional(),
  proposal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  currency: z.string().length(3).optional(),
  deposit_percent: z.number().int().min(0).max(100).optional(),
  theme: themeSchema.optional(),
  // Status moves through the publish and sign routes, never a raw patch —
  // except back to draft, which is how Lauren unpublishes.
  status: z.literal('draft').optional(),
});

export const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  /** Blank while it is being typed — see the note on proposalPatchSchema. */
  label: z.string().max(200),
  description: z.string().max(500).nullable().optional(),
  quantity: z.number().min(0).max(100000),
  unit_price_cents: z.number().int().min(0).max(100_000_000),
  position: z.number().int().min(0),
});

/** The autosave payload. Every part is optional so a save can be partial. */
export const savePayloadSchema = z.object({
  proposal: proposalPatchSchema.optional(),
  blocks: z.array(proposalBlockSchema).max(60).optional(),
  lineItems: z.array(lineItemSchema).max(100).optional(),
});

export const createProposalSchema = z.object({
  title: z.string().min(1).max(200),
  clientId: z.string().uuid().nullable().optional(),
  /** Start from a saved template… */
  templateId: z.string().uuid().nullable().optional(),
  /** …or from an existing proposal, which is how most get made in practice. */
  fromProposalId: z.string().uuid().nullable().optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(1).max(160),
  company: z.string().max(160).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
});
