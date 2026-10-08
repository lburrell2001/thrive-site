// The CRM's Visitors page: people browsing the site, grouped by the id
// their browser keeps (site_pageviews.visitor_id).

export interface VisitPage {
  path: string;
  label: string;
  at: string;
  /** Time the page was visible, when the browser reported it. */
  ms: number | null;
}

/** One visit (a session): where they came from and what they read. */
export interface Visit {
  session_id: string;
  at: string;
  source: string | null;
  pages: VisitPage[];
  ms: number;
}

export interface SiteVisitor {
  /** visitor_id, or "s:<session id>" for views recorded before visitor ids. */
  key: string;
  /** Set once one of their visits sent an inquiry or booked a call. */
  contact: { id: string; name: string; company: string | null } | null;
  place: string | null;
  device: string | null;
  /** How they first arrived, as far back as we can see. */
  first_source: string | null;
  first_seen: string;
  last_seen: string;
  visits: number;
  pages: number;
  ms: number;
  /** Service pages they looked at, most-viewed first. */
  interests: string[];
  /** Newest first, up to 10. */
  sessions: Visit[];
}

export interface VisitorReport {
  days: number;
  generated_at: string;
  visitors: SiteVisitor[];
}
