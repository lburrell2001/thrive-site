export const runtime = 'nodejs';

// Website → Homepage: the hero mosaic (tiles, sizes, order) and the statement
// and heading photos, and the photo strips on About, Contact and Book a call
// (src/lib/homeCollage.ts).

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { FAN_COUNT, INLINE_COUNT, PAGE_STRIPS, collageLibrary, loadConfig, photosFor, saveConfig } from '@/lib/homeCollage';
import { MAX_TILES, SIZE_ORDER } from '@/lib/collageLayout';

/** Every case-study image to choose from, what's saved, and what the homepage shows now. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const config = await loadConfig(auth.db);
  return NextResponse.json({ ok: true, data: { library: collageLibrary(), config, shown: photosFor(config) } });
}

const pick = z.object({ slug: z.string().max(200), src: z.string().max(500) });
const schema = z.object({
  tiles: z.array(pick.extend({ size: z.enum(SIZE_ORDER as [string, ...string[]]) })).min(1).max(MAX_TILES),
  fan: z.array(pick.nullable()).length(FAN_COUNT),
  inline: z.array(pick.nullable()).length(INLINE_COUNT),
  pages: z.object({
    about: z.array(pick.nullable()).length(PAGE_STRIPS.about),
    contact: z.array(pick.nullable()).length(PAGE_STRIPS.contact),
    book: z.array(pick.nullable()).length(PAGE_STRIPS.book),
  }),
});

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(`Give every tile a photo (1 to ${MAX_TILES} tiles)`);
  try {
    const config = await saveConfig(auth.db, parsed.data as Parameters<typeof saveConfig>[1]);
    // Refresh the cached homepage now (both forms: the root path alone didn't always clear it).
    revalidatePath('/', 'page');
    revalidatePath('/');
    for (const path of ['/about', '/contact', '/book']) revalidatePath(path, 'page');
    return NextResponse.json({ ok: true, data: { config, shown: photosFor(config) } });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not save');
  }
}
