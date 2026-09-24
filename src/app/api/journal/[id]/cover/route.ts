export const runtime = 'nodejs';

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

// Vercel rejects request bodies over 4.5 MB before this code runs, so the
// limit here is set below that and said plainly.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

/** Upload or replace an article's cover image (public course-media bucket). */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('Expected multipart form data');
  }
  const file = form.get('file');
  if (!(file instanceof File)) return badRequest('No file supplied');
  if (file.size > MAX_BYTES) return badRequest('Cover images must be 4 MB or smaller — export a smaller JPEG or WebP');
  const ext = ALLOWED.get(file.type);
  if (!ext) return badRequest('Cover images must be JPEG, PNG, WebP or AVIF');

  const { data: post } = await auth.db.from('journal_posts').select('slug, status, cover_path').eq('id', id).maybeSingle();
  if (!post) return badRequest('Article not found', 404);

  // A new name each time, so browsers and the CDN never show the old image.
  const path = `journal/${id}/cover-${Date.now()}.${ext}`;
  const { error } = await auth.db.storage.from('course-media').upload(path, file, { contentType: file.type });
  if (error) return badRequest(error.message);

  const { data, error: updateError } = await auth.db
    .from('journal_posts')
    .update({ cover_path: path })
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) return badRequest(updateError.message);
  if (post.cover_path) await auth.db.storage.from('course-media').remove([post.cover_path]);

  if (post.status === 'published') {
    revalidatePath('/journal');
    revalidatePath(`/journal/${post.slug}`);
  }
  return NextResponse.json({ ok: true, data });
}
