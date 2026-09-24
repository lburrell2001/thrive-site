export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { error } = await auth.db.from('booking_blackouts').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
