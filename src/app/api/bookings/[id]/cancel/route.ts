export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { BookingError, cancelBooking } from '@/lib/booking';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

type Ctx = { params: Promise<{ id: string }> };

/** Admin cancelling a call; the visitor is emailed and asked to rebook. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await cancelBooking(auth.db, { id }, 'admin', resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data: null });
  } catch (error) {
    if (error instanceof BookingError) return badRequest(error.message, 404);
    throw error;
  }
}
