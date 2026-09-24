export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { readingMinutes } from '@/lib/articleMarkdown';
import { createPostSchema, slugify } from '@/lib/journalSchemas';

/** Every post, drafts included, for the admin list. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from('journal_posts')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return badRequest(error.message);

  return NextResponse.json({
    ok: true,
    data: (data ?? []).map(({ body, ...post }) => ({ ...post, reading_minutes: readingMinutes(body) })),
  });
}

/** Start a draft from a title; the address is made from it and kept unique. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = createPostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const base = slugify(parsed.data.title);
  const { data: taken } = await auth.db.from('journal_posts').select('slug').like('slug', `${base}%`);
  const used = new Set((taken ?? []).map((r) => r.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await auth.db
    .from('journal_posts')
    .insert({ title: parsed.data.title, slug })
    .select('id')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: { id: data.id } });
}
