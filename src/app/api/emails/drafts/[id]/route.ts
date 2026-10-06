export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

/** Discard a draft (or cancel a scheduled one). Not while it's sending. */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data, error } = await auth.db.from('prospect_drafts').delete().eq('id', id).neq('status', 'sending').select('id');
  if (error) return badRequest(error.message);
  if (!data?.length) return badRequest('It’s sending right now, or already gone', 409);
  return NextResponse.json({ ok: true, data: null });
}
