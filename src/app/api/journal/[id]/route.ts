export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { updatePostSchema } from '@/lib/journalSchemas';

type Ctx = { params: Promise<{ id: string }> };

/** The public pages are cached; refresh the ones a change can affect. */
function refreshPublic(...slugs: (string | null | undefined)[]) {
  revalidatePath('/journal');
  revalidatePath('/sitemap.xml');
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/journal/${slug}`);
}

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { data, error } = await auth.db.from('journal_posts').select('*').eq('id', id).maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Article not found', 404);
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = updatePostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data: before } = await auth.db.from('journal_posts').select('slug, status').eq('id', id).maybeSingle();
  if (!before) return badRequest('Article not found', 404);

  const { data, error } = await auth.db
    .from('journal_posts')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return badRequest('Another article already uses that address');
    return badRequest(error.message);
  }

  if (before.status === 'published' || data?.status === 'published') refreshPublic(before.slug, data?.slug);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { data: post } = await auth.db.from('journal_posts').select('slug, cover_path').eq('id', id).maybeSingle();
  if (!post) return badRequest('Article not found', 404);
  if (post.cover_path) await auth.db.storage.from('course-media').remove([post.cover_path]);

  const { error } = await auth.db.from('journal_posts').delete().eq('id', id);
  if (error) return badRequest(error.message);
  refreshPublic(post.slug);
  return NextResponse.json({ ok: true, data: null });
}
