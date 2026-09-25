export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { blocksSchema, designSchema } from '@/lib/newsletterBlocks';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  subject: z.string().max(160),
  preheader: z.string().max(200),
  body: z.string().max(60_000),
  audience: z.enum(['subscribers', 'clients', 'leads', 'tag']),
  audience_tag: z.string().trim().max(40).nullable().transform((v) => v || null),
  blocks: blocksSchema,
  design: designSchema.partial(),
}).partial().refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data } = await auth.db.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (!data) return badRequest('Newsletter not found', 404);
  return NextResponse.json({ ok: true, data });
}

/** Edit a draft. A sent newsletter is a record and can't be changed. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db
    .from('newsletters')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'failed'])
    .select('*')
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('A sent newsletter can’t be edited — duplicate it instead', 409);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { error } = await auth.db.from('newsletters').delete().eq('id', id).neq('status', 'sending');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}

/** Duplicate: a new draft with the same content, e.g. to resend a sent one. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data: src } = await auth.db.from('newsletters').select('subject, preheader, body, blocks, design, audience, audience_tag').eq('id', id).maybeSingle();
  if (!src) return badRequest('Newsletter not found', 404);
  const { data, error } = await auth.db.from('newsletters').insert({ ...src, subject: src.subject ? `${src.subject} (copy)` : '' }).select('id').single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
