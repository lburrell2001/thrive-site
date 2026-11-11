export const runtime = 'nodejs';

// Website → Homepage: the hero mosaic (desktop and phone layouts) and the statement
// and heading photos, and the photo strips on About, Contact and Book a call
// (src/lib/homeCollage.ts).

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { FAN_COUNT, INLINE_COUNT, PAGE_STRIPS, QUOTE_COUNT, collageLibrary, loadConfig, photosFor, quotableReviews, saveConfig } from '@/lib/homeCollage';
import { MAX_TILES } from '@/lib/collageLayout';

/** Every case-study image to choose from, what's saved, and what the homepage shows now. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const config = await loadConfig(auth.db);
  return NextResponse.json({ ok: true, data: { library: collageLibrary(), config, shown: photosFor(config), reviews: await quotableReviews(auth.db).catch(() => []) } });
}

const pick = z.object({ slug: z.string().max(200), src: z.string().max(500) });
const cell = z.number().int().min(1).max(20);
const placed = z.array(pick.extend({ col: cell, row: cell, w: cell, h: cell }));
const schema = z.object({
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
      kind: z.literal('custom'), text: z.string().trim().min(1, 'Type the quote, or pick a review').max(400), who: z.string().trim().max(80),
      contact_id: z.string().uuid().nullable().optional(), service: z.enum(['brand-design', 'digital-design', 'ux-design', 'social-media', 'photography']).nullable().optional(),
      review_id: z.string().uuid().nullable().optional(),
    }),
  ])).length(QUOTE_COUNT).optional(),
});

type Slot = NonNullable<Parameters<typeof saveConfig>[1]['quotes']>[number];

async function syncQuoteReview(db: import('@supabase/supabase-js').SupabaseClient, q: Slot): Promise<Slot> {
  if (q.kind !== 'custom' || (!q.contact_id && !q.service)) return q;
  const now = new Date().toISOString();
  const row = {
    body: q.text, display_name: q.who || null, crm_contact_id: q.contact_id ?? null, service_slug: q.service ?? null,
    // Lauren typed their words for the site herself: published, approved.
    consent_publish: true, status: 'approved', approved_at: now, updated_at: now,
  };
  if (q.review_id) {
    const { data } = await db.from('reviews').update(row).eq('id', q.review_id).select('id').maybeSingle();
    if (data) return q;
  }
  const { data, error } = await db.from('reviews').insert({ ...row, submitted_at: now }).select('id').single();
  if (error) { console.error('[homepage quotes] review not saved', error.message); return q; }
  return { ...q, review_id: data.id };
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(`Give every tile a photo (1 to ${MAX_TILES} tiles)`);
  try {
    // A typed quote with a client or a service is kept as an approved review: on their
    // timeline and the Reviews page, and on that service's page.
    const body = parsed.data as Parameters<typeof saveConfig>[1];
    if (body.quotes) body.quotes = await Promise.all(body.quotes.map((q) => syncQuoteReview(auth.db, q)));
    const config = await saveConfig(auth.db, body);
    // Refresh the cached homepage now (both forms: the root path alone didn't always clear it).
    revalidatePath('/', 'page');
    revalidatePath('/');
    for (const path of ['/about', '/contact', '/book']) revalidatePath(path, 'page');
    return NextResponse.json({ ok: true, data: { config, shown: photosFor(config) } });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not save');
  }
}
