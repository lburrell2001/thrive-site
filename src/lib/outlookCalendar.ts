// Lauren's Outlook calendar → calendar_events (migration 043). Runs with the
// mail sync (outlookSync.ts: Vercel Cron every 5 minutes, and "Sync now").
//
// Each run reads her own calendar from a week back to 60 days ahead, with
// repeating meetings expanded into their occurrences (calendarView), and
// mirrors that window: new and changed events are upserted, events deleted or
// cancelled in Outlook are removed. Each event is linked to a CRM contact by
// an attendee's email, else by the contact's name in the title ("Meeting with
// Maria Lopez", or "Maria" when only one contact is called Maria). Links set
// by hand (contact_locked) are left alone.
//
// Older events with no contact are deleted after a week; meetings with a
// contact stay as history on their timeline.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { graph, hasCalendarScope, type Connection } from './outlook';

const BACK_DAYS = 7;
const AHEAD_DAYS = 60;
const MAX_PAGES = 10;

type GraphAddress = { emailAddress?: { address?: string; name?: string } };
type GraphEvent = {
  id: string;
  subject?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null;
  webLink?: string;
  organizer?: GraphAddress;
  attendees?: GraphAddress[];
};
type Page = { value: GraphEvent[]; '@odata.nextLink'?: string };

type ContactLite = { id: string; name: string | null; email: string | null };

export type CalendarSyncResult = { events: number; removed: number } | { skipped: string };

const SELECT = 'id,subject,start,end,isAllDay,isCancelled,showAs,location,onlineMeeting,webLink,organizer,attendees';

/** Graph returns times in UTC (we ask for it) without a zone suffix. */
const utc = (dt: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(dt) ? dt : `${dt}Z`).toISOString();

const lower = (s?: string) => (s ?? '').trim().toLowerCase();

async function readWindow(db: SupabaseClient, from: string, to: string): Promise<GraphEvent[]> {
  const q = [
    `startDateTime=${encodeURIComponent(from)}`,
    `endDateTime=${encodeURIComponent(to)}`,
    '$top=100',
    `$select=${SELECT}`,
    `$orderby=${encodeURIComponent('start/dateTime')}`,
  ].join('&');
  let url: string | undefined = `/me/calendarView?${q}`;
  const out: GraphEvent[] = [];
  for (let i = 0; url && i < MAX_PAGES; i++) {
    const page: Page = await graph<Page>(db, url, { prefer: 'outlook.timezone="UTC"' });
    out.push(...page.value);
    url = page['@odata.nextLink'];
  }
  return out;
}

// ------------------------------------------------------------ matching

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text: string, word: string) => new RegExp(`(^|[^\\p{L}])${escapeRe(word)}($|[^\\p{L}])`, 'iu').test(text);

type NameIndex = { full: { name: string; contact: ContactLite }[]; first: Map<string, ContactLite[]> };

export function nameIndex(contacts: ContactLite[]): NameIndex {
  const full: NameIndex['full'] = [];
  const first = new Map<string, ContactLite[]>();
  for (const c of contacts) {
    const name = (c.name ?? '').trim();
    if (!name) continue;
    const parts = name.split(/\s+/);
    if (parts.length >= 2) full.push({ name, contact: c });
    const f = parts[0].toLowerCase();
    if (f.length >= 3) first.set(f, [...(first.get(f) ?? []), c]);
  }
  // Longest names first, so "Maria Lopez Garcia" wins over "Maria Lopez".
  full.sort((a, b) => b.name.length - a.name.length);
  return { full, first };
}

/** A contact named in the title: their full name, or a first name only one contact has. */
export function matchByName(text: string, idx: NameIndex): ContactLite | null {
  if (!text.trim()) return null;
  for (const f of idx.full) if (hasWord(text, f.name)) return f.contact;
  const hits = new Map<string, ContactLite>();
  for (const [first, list] of idx.first) {
    if (list.length === 1 && hasWord(text, first)) hits.set(list[0].id, list[0]);
  }
  return hits.size === 1 ? [...hits.values()][0] : null;
}

// ------------------------------------------------------------ sync

