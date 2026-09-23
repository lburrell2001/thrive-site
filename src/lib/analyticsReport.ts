// Turns raw page views, inquiries and CRM outcomes into the admin
// analytics report. Aggregation happens here rather than in SQL: a studio
// site's traffic is small enough to read in full, and the rules are easier
// to follow in TypeScript.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Channel } from '@/lib/trafficSource';
import { buildInsights } from '@/lib/trafficInsights';
import type {
  AnalyticsReport,
  BreakdownRow,
  CampaignRow,
  ChannelRow,
  DailyPoint,
  PageRow,
  SourceRow,
  Totals,
} from '@/types/analytics';

/** Days are Dallas days, not UTC ones. */
const TZ = 'America/Chicago';
const BOUNCE_MS = 10_000;
const PAGE = 1000;
const MAX_ROWS = 200_000;

interface ViewRow {
  created_at: string;
  session_id: string;
  visitor_hash: string;
  path: string;
  is_landing: boolean;
  source: string | null;
  channel: Channel | null;
  utm_campaign: string | null;
  device: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  engaged_ms: number | null;
}

interface InquiryRow {
  created_at: string;
  session_id: string | null;
  source: string | null;
  channel: Channel | null;
  crm_contact_id: string | null;
}

interface Session {
  id: string;
  start: string;
  source: string;
  channel: Channel;
  campaign: string | null;
  device: string;
  place: string | null;
  pages: string[];
  engagedMs: number;
  inquiries: number;
}

const dayKey = (() => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (iso: string) => fmt.format(new Date(iso));
})();

async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function sessionsFrom(views: ViewRow[], inquiries: InquiryRow[]): Session[] {
  const bySession = new Map<string, Session>();
  for (const v of views) {
    let s = bySession.get(v.session_id);
    if (!s) {
      s = {
        id: v.session_id,
        start: v.created_at,
        source: 'Direct',
        channel: 'direct',
        campaign: null,
        device: v.device ?? 'desktop',
        place: v.city ? [v.city, v.region].filter(Boolean).join(', ') : v.country,
        pages: [],
        engagedMs: 0,
        inquiries: 0,
      };
      bySession.set(v.session_id, s);
    }
    if (v.is_landing) {
      s.source = v.source ?? 'Direct';
      s.channel = v.channel ?? 'direct';
      s.campaign = v.utm_campaign;
      s.start = v.created_at;
    }
    s.pages.push(v.path);
    s.engagedMs += v.engaged_ms ?? 0;
  }
  for (const i of inquiries) {
    const s = i.session_id ? bySession.get(i.session_id) : undefined;
    if (s) s.inquiries += 1;
  }
  return [...bySession.values()];
}

const bounced = (s: Session) => s.pages.length <= 1 && s.engagedMs < BOUNCE_MS;

function totalsOf(views: ViewRow[], sessions: Session[], inquiryCount: number): Totals {
  const dailyVisitors = new Set(views.map((v) => `${dayKey(v.created_at)}|${v.visitor_hash}`));
  const visits = sessions.length;
  return {
    visits,
    pageviews: views.length,
    visitors: dailyVisitors.size,
    inquiries: inquiryCount,
    conversionRate: visits ? inquiryCount / visits : 0,
    bounceRate: visits ? sessions.filter(bounced).length / visits : 0,
    avgEngagedSec: visits ? sessions.reduce((sum, s) => sum + s.engagedMs, 0) / visits / 1000 : 0,
  };
}

function breakdown(sessions: Session[], key: (s: Session) => string | null, limit: number): BreakdownRow[] {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = key(s);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([label, list]) => ({ label, visits: list.length, bounceRate: list.filter(bounced).length / list.length }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit);
}

