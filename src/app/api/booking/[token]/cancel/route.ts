export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { BookingError, cancelBooking } from '@/lib/booking';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

type Ctx = { params: Promise<{ token: string }> };

/** The visitor cancelling from the link in their confirmation email. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  try {
    await cancelBooking(serviceClient(), { token }, 'visitor', resolveSiteOrigin(req));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
