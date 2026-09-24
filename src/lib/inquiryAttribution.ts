// Where an inquiry came from, for the analytics dashboard. Shared by the
// contact form route and the booking route.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyVisit } from "@/lib/trafficSource";

/** What the browser sends: its session id and how it first found the site. */
export interface AttributionInput {
  sessionId?: string | null;
  firstTouch?: {
    ref?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    click?: string | null;
  } | null;
}

export type Attribution = {
  session_id: string | null;
  source: string | null;
  channel: string | null;
  landing_path: string | null;
  utm_campaign: string | null;
  first_source: string | null;
  first_channel: string | null;
};

/**
 * Where this inquiry came from, for the analytics dashboard: the landing of
 * the visit it was sent in (classified when that page view was recorded),
 * and how this browser first found the site. Never throws.
 */
export async function attributionFor(
  db: SupabaseClient,
  a: AttributionInput | null | undefined,
  host: string | null,
): Promise<Attribution | null> {
  if (!a) return null;
  try {
    const sid = typeof a.sessionId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(a.sessionId) ? a.sessionId : null;
    let session: { source: string | null; channel: string | null; path: string; utm_campaign: string | null } | null = null;
    if (sid) {
      const { data } = await db
        .from("site_pageviews")
        .select("source, channel, path, utm_campaign")
        .eq("session_id", sid)
        .eq("is_landing", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = data ?? null;
    }

    const cap = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);
    const ft = a.firstTouch;
    const first = ft
      ? classifyVisit(
          {
            referrer: cap(ft.ref, 500),
            utm_source: cap(ft.utm_source, 100),
            utm_medium: cap(ft.utm_medium, 100),
            click_id: cap(ft.click, 20),
          },
          host
        )
      : null;

    return {
      session_id: sid,
      source: session?.source ?? null,
      channel: session?.channel ?? null,
      landing_path: session?.path ?? null,
      utm_campaign: session?.utm_campaign ?? cap(ft?.utm_campaign, 150),
      first_source: first?.source ?? session?.source ?? null,
      first_channel: first?.channel ?? session?.channel ?? null,
    };
  } catch (error) {
    console.error("Inquiry attribution failed:", error);
    return null;
  }
}
