'use client';

// The Opinly analytics pixel (https://opinly.ai/docs/analytics). It records
// page views, clicks and form submits, reads the source a visitor came from,
// and identifies a visitor by a hash of the email they type into a form, so
// Opinly can say which blog posts and campaigns led to inquiries and paid
// invoices. Leads, bookings, sign-ups and payments are also sent from the
// server (src/lib/opinly.ts) with the visitor's anonymous ID.
//
// Same rules as SiteTracker: production only, never on admin, portal or
// proposal pages, and never in a browser that has signed in to /admin. The
// script can't be unloaded once a visitor navigates on from a public page, so
// the admin and portal layouts also carry data-opinly-no-capture.

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { isBrowserExcluded } from './SiteTracker';

const EXCLUDED = /^\/(admin|portal|p\/|review\/|book\/|newsletter\/unsubscribe)/;

const noSubscribe = () => () => {};

export function OpinlyPixel() {
  const pathname = usePathname();
  // Known only in the browser (localStorage): false while server rendering.
  const allowed = useSyncExternalStore(
    noSubscribe,
    () => process.env.NODE_ENV === 'production' && !isBrowserExcluded(),
    () => false,
  );

  if (!allowed || EXCLUDED.test(pathname ?? '')) return null;
  return (
    <Script
      id="opinly-pixel"
      strategy="afterInteractive"
      src="https://static.opinly.ai/p.js"
      data-key="pk-wzcu5RsnlAFfz8cgv8vkuhi2HEOGwoP4t87BVwZ"
    />
  );
}

interface OpinlyGlobal {
  anonId?: string;
  identify: (input: { email: string; userId?: string }) => void;
  track: (event: string, properties?: Record<string, unknown>, opts?: { externalEventId?: string }) => void;
}

function pixel(): OpinlyGlobal | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as { opinly?: OpinlyGlobal }).opinly;
}

/** This browser's Opinly visitor ID, sent with a form so the server can attribute it. */
export function opinlyAnonId(): string | null {
  return pixel()?.anonId ?? null;
}

/**
 * Link this visitor to the email they gave. The pixel usually does this on
 * its own from the email field; calling it after a successful submit covers
 * fields it can't recognise. The first identify wins, so a later one is a
 * no-op. Waits for the pixel if it hasn't loaded yet.
 */
export function opinlyIdentify(email: string) {
  const address = email.trim();
  if (!address) return;
  const run = () => pixel()?.identify({ email: address });
  if (pixel()) run();
  else if (typeof window !== 'undefined') window.addEventListener('opinly:ready', run, { once: true });
}
