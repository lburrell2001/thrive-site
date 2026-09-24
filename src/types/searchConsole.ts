// Google Search Console data for the analytics page and digest.
// Built by src/lib/searchConsole.ts.

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** Clicks per impression, 0–1. */
  ctr: number;
  /** Average ranking position, 1 = top result. */
  position: number;
}

export interface SearchRow extends SearchTotals {
  /** The search query, or the page path for page rows. */
  key: string;
}

export type SearchSection =
  | { status: 'not_configured' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      /** Search Console runs about two days behind, so the range ends then. */
      from: string;
      to: string;
      totals: SearchTotals;
      previous: SearchTotals;
      daily: { date: string; clicks: number; impressions: number }[];
      queries: SearchRow[];
      pages: SearchRow[];
    };
