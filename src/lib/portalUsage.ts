// What a client does in the portal (migration 059), summed for admin: the
// last time they were in, sign-ins, visits (browser sessions) and time spent,
// the pages they spend time on, and their recent visits with what they did.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PORTAL_PAGES: Record<string, string> = {
  '/portal/dashboard': 'Dashboard', '/portal/onboarding': 'Onboarding', '/portal/progress': 'My Projects',
  '/portal/proposals': 'Proposals', '/portal/vault': 'Secure Vault', '/portal/invoices': 'Billing',
  '/portal/settings': 'Settings', '/portal/requests': 'Brain Dump', '/portal/files': 'Files', '/portal/welcome': 'Welcome walkthrough',
};
export const pageName = (path: string | null) =>
  !path ? 'Portal' : PORTAL_PAGES[path] ?? (path.startsWith('/portal/onboarding/') ? 'A questionnaire' : path.replace(/^\/portal\//, ''));

export type PortalVisit = { session_id: string; started_at: string; ended_at: string; ms: number; pages: string[]; actions: string[]; signed_in: boolean };
export type PortalUsage = {
  days: number; last_seen: string | null; sign_ins: number; visits: number; total_ms: number;
  pages: { name: string; views: number; ms: number }[]; recent: PortalVisit[];
};

export async function portalUsage(db: SupabaseClient, clientId: string, days = 30): Promise<PortalUsage | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db.from('portal_events').select('kind, session_id, path, label, started_at, duration_ms')
    .eq('client_id', clientId).gte('started_at', since).order('started_at', { ascending: true }).limit(5000);
  if (error) return null; // before 059
  const rows = data ?? [];
  const { data: last } = await db.from('portal_events').select('started_at, duration_ms').eq('client_id', clientId).order('started_at', { ascending: false }).limit(1).maybeSingle();

  const pages = new Map<string, { name: string; views: number; ms: number }>();
  const visits = new Map<string, PortalVisit>();
  for (const r of rows) {
    const v: PortalVisit = visits.get(r.session_id) ?? { session_id: r.session_id, started_at: r.started_at, ended_at: r.started_at, ms: 0, pages: [], actions: [], signed_in: false };
    const end = new Date(Date.parse(r.started_at) + (r.duration_ms ?? 0)).toISOString();
    if (end > v.ended_at) v.ended_at = end;
    if (r.kind === 'page') {
      const name = pageName(r.path);
      v.ms += r.duration_ms ?? 0;
      if (v.pages[v.pages.length - 1] !== name) v.pages.push(name);
      const pg = pages.get(name) ?? { name, views: 0, ms: 0 };
      pg.views += 1; pg.ms += r.duration_ms ?? 0;
      pages.set(name, pg);
    } else if (r.kind === 'action' && r.label) v.actions.push(r.label);
    else if (r.kind === 'sign_in') v.signed_in = true;
    visits.set(r.session_id, v);
  }
  const all = [...visits.values()].filter((v) => v.pages.length || v.actions.length || v.signed_in);
  return {
    days,
    last_seen: last ? new Date(Date.parse(last.started_at) + (last.duration_ms ?? 0)).toISOString() : null,
    sign_ins: rows.filter((r) => r.kind === 'sign_in').length,
    visits: all.length,
    total_ms: all.reduce((n, v) => n + v.ms, 0),
    pages: [...pages.values()].sort((a, b) => b.ms - a.ms),
    recent: all.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 12),
  };
}
