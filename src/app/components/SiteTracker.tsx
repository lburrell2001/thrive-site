'use client';

// Records page views for the admin analytics dashboard. No cookies: the
// session id lives in sessionStorage (gone when the tab closes), and the
// first visit's source is kept in localStorage so an inquiry can say how
// this person first found the site.
//
// Admin, portal and proposal pages are never tracked, and neither is any
// browser that has signed in to /admin (see markThisBrowserAsAdmin).

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'thrive_sid';
const SESSION_SEEN_KEY = 'thrive_sid_seen';
const FIRST_TOUCH_KEY = 'thrive_first_touch';
const NO_TRACK_KEY = 'thrive_no_track';
const SESSION_IDLE_MS = 30 * 60_000;

const EXCLUDED = /^\/(admin|portal|p\/|api\/)/;

export interface FirstTouch {
  ref: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  click: string | null;
  landing: string;
  at: string;
}

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stop counting this browser's visits. Called when admin signs in. */
export function markThisBrowserAsAdmin(excluded = true) {
  const ls = storage('local');
  if (!ls) return;
  if (excluded) ls.setItem(NO_TRACK_KEY, '1');
  else ls.removeItem(NO_TRACK_KEY);
}

export function isBrowserExcluded() {
  return storage('local')?.getItem(NO_TRACK_KEY) === '1';
}

/** What the contact form sends so an inquiry can be traced to its visit. */
export function readAttribution(): { sessionId: string | null; firstTouch: FirstTouch | null } {
  const ss = storage('session');
  const ls = storage('local');
  let firstTouch: FirstTouch | null = null;
  try {
    firstTouch = JSON.parse(ls?.getItem(FIRST_TOUCH_KEY) ?? 'null');
  } catch {
    firstTouch = null;
  }
  return { sessionId: ss?.getItem(SESSION_KEY) ?? null, firstTouch };
}

function send(body: object, beacon = false): Promise<{ id?: string } | null> {
  const json = JSON.stringify(body);
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([json], { type: 'text/plain' }));
    return Promise.resolve(null);
  }
  return fetch('/api/track', { method: 'POST', body: json, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
    .then((r) => (r.status === 200 ? r.json() : null))
    .catch(() => null);
}

export function SiteTracker() {
  const pathname = usePathname();
  // The current page's row and how long it has been visible.
  const current = useRef<{ id: string | null; sid: string; visibleSince: number | null; ms: number } | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!pathname || EXCLUDED.test(pathname) || isBrowserExcluded() || navigator.webdriver) return;

    const ss = storage('session');
    const now = Date.now();
    let sid = ss?.getItem(SESSION_KEY) ?? null;
    const lastSeen = Number(ss?.getItem(SESSION_SEEN_KEY) ?? 0);
    const landing = !sid || now - lastSeen > SESSION_IDLE_MS;
    if (landing) {
      sid = randomId();
      ss?.setItem(SESSION_KEY, sid);
    }
    ss?.setItem(SESSION_SEEN_KEY, String(now));

    const params = new URLSearchParams(window.location.search);
    const click = ['gclid', 'fbclid', 'msclkid'].find((k) => params.has(k)) ?? null;
    // document.referrer is only meaningful for the page the visitor arrived on.
    const ref = landing && document.referrer ? document.referrer : null;

    if (landing) {
      const ls = storage('local');
      if (ls && !ls.getItem(FIRST_TOUCH_KEY)) {
        const first: FirstTouch = {
          ref,
          utm_source: params.get('utm_source'),
          utm_medium: params.get('utm_medium'),
          utm_campaign: params.get('utm_campaign'),
          click,
          landing: pathname,
          at: new Date().toISOString(),
        };
        ls.setItem(FIRST_TOUCH_KEY, JSON.stringify(first));
      }
    }

    const page = { id: null as string | null, sid: sid!, visibleSince: document.visibilityState === 'visible' ? now : null, ms: 0 };
    current.current = page;

    void send({
      t: 'pv',
      sid,
      path: pathname,
      landing,
      ref,
      utm_source: landing ? params.get('utm_source') : null,
      utm_medium: landing ? params.get('utm_medium') : null,
      utm_campaign: landing ? params.get('utm_campaign') : null,
      utm_content: landing ? params.get('utm_content') : null,
      utm_term: landing ? params.get('utm_term') : null,
      click: landing ? click : null,
    }).then((res) => {
      if (res?.id) page.id = res.id;
    });

    const flush = () => {
      if (page.visibleSince != null) {
        page.ms += Date.now() - page.visibleSince;
        page.visibleSince = null;
      }
      if (page.id) void send({ t: 'engage', id: page.id, sid: page.sid, ms: Math.round(page.ms) }, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
      else page.visibleSince = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      // Navigating to another page in the app: report this one's time.
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [pathname]);

  return null;
}
