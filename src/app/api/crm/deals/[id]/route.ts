export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { updateDealSchema } from '@/lib/crmSchemas';

type Ctx = { params: Promise<{ id: string }> };

/** Rename, move stage, set value or lost reason. Stage changes are logged by trigger. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = updateDealSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db
    .from('crm_deals')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Deal not found', 404);
  return NextResponse.json({ ok: true, data });
}

/**
 * Remove a deal. Its proposals and inquiries stay and simply stop pointing
 * at it; its stage history stays on the contact's timeline.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { error } = await auth.db.from('crm_deals').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