export async function buildReport(
  db: SupabaseClient,
  days: number,
  sitemapPaths: string[],
): Promise<AnalyticsReport> {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);

  const viewCols = 'created_at, session_id, visitor_hash, path, is_landing, source, channel, utm_campaign, device, country, region, city, engaged_ms';
  const [allViews, allInquiries, firstView] = await Promise.all([
    readAll<ViewRow>((a, b) =>
      db.from('site_pageviews').select(viewCols).gte('created_at', prevFrom.toISOString()).order('created_at').range(a, b)),
    readAll<InquiryRow>((a, b) =>
      db.from('contact_inquiries').select('created_at, session_id, source, channel, crm_contact_id')
        .gte('created_at', prevFrom.toISOString()).order('created_at').range(a, b)),
    db.from('site_pageviews').select('created_at').order('created_at').limit(1).maybeSingle(),
  ]);

  const fromIso = from.toISOString();
  const views = allViews.filter((v) => v.created_at >= fromIso);
  const prevViews = allViews.filter((v) => v.created_at < fromIso);
  const inquiries = allInquiries.filter((i) => i.created_at >= fromIso);
  const prevInquiries = allInquiries.filter((i) => i.created_at < fromIso);

  const sessions = sessionsFrom(views, inquiries);
  const prevSessions = sessionsFrom(prevViews, prevInquiries);

  // CRM outcome for each inquiry's contact.
  const contactIds = [...new Set(inquiries.map((i) => i.crm_contact_id).filter(Boolean))] as string[];
  const outcomes = new Map<string, { won: boolean; value: number }>();
  if (contactIds.length) {
    const { data } = await db.from('crm_contacts').select('id, stage, value_cents').in('id', contactIds);
    for (const c of data ?? []) outcomes.set(c.id, { won: c.stage === 'won', value: c.value_cents ?? 0 });
  }

  // ---------------------------------------------------------- daily
  const daily = new Map<string, DailyPoint>();
  for (let t = from.getTime(); t <= now.getTime(); t += 86_400_000) {
    const d = dayKey(new Date(t).toISOString());
    daily.set(d, { date: d, visits: 0, pageviews: 0, inquiries: 0 });
  }
  const today = dayKey(now.toISOString());
  if (!daily.has(today)) daily.set(today, { date: today, visits: 0, pageviews: 0, inquiries: 0 });
  for (const s of sessions) { const p = daily.get(dayKey(s.start)); if (p) p.visits += 1; }
  for (const v of views) { const p = daily.get(dayKey(v.created_at)); if (p) p.pageviews += 1; }
  for (const i of inquiries) { const p = daily.get(dayKey(i.created_at)); if (p) p.inquiries += 1; }

  // ---------------------------------------------------------- pages
  const pageMap = new Map<string, { views: number; engaged: number; engagedCount: number; landings: Session[]; converting: Set<string> }>();
  for (const v of views) {
    const p = pageMap.get(v.path) ?? { views: 0, engaged: 0, engagedCount: 0, landings: [], converting: new Set<string>() };
    p.views += 1;
    if (v.engaged_ms != null) { p.engaged += v.engaged_ms; p.engagedCount += 1; }
    pageMap.set(v.path, p);
  }
  for (const s of sessions) {
    const landing = pageMap.get(s.pages[0]);
    landing?.landings.push(s);
    if (s.inquiries > 0) for (const path of new Set(s.pages)) pageMap.get(path)?.converting.add(s.id);
  }
  const pages: PageRow[] = [...pageMap.entries()]
    .map(([path, p]) => ({
      path,
      views: p.views,
      landings: p.landings.length,
      avgEngagedSec: p.engagedCount ? p.engaged / p.engagedCount / 1000 : 0,
      bounceRate: p.landings.length ? p.landings.filter(bounced).length / p.landings.length : null,
      inquiries: p.converting.size,
    }))
    .sort((a, b) => b.views - a.views);

  // ---------------------------------------------------------- sources
  // Inquiries are counted from the inquiry's own attribution, so one sent
  // from a session that started before the period still counts.
  const sourceMap = new Map<string, SourceRow & { sessions: Session[] }>();
  const sourceRow = (source: string, channel: Channel) => {
    const key = `${channel}|${source}`;
    let row = sourceMap.get(key);
    if (!row) {
      row = { source, channel, visits: 0, bounceRate: 0, inquiries: 0, won: 0, wonValueCents: 0, sessions: [] };
      sourceMap.set(key, row);
    }
    return row;
  };
  for (const s of sessions) { const r = sourceRow(s.source, s.channel); r.visits += 1; r.sessions.push(s); }
  const wonCounted = new Set<string>();
  for (const i of inquiries) {
    const r = sourceRow(i.source ?? 'Unknown', i.channel ?? 'direct');
    r.inquiries += 1;
    const outcome = i.crm_contact_id ? outcomes.get(i.crm_contact_id) : undefined;
    if (outcome?.won && !wonCounted.has(i.crm_contact_id!)) {
      wonCounted.add(i.crm_contact_id!);
      r.won += 1;
      r.wonValueCents += outcome.value;
    }
  }
  const sources: SourceRow[] = [...sourceMap.values()]
    .map(({ sessions: list, ...row }) => ({ ...row, bounceRate: list.length ? list.filter(bounced).length / list.length : 0 }))
    .sort((a, b) => b.visits - a.visits || b.inquiries - a.inquiries);

  const channelMap = new Map<Channel, ChannelRow>();
  for (const r of sources) {
    const c = channelMap.get(r.channel) ?? { channel: r.channel, visits: 0, inquiries: 0 };
    c.visits += r.visits;
    c.inquiries += r.inquiries;
    channelMap.set(r.channel, c);
  }
  const channels = [...channelMap.values()].sort((a, b) => b.visits - a.visits);

  const campaignMap = new Map<string, CampaignRow>();
  for (const s of sessions) {
    if (!s.campaign) continue;
    const key = `${s.campaign}|${s.source}`;
    const c = campaignMap.get(key) ?? { campaign: s.campaign, source: s.source, visits: 0, inquiries: 0 };
    c.visits += 1;
    c.inquiries += s.inquiries;
    campaignMap.set(key, c);
  }
  const campaigns = [...campaignMap.values()].sort((a, b) => b.visits - a.visits);

  const devices = breakdown(sessions, (s) => s.device, 5);
  const locations = breakdown(sessions, (s) => s.place, 10);

  const seen = new Set(views.map((v) => v.path));
  const unseenPages = sitemapPaths.filter((p) => !seen.has(p));

  const totals = totalsOf(views, sessions, inquiries.length);
  const previous = totalsOf(prevViews, prevSessions, prevInquiries.length);

  const report: Omit<AnalyticsReport, 'insights'> = {
    days,
    from: fromIso,
    to: now.toISOString(),
    trackingSince: firstView.data?.created_at ?? null,
    totals,
    previous,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    pages,
    sources,
    channels,
    campaigns,
    devices,
    locations,
    unseenPages,
  };

  return { ...report, insights: buildInsights(report) };
}
