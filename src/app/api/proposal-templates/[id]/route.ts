export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { setDefaultTemplate } from '../setDefault';

type Ctx = { params: Promise<{ id: string }> };

/** The full template, blocks included — used to preview one before using it. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { data, error } = await auth.db
    .from('proposal_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return badRequest(error.message);
  if (!data) return badRequest('Template not found', 404);
  return NextResponse.json({ ok: true, data });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isDefault: z.literal(true).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { name, description, isDefault } = parsed.data;

  if (name !== undefined || description !== undefined) {
    const { error } = await auth.db
      .from('proposal_templates')
      .update({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      })
      .eq('id', id);
    if (error) return badRequest(error.message);
  }

  if (isDefault) {
    const error = await setDefaultTemplate(auth.db, id);
    if (error) return badRequest(error);
  }

  const { data } = await auth.db
    .from('proposal_templates')
    .select('id, name, description, is_default')
    .eq('id', id)
    .maybeSingle();

  if (!data) return badRequest('Template not found', 404);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // proposals.template_id is ON DELETE SET NULL, so proposals already made
  // from this template keep their content and simply lose the back-reference.
  const { error } = await auth.db.from('proposal_templates').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true });
}
