'use client';

// Times each portal page a signed-in client views (migration 059): a page
// event when it opens, its on-screen time sent when they move to another page,
// switch tabs or leave (sendBeacon). Time with the tab hidden doesn't count.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { portalSessionId, refreshPortalToken, sendPortalEvents, type PortalEvent } from '@/lib/portalTrack';

export default function PortalTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const base: PortalEvent = { id: crypto.randomUUID(), kind: 'page', session_id: portalSessionId(), path: pathname, started_at: new Date().toISOString() };
    let shown = 0;
    let since: number | null = document.visibilityState === 'visible' ? performance.now() : null;
    const elapsed = () => Math.round(shown + (since !== null ? performance.now() - since : 0));

    void refreshPortalToken().then(() => { if (!cancelled) sendPortalEvents([base]); });

    const flush = (beacon: boolean) => sendPortalEvents([{ ...base, duration_ms: elapsed() }], beacon);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (since !== null) { shown += performance.now() - since; since = null; }
        flush(true);
      } else {
        since = performance.now();
        void refreshPortalToken();
      }
    };
    const onLeave = () => flush(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onLeave);
      flush(false);
    };
  }, [pathname]);

  return null;
}
