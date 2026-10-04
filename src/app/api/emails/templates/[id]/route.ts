export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { templateUpdateSchema } from '@/lib/prospects';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data } = await auth.db.from('email_templates').select('*').eq('id', id).maybeSingle();
  if (!data) return badRequest('Template not found', 404);
  return NextResponse.json({ ok: true, data });
}

/** Edit a template. Emails already sent keep what they said. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = templateUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const { data, error } = await auth.db
    .from('email_templates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Template not found', 404);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { error } = await auth.db.from('email_templates').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}

/** Duplicate, e.g. to try a variation. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data: src } = await auth.db.from('email_templates').select('name, style, subject, preheader, body, blocks, design').eq('id', id).maybeSingle();
  if (!src) return badRequest('Template not found', 404);
  const { data, error } = await auth.db.from('email_templates').insert({ ...src, name: `${src.name} (copy)` }).select('id').single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
