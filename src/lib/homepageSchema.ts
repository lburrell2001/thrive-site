// What the admin Homepage page saves (PATCH /api/admin/homepage), checked here.

import { z } from 'zod';
import { MAX_TILES } from './collageLayout';
// Same counts as homeCollage.ts (server-only, so not imported here).
const FAN_COUNT = 3;
const INLINE_COUNT = 2;
const PAGE_STRIPS = { about: 5, contact: 3, book: 4 };
const QUOTE_COUNT = 3;

const pick = z.object({ slug: z.string().max(200), src: z.string().max(500) });
const cell = z.number().int().min(1).max(20);
const placed = z.array(pick.extend({ col: cell, row: cell, w: cell, h: cell }));
export const homepageSchema = z.object({
  mosaic: z.object({ desktop: placed.min(1).max(MAX_TILES), phone: placed.min(1).max(MAX_TILES) }),
  fan: z.array(pick.nullable()).length(FAN_COUNT),
  inline: z.array(pick.nullable()).length(INLINE_COUNT),
  pages: z.object({
    about: z.array(pick.nullable()).length(PAGE_STRIPS.about),
    contact: z.array(pick.nullable()).length(PAGE_STRIPS.contact),
    book: z.array(pick.nullable()).length(PAGE_STRIPS.book),
  }),
  share: pick.nullable().default(null),
  quotes: z.array(z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('review'), id: z.string().uuid() }),
    z.object({
      kind: z.literal('custom'), text: z.string().trim().min(1, 'Type the quote, or pick a review').max(2000, 'Keep it under 2,000 characters'), who: z.string().trim().max(160),
      contact_id: z.string().uuid().nullable().optional(), service: z.enum(['brand-design', 'digital-design', 'ux-design', 'social-media', 'photography']).nullable().optional(),
      review_id: z.string().uuid().nullable().optional(),
    }),
  ])).length(QUOTE_COUNT).optional(),
});

