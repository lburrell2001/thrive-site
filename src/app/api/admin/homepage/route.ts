export const runtime = 'nodejs';

// Website → Homepage: the hero collage's seven photos (src/lib/homeCollage.ts).

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { COLLAGE_SLOTS, SLOT_SHAPES, collageLibrary, loadCollage, loadPicks, savePicks } from '@/lib/homeCollage';

/** Every case-study image to choose from, what's saved, and what each tile shows now. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const [picks, tiles] = await Promise.all([loadPicks(auth.db), loadCollage(auth.db)]);
  return NextResponse.json({ ok: true, data: { library: collageLibrary(), picks, tiles, shapes: SLOT_SHAPES } });
}

const schema = z.object({
  picks: z.array(z.object({ slug: z.string().max(200), src: z.string().max(500) }).nullable()).length(COLLAGE_SLOTS),
});

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Choose a photo for each tile');
  try {
    const picks = await savePicks(auth.db, parsed.data.picks);
    // The homepage is cached for an hour.
    revalidatePath('/');
    return NextResponse.json({ ok: true, data: { picks, tiles: await loadCollage(auth.db) } });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not save');
  }
}
