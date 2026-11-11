// Browser side of portal analytics (migration 059): sign-ins, each page a
// client views with the time it was on screen, and actions they take. Sent
// to POST /api/portal/track with their own token; sendBeacon on the way out
// so the last page's time still arrives. Never throws, never blocks.

import { supabasePortal } from './supabasePortal';

export type PortalEventKind = 'sign_in' | 'page' | 'action';
export type PortalEvent = { id: string; kind: PortalEventKind; session_id: string; path?: string; label?: string; started_at?: string; duration_ms?: number };

const SID_KEY = 'thrive_portal_sid';
let token: string | null = null;

/** One id per browser session in the portal (a "visit"). */
export function portalSessionId(fresh = false): string {
  try {
    let sid = fresh ? null : sessionStorage.getItem(SID_KEY);
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(SID_KEY, sid); }
    return sid;
  } catch {
    return 'no-session-storage';
  }
}

/** Keeps the token handy for sendBeacon, which can't wait for an async lookup. */
export async function refreshPortalToken(): Promise<string | null> {
  try {
    const { data } = await supabasePortal.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch { /* signed out */ }
  return token;
}

export function sendPortalEvents(events: PortalEvent[], beacon = false) {
  if (!events.length || !token) return;
  const body = JSON.stringify({ token, events });
  try {
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/api/portal/track', new Blob([body], { type: 'application/json' })); return; }
    void fetch('/api/portal/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* never block the portal */ }
}

/** A sign-in or an action ("Paid INV-003", "Downloaded INV-003 PDF"…). */
export async function portalTrack(kind: 'sign_in' | 'action', data: { label: string; path?: string }) {
  if (!token) await refreshPortalToken();
  const event: PortalEvent = {
    id: crypto.randomUUID(), kind, session_id: portalSessionId(kind === 'sign_in'),
    label: data.label.slice(0, 200), path: data.path ?? (typeof location !== 'undefined' ? location.pathname : undefined),
    started_at: new Date().toISOString(),
  };
  sendPortalEvents([event]);
}
