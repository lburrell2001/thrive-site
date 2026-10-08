// The CRM's Visitors page and the visits on a contact's timeline, read from
// site_pageviews. Page views are grouped by the browser's lasting
// visitor_id (migration 034); older views without one stand alone per
// session. A visitor has a name only when one of their sessions sent an
// inquiry or booked a call — contact_inquiries.session_id links the two.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAll } from '@/lib/analyticsReport';
import { isServicePage, pageLabel } from '@/lib/pageLabel';
import type { SiteVisitor, Visit, VisitorReport } from '@/types/visitors';

interface ViewRow {
  created_at: string;
  session_id: string;
  visitor_id?: string | null;
  path: string;
  is_landing: boolean;
  source: string | null;
  device: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  engaged_ms: number | null;
}

const COLS = 'created_at, session_id, visitor_id, path, is_landing, source, device, city, region, country, engaged_ms';
const COLS_OLD = COLS.replace(' visitor_id,', '');

/** Read views, tolerating a database without migration 034. */
async function readViews(
  db: SupabaseClient,
  build: (cols: string, from: number, to: number) => PromiseLike<{ data: ViewRow[] | null; error: { message: string } | null }>,
): Promise<ViewRow[]> {
  try {
    return await readAll<ViewRow>((a, b) => build(COLS, a, b));
  } catch (error) {
    if (!(error instanceof Error) || !/visitor_id/.test(error.message)) throw error;
    return readAll<ViewRow>((a, b) => build(COLS_OLD, a, b));
  }
}

function place(v: ViewRow): string | null {
  if (v.city) return [v.city, v.region && v.country === 'US' ? v.region : v.country].filter(Boolean).join(', ');
  return v.region || v.country || null;
}

function sessionsOf(views: ViewRow[]): Visit[] {
  const by = new Map<string, ViewRow[]>();
  for (const v of views) {
    const list = by.get(v.session_id) ?? [];
    list.push(v);
    by.set(v.session_id, list);
  }
  return [...by.entries()]
    .map(([sid, list]) => {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        session_id: sid,
        at: list[0].created_at,
        source: list.find((v) => v.is_landing)?.source ?? list[0].source,
        pages: list.map((v) => ({ path: v.path, label: pageLabel(v.path), at: v.created_at, ms: v.engaged_ms })),
        ms: list.reduce((sum, v) => sum + (v.engaged_ms ?? 0), 0),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

function interestsOf(views: ViewRow[]): string[] {
  const count = new Map<string, number>();
  for (const v of views) if (isServicePage(v.path)) count.set(v.path, (count.get(v.path) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([path]) => pageLabel(path));
}

/** Contacts behind these sessions, from the inquiries sent during them. */
async function contactsForSessions(db: SupabaseClient, sessionIds: string[]) {
  const map = new Map<string, { id: string; name: string; company: string | null }>();
  for (let i = 0; i < sessionIds.length; i += 200) {
    const { data } = await db
      .from('contact_inquiries')
      .select('session_id, crm_contact_id, crm_contacts ( id, name, email, company )')
      .in('session_id', sessionIds.slice(i, i + 200))
      .not('crm_contact_id', 'is', null);
    for (const row of data ?? []) {
      const c = (Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts) as
        { id: string; name: string; email: string | null; company: string | null } | null;
      if (c && row.session_id) map.set(row.session_id, { id: c.id, name: c.name || c.email || 'Unnamed', company: c.company });
    }
  }
  return map;
}

export async function loadVisitors(db: SupabaseClient, days = 30): Promise<VisitorReport> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const views = await readViews(db, (cols, a, b) =>
    db.from('site_pageviews').select(cols).gte('created_at', since).order('created_at').range(a, b) as never);

  const groups = new Map<string, ViewRow[]>();
  for (const v of views) {
    const key = v.visitor_id || `s:${v.session_id}`;
    const list = groups.get(key) ?? [];
    list.push(v);
    groups.set(key, list);
  }

  // Their visits from before the window, so "first seen" and "returning"
  // are true for people who've been coming for a while.
  const ids = [...groups.keys()].filter((k) => !k.startsWith('s:'));
  const earlier = new Map<string, { at: string; source: string | null; sessions: Set<string> }>();
  for (let i = 0; i < ids.length; i += 200) {
    const old = await readViews(db, (cols, a, b) =>
      db.from('site_pageviews').select(cols).in('visitor_id', ids.slice(i, i + 200)).lt('created_at', since).order('created_at').range(a, b) as never)
      .catch(() => [] as ViewRow[]);
    for (const v of old) {
      const e = earlier.get(v.visitor_id!) ?? { at: v.created_at, source: v.source, sessions: new Set<string>() };
      e.sessions.add(v.session_id);
      earlier.set(v.visitor_id!, e);
    }
  }

  const allSessions = [...new Set(views.map((v) => v.session_id))];
  const known = await contactsForSessions(db, allSessions);

  const visitors: SiteVisitor[] = [...groups.entries()].map(([key, list]) => {
    const sessions = sessionsOf(list);
    const before = earlier.get(key);
    const last = list[list.length - 1];
    const firstLanding = list.find((v) => v.is_landing) ?? list[0];
    const contact = sessions.map((s) => known.get(s.session_id)).find(Boolean) ?? null;
    return {
      key,
      contact,
      place: place(last),
      device: last.device,
      first_source: before?.source ?? firstLanding.source,
      first_seen: before?.at ?? list[0].created_at,
      last_seen: last.created_at,
      visits: sessions.length + (before?.sessions.size ?? 0),
      pages: list.length,
      ms: list.reduce((sum, v) => sum + (v.engaged_ms ?? 0), 0),
      interests: interestsOf(list),
      sessions: sessions.slice(0, 10),
    };
  });

  visitors.sort((a, b) => b.last_seen.localeCompare(a.last_seen));
  return { days, generated_at: new Date().toISOString(), visitors };
}

/**
 * A contact's visits: the sessions where they sent an inquiry, and every
 * other visit from the same browsers. Newest first, at most `limit`.
 */
export async function visitsForContact(db: SupabaseClient, sessionIds: string[], limit = 30): Promise<Visit[]> {
  if (!sessionIds.length) return [];
  try {
    const own = await readViews(db, (cols, a, b) =>
      db.from('site_pageviews').select(cols).in('session_id', sessionIds.slice(0, 200)).order('created_at').range(a, b) as never);
    const vids = [...new Set(own.map((v) => v.visitor_id).filter((v): v is string => Boolean(v)))];
    const theirs = vids.length
      ? await readViews(db, (cols, a, b) =>
          db.from('site_pageviews').select(cols).in('visitor_id', vids).order('created_at').range(a, b) as never)
      : [];
    const seen = new Set<string>();
    const all = [...own, ...theirs].filter((v) => {
      const k = `${v.session_id}|${v.created_at}|${v.path}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return sessionsOf(all).slice(0, limit);
  } catch (error) {
    console.error('Could not load visits:', error);
    return [];
  }
}
