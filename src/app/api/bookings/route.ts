export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { BookingError, loadSettings, settingsSchema } from '@/lib/booking';

/** Settings, blocked dates, and bookings from the last 30 days onward. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  try {
    const [settings, blackouts, bookings] = await Promise.all([
      loadSettings(auth.db),
      auth.db.from('booking_blackouts').select('*').gte('ends_on', new Date().toISOString().slice(0, 10)).order('starts_on'),
      auth.db.from('bookings')
        .select('id, starts_at, ends_at, status, name, email, company, phone, service_slug, notes, crm_contact_id, crm_deal_id, cancelled_by, created_at')
        .gte('starts_at', since)
        .order('starts_at'),
    ]);
    return NextResponse.json({ ok: true, data: { settings, blackouts: blackouts.data ?? [], bookings: bookings.data ?? [] } });
  } catch (error) {
    if (error instanceof BookingError) return badRequest(`${error.message} — run migration 025.`, 503);
    throw error;
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid settings');

  const { data, error } = await auth.db
    .from('booking_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('*')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
