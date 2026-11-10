// Calls booked on /book, added to an Outlook calendar (migration 054): the
// one chosen in Settings → Booking (`booking_settings.calendar_mailbox`) —
// Lauren's own, or hello@'s, which she has Full Access to. The event has the
// guest's details and the meeting link in it, is marked busy with a 15-minute
// reminder, and has no attendees, so Outlook sends nothing (the guest already
// gets the site's email with an invite). Cancelling the booking deletes it.
// Never blocks a booking: a failure is logged and the booking stands.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { graph, hasCalendarWrite, loadConnection, mailboxPath, type Connection } from './outlook';
import type { BookingSettings } from './bookingTime';
import { SERVICE_SEO } from './serviceSeo';
import { SITE_URL } from './seo';

type BookingRow = {
  id: string; starts_at: string; ends_at: string; name: string; email: string;
  company: string | null; phone: string | null; service_slug: string | null; notes: string | null;
  crm_contact_id?: string | null;
};

/** Graph wants a bare date-time with the zone given separately. */
const utc = (iso: string) => new Date(iso).toISOString().slice(0, 19);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Whether bookings can go on this mailbox's calendar with the current sign-in. */
export function canWriteCalendar(conn: Connection | null, mailbox: string | null | undefined): boolean {
  if (!conn || !mailbox) return false;
  const own = mailbox.toLowerCase() === conn.account_email.toLowerCase();
  if (!own && !conn.shared_mailboxes.some((m) => m.toLowerCase() === mailbox.toLowerCase())) return false;
  return hasCalendarWrite(conn.granted_scopes, !own);
}

export async function addBookingToCalendar(db: SupabaseClient, booking: BookingRow, settings: BookingSettings): Promise<void> {
  const mailbox = settings.calendar_mailbox;
  if (!mailbox) return;
  try {
    const conn = await loadConnection(db);
    if (!conn || !canWriteCalendar(conn, mailbox)) {
      console.error('[booking calendar] not added: reconnect Outlook with calendar access, or pick a connected mailbox');
      return;
    }
    const service = booking.service_slug ? (SERVICE_SEO as Record<string, { name: string } | undefined>)[booking.service_slug]?.name : null;
    const rows: [string, string | null | undefined][] = [
      ['Name', booking.name], ['Email', booking.email], ['Phone', booking.phone], ['Company', booking.company],
      ['Interested in', service], ['Notes', booking.notes], ['Meeting link', settings.meeting_link],
    ];
    const body = [
      `<p><strong>${esc(settings.title)}</strong>, booked on thrivecreativestudios.org/book.</p>`,
      '<table>',
      ...rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6b6b6b">${k}</td><td>${esc(String(v)).replace(/\n/g, '<br>')}</td></tr>`),
      '</table>',
      booking.crm_contact_id ? `<p><a href="${SITE_URL}/admin?contact=${booking.crm_contact_id}">Open them in the CRM</a></p>` : '',
    ].join('');
    const event = await graph<{ id: string }>(db, `${mailboxPath(conn, mailbox)}/events`, {
      method: 'POST',
      body: JSON.stringify({
        subject: `${settings.title}: ${booking.name}${booking.company ? ` (${booking.company})` : ''}`,
        body: { contentType: 'HTML', content: body },
        start: { dateTime: utc(booking.starts_at), timeZone: 'UTC' },
        end: { dateTime: utc(booking.ends_at), timeZone: 'UTC' },
        location: settings.meeting_link ? { displayName: settings.meeting_link } : undefined,
        showAs: 'busy',
        isReminderOn: true,
        reminderMinutesBeforeStart: 15,
        categories: ['Thrive booking'],
      }),
    });
    await db.from('bookings').update({ outlook_event_id: event.id, outlook_mailbox: mailbox }).eq('id', booking.id);
  } catch (e) {
    console.error('[booking calendar] add failed', e);
  }
}

export async function removeBookingFromCalendar(db: SupabaseClient, booking: { outlook_event_id?: string | null; outlook_mailbox?: string | null }): Promise<void> {
  if (!booking.outlook_event_id || !booking.outlook_mailbox) return;
  try {
    const conn = await loadConnection(db);
    if (!conn) return;
    await graph(db, `${mailboxPath(conn, booking.outlook_mailbox)}/events/${encodeURIComponent(booking.outlook_event_id)}`, { method: 'DELETE' });
  } catch (e) {
    console.error('[booking calendar] remove failed', e);
  }
}
