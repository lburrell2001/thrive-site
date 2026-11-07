// Reading the Outlook calendar mirror (calendar_events, migration 043) for
// Home, the digest, the Calls page and the contact timeline. Everything here
// returns [] before the migration runs.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarMeeting } from '@/types/crm';

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

const COLUMNS = 'id, subject, starts_at, ends_at, is_all_day, location, join_url, web_link, contact_id, matched_by, attendees, crm_contacts ( name, company, phone )';

type Row = {
  id: string; subject: string; starts_at: string; ends_at: string; is_all_day: boolean;
  location: string | null; join_url: string | null; web_link: string | null;
  contact_id: string | null; matched_by: string | null; attendees: { email: string; name: string | null }[] | null;
  crm_contacts: One<{ name: string | null; company: string | null; phone: string | null }>;
};

function toMeeting(r: Row): CalendarMeeting {
  const c = one(r.crm_contacts);
  return {
    id: r.id,
    subject: r.subject || '(no title)',
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    is_all_day: r.is_all_day,
    location: r.location,
    join_url: r.join_url,
    web_link: r.web_link,
    contact_id: r.contact_id,
    contact_name: c?.name ?? null,
    company: c?.company ?? null,
    phone: c?.phone ?? null,
    matched_by: (r.matched_by as CalendarMeeting['matched_by']) ?? null,
    attendees: (r.attendees ?? []).map((a) => a.name || a.email),
  };
}

/**
 * Meetings starting in [from, to), soonest first. All-day entries (out of
 * office, holidays) are left out. `skipStarts` drops a meeting that starts
 * within 5 minutes of one of these times — a /book booking she also added to
 * Outlook from its invite.
 */
export async function loadMeetings(db: SupabaseClient, opts: { from: string; to: string; contactId?: string; skipStarts?: string[]; limit?: number }): Promise<CalendarMeeting[]> {
  let q = db.from('calendar_events').select(COLUMNS)
    .gte('starts_at', opts.from).lt('starts_at', opts.to)
    .eq('is_all_day', false)
    .order('starts_at').limit(opts.limit ?? 300);
  if (opts.contactId) q = q.eq('contact_id', opts.contactId);
  const { data, error } = await q;
  if (error) return [];
  const skip = (opts.skipStarts ?? []).map((s) => Date.parse(s));
  return ((data ?? []) as unknown as Row[])
    .filter((r) => !skip.some((t) => Math.abs(Date.parse(r.starts_at) - t) < 5 * 60_000))
    .map(toMeeting);
}

/** Every meeting with one contact, newest first, for their timeline. */
export async function contactMeetings(db: SupabaseClient, contactId: string): Promise<CalendarMeeting[]> {
  const { data, error } = await db.from('calendar_events').select(COLUMNS)
    .eq('contact_id', contactId).eq('is_all_day', false)
    .order('starts_at', { ascending: false }).limit(100);
  if (error) return [];
  return ((data ?? []) as unknown as Row[]).map(toMeeting);
}

export type CalendarBusy = { starts_at: string; ends_at: string; is_all_day: boolean };

/**
 * Busy times on the calendar overlapping [from, to), for /book. Events marked
 * free or "working elsewhere" in Outlook leave the time open; rows synced
 * before migration 044 (no show_as yet) count as busy.
 */
export async function calendarBusy(db: SupabaseClient, from: string, to: string): Promise<CalendarBusy[]> {
  const read = (columns: string) => db.from('calendar_events').select(columns).gt('ends_at', from).lt('starts_at', to).limit(2000);
  const full = await read('starts_at, ends_at, is_all_day, show_as');
  if (!full.error) {
    return ((full.data ?? []) as unknown as (CalendarBusy & { show_as: string | null })[])
      .filter((e) => e.show_as !== 'free' && e.show_as !== 'workingElsewhere')
      .map(({ starts_at, ends_at, is_all_day }) => ({ starts_at, ends_at, is_all_day }));
  }
  // Before migration 044; [] before 043.
  const { data, error } = await read('starts_at, ends_at, is_all_day');
  return error ? [] : (data ?? []) as unknown as CalendarBusy[];
}
