export const runtime = 'nodejs';

import { NextResponse, after } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { BookingError, availability, bookSchema, createBooking } from '@/lib/booking';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { cleanAnonId, trackConversion } from '@/lib/opinly';

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Open slots for /book. Only times — never who booked what. */
export async function GET() {
  try {
    const { settings, days } = await availability(serviceClient());
    return NextResponse.json(
      {
        ok: true,
        data: {
          enabled: settings.enabled,
          title: settings.title,
          duration_minutes: settings.duration_minutes,
          timezone: settings.timezone,
          meeting_note: settings.meeting_note,
          days,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Booking is unavailable', 503);
  }
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = bookSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form');

  try {
    const result = await createBooking(serviceClient(), parsed.data, resolveSiteOrigin(req), req.headers.get('host'));
    // Opinly: a booked call is a lead, credited to the visit that brought them.
    after(() =>
      trackConversion(
        'generate_lead',
        { anonId: cleanAnonId((raw as { opinlyAnonId?: unknown } | null)?.opinlyAnonId), email: parsed.data.email },
        { form: 'booking', service: parsed.data.service_slug ?? null },
        `booking-${result.id}`,
      ),
    );
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof BookingError) return fail(error.message, 409);
    console.error('Booking failed:', error);
    return fail('Something went wrong — please try again, or use the contact form.', 500);
  }
}
