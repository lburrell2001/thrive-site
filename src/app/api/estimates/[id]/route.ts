export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { estimatePatchSchema, estimateRow, missingTotalsOnly, withoutTotalsOnly } from '@/lib/estimates';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = estimatePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid estimate');
  if (Object.keys(parsed.data).length === 0) return badRequest('Nothing to update');

  const row = { ...estimateRow(parsed.data), updated_at: new Date().toISOString() };
  const save = (r: Record<string, unknown>) => auth.db.from('estimates').update(r).eq('id', id).select('*').maybeSingle();
  let { data, error } = await save(row);
  if (error && missingTotalsOnly(error.message) && 'totals_only' in row) ({ data, error } = await save(withoutTotalsOnly(row)));
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Estimate not found', 404);
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('estimates').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
