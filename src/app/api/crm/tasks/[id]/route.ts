export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { updateTaskSchema } from '@/lib/crmSchemas';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = updateTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { completed, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (completed !== undefined) update.completed_at = completed ? new Date().toISOString() : null;
  if (Object.keys(update).length === 0) return badRequest('Nothing to update');

  const { data, error } = await auth.db.from('crm_tasks').update(update).eq('id', id).select('*').maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Task not found', 404);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('crm_tasks').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