export async function syncCalendar(db: SupabaseClient, conn: Connection, own: Set<string>): Promise<CalendarSyncResult> {
  if (conn.granted_scopes === undefined) return { skipped: 'Run migration 043 in Supabase first' };
  if (!hasCalendarScope(conn.granted_scopes)) return { skipped: 'Reconnect Outlook to add your calendar' };

  const now = Date.now();
  const from = new Date(now - BACK_DAYS * 86_400_000).toISOString();
  const to = new Date(now + AHEAD_DAYS * 86_400_000).toISOString();
  const events = (await readWindow(db, from, to)).filter((e) => !e.isCancelled);

  const people = (e: GraphEvent) => [e.organizer, ...(e.attendees ?? [])]
    .map((a) => ({ email: lower(a?.emailAddress?.address), name: a?.emailAddress?.name?.trim() || null }))
    .filter((a) => a.email && !own.has(a.email));

  // Contacts by attendee email, and everyone's names for title matching.
  const emails = [...new Set(events.flatMap((e) => people(e).map((p) => p.email)))];
  const byEmail = new Map<string, ContactLite>();
  for (let i = 0; i < emails.length; i += 100) {
    const { data } = await db.from('crm_contacts').select('id, name, email').in('email', emails.slice(i, i + 100));
    for (const c of (data ?? []) as ContactLite[]) if (c.email) byEmail.set(lower(c.email), c);
  }
  const { data: everyone } = await db.from('crm_contacts').select('id, name, email').not('name', 'is', null).limit(5000);
  // Lauren's own contact rows (the demo client) would match her name on every event.
  const names = nameIndex(((everyone ?? []) as ContactLite[]).filter((c) => !own.has(lower(c.email ?? undefined))));

  // Hand-made links survive the sync.
  const ids = events.map((e) => e.id);
  const locked = new Map<string, { contact_id: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('calendar_events').select('graph_id, contact_id').in('graph_id', ids.slice(i, i + 200)).eq('contact_locked', true);
    for (const r of data ?? []) locked.set(r.graph_id, { contact_id: r.contact_id });
  }

  const rows = events.map((e) => {
    const attendees = people(e);
    const lock = locked.get(e.id);
    let contact_id: string | null = null;
    let matched_by: string | null = null;
    if (lock) {
      contact_id = lock.contact_id;
      matched_by = 'manual';
    } else {
      const byMail = attendees.map((a) => byEmail.get(a.email)).find(Boolean);
      const byName = byMail ? null : matchByName(`${e.subject ?? ''} ${e.location?.displayName ?? ''}`, names);
      contact_id = byMail?.id ?? byName?.id ?? null;
      matched_by = byMail ? 'email' : byName ? 'name' : null;
    }
    return {
      graph_id: e.id,
      mailbox: conn.account_email,
      subject: (e.subject ?? '').slice(0, 500),
      starts_at: utc(e.start.dateTime),
      ends_at: utc(e.end.dateTime),
      is_all_day: Boolean(e.isAllDay),
      location: e.location?.displayName?.slice(0, 300) || null,
      join_url: e.onlineMeeting?.joinUrl ?? null,
      web_link: e.webLink ?? null,
      organizer_email: lower(e.organizer?.emailAddress?.address) || null,
      attendees,
      contact_id,
      matched_by,
      contact_locked: Boolean(lock),
      synced_at: new Date().toISOString(),
    };
  });

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('calendar_events').upsert(rows.slice(i, i + 200), { onConflict: 'graph_id' });
    if (error) throw new Error(`Calendar: ${error.message}`);
  }

  // Mirror the window: anything in it that Outlook no longer has was deleted or cancelled.
  let removed = 0;
  const seen = new Set(ids);
  const { data: inWindow } = await db.from('calendar_events').select('id, graph_id').gte('starts_at', from).lt('starts_at', to).limit(5000);
  const gone = (inWindow ?? []).filter((r) => !seen.has(r.graph_id)).map((r) => r.id);
  for (let i = 0; i < gone.length; i += 200) {
    await db.from('calendar_events').delete().in('id', gone.slice(i, i + 200));
  }
  removed += gone.length;

  // Past events with no contact aren't CRM history.
  const { count } = await db.from('calendar_events').delete({ count: 'exact' }).lt('starts_at', from).is('contact_id', null);
  removed += count ?? 0;

  await db.from('mail_connection').update({ calendar_synced_at: new Date().toISOString() }).eq('id', 1);
  return { events: rows.length, removed };
}
