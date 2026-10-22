// Opinly: the /blog content API and server-side conversion events.
//
// Both read OPINLY_API_KEY from the environment (never written here). Site
// URL and blog path are reported from the env vars withOpinlyConfig sets in
// next.config.ts. createOpinlyClient throws without the key, so the clients
// are made on first use (as the Supabase clients are): a missing key breaks
// the blog, never the contact form or a payment.

import 'server-only';
import { createOpinlyClient, type OpinlyClient, type StandardEvent } from '@opinly/backend';

/**
 * Blog content. `force-cache` keeps responses in the data cache and every
 * fetch carries the 'opinly' tag, so the webhook (/api/opinly) can drop them
 * all with one revalidateTag the moment something is published.
 */
let content: OpinlyClient | null = null;
export const opinly = new Proxy({} as OpinlyClient, {
  get(_, prop: keyof OpinlyClient) {
    content ??= createOpinlyClient({
      fetch: (url, init) => fetch(url, { ...init, cache: 'force-cache', next: { tags: ['opinly'] } }),
    });
    return content[prop];
  },
});

// Events are POSTs that must reach Opinly every time, so they get a plain,
// uncached client of their own.
let eventsClient: OpinlyClient | null = null;
const events = () => (eventsClient ??= createOpinlyClient());

export interface Visitor {
  /** The browser's Opinly anonymous ID (window.opinly.anonId), sent with the form. */
  anonId?: string | null;
  email?: string | null;
}

/** A browser-supplied anonymous ID, kept only if it looks like one. */
export function cleanAnonId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[\w-]{6,100}$/.test(value) ? value : undefined;
}

function link(visitor: Visitor) {
  return {
    ...(visitor.anonId ? { anonId: visitor.anonId } : {}),
    ...(visitor.email ? { email: visitor.email.trim().toLowerCase() } : {}),
  };
}

const enabled = () => Boolean(process.env.OPINLY_API_KEY);

/**
 * Record a conversion server-side, attributed to the visitor by anonymous ID
 * and/or email (Opinly stores only a hash of the email). `externalEventId`
 * makes retries safe. Never throws: analytics must not break a form or a
 * payment, so call it from `after()`.
 */
export async function trackConversion(
  event: Extract<StandardEvent, 'generate_lead' | 'sign_up'>,
  visitor: Visitor,
  properties: Record<string, unknown>,
  externalEventId: string,
): Promise<void> {
  if (!enabled() || (!visitor.anonId && !visitor.email)) return;
  try {
    await events().track(event, properties, { externalEventId, ...link(visitor) });
  } catch (error) {
    console.error(`[opinly] ${event} not recorded:`, error instanceof Error ? error.message : error);
  }
}

/** A paid invoice, as revenue in dollars. Deduped on the invoice id. */
export async function trackPurchase(orderId: string, cents: number, currency: string, visitor: Visitor): Promise<void> {
  if (!enabled() || cents <= 0) return;
  try {
    await events().trackPurchase({ orderId, value: cents / 100, currency: currency.toUpperCase(), ...link(visitor) });
  } catch (error) {
    console.error('[opinly] purchase not recorded:', error instanceof Error ? error.message : error);
  }
}
