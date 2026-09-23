// The admin analytics report, built by src/lib/analyticsReport.ts.

import type { Channel } from '@/lib/trafficSource';

export interface Totals {
  visits: number;
  pageviews: number;
  /** Sum of daily unique visitors — visitor ids reset each day by design. */
  visitors: number;
  inquiries: number;
  /** Inquiries per visit, 0–1. */
  conversionRate: number;
  /** Share of visits that saw one page for under 10 seconds, 0–1. */
  bounceRate: number;
  avgEngagedSec: number;
}

export interface DailyPoint {
  date: string;
  visits: number;
  pageviews: number;
  inquiries: number;
}

export interface PageRow {
  path: string;
  views: number;
  landings: number;
  avgEngagedSec: number;
  /** Share of visits landing here that bounced; null with no landings. */
  bounceRate: number | null;
  /** Visits that saw this page and then sent an inquiry. */
  inquiries: number;
}

export interface SourceRow {
  source: string;
  channel: Channel;
  visits: number;
  bounceRate: number;
  inquiries: number;
  /** CRM contacts from these inquiries now marked Won. */
  won: number;
  wonValueCents: number;
}

export interface ChannelRow {
  channel: Channel;
  visits: number;
  inquiries: number;
}

export interface CampaignRow {
  campaign: string;
  source: string;
  visits: number;
  inquiries: number;
}

export interface BreakdownRow {
  label: string;
  visits: number;
  bounceRate: number;
}

export type InsightTone = 'opportunity' | 'warning' | 'win' | 'info';

export interface Insight {
  id: string;
  tone: InsightTone;
  /** Higher sorts first. */
  priority: number;
  title: string;
  /** The numbers behind it. */
  evidence: string;
  /** What to do about it. */
  actions: string[];
}

export interface AnalyticsReport {
  days: number;
  from: string;
  to: string;
  /** First page view ever recorded, so an empty report can say why. */
  trackingSince: string | null;
  totals: Totals;
  previous: Totals;
  daily: DailyPoint[];
  pages: PageRow[];
  sources: SourceRow[];
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  devices: BreakdownRow[];
  locations: BreakdownRow[];
  /** Sitemap pages nobody visited in the period. */
  unseenPages: string[];
  insights: Insight[];
}
