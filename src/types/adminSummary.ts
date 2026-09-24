// What needs attention, for the admin home page and the weekly digest.
// Built by src/lib/adminSummary.ts.

import type { CrmStage } from '@/types/crm';
import type { Insight } from '@/types/analytics';

export interface FollowUpItem {
  id: string;
  title: string;
  due_date: string;
  overdue: boolean;
  contact_id: string;
  contact_name: string;
}

export interface InquiryItem {
  id: string;
  created_at: string;
  name: string;
  email: string;
  project_type: string | null;
  budget: string | null;
  source: string | null;
  contact_id: string | null;
  deal_id: string | null;
}

export interface AwaitingProposal {
  /** 'builder' proposals live at /admin/proposals; 'portal' ones are uploaded PDFs. */
  kind: 'builder' | 'portal';
  id: string;
  title: string;
  client_name: string;
  status: string;
  total_cents: number | null;
  currency: string;
  /** When it was sent (builder) or uploaded (portal). */
  since: string | null;
  viewed: boolean;
  client_id: string | null;
  last_reminded_at: string | null;
}

export interface UnpaidInvoice {
  id: string;
  invoice_number: string;
  project_name: string | null;
  amount_cents: number;
  due_date: string;
  overdue: boolean;
  client_id: string;
  client_name: string;
  last_reminded_at: string | null;
}

export interface AdminSummary {
  /** Dallas date the summary was built for, YYYY-MM-DD. */
  today: string;
  /** Open tasks due up to a week from today, overdue first. */
  followUps: FollowUpItem[];
  newInquiries: InquiryItem[];
  pipeline: {
    stages: Record<CrmStage, { count: number; value_cents: number }>;
    open_value_cents: number;
    won_this_month_cents: number;
  };
  proposalsAwaiting: AwaitingProposal[];
  unpaidInvoices: UnpaidInvoice[];
  unpaidTotals: { overdue_cents: number; due_cents: number };
  /** Last 7 days vs the 7 before; null if analytics could not load. */
  traffic: {
    visits: number;
    previous_visits: number;
    inquiries: number;
    previous_inquiries: number;
    top_source: { source: string; visits: number } | null;
    top_insight: Insight | null;
    /** Google search for the same week, when Search Console is connected. */
    search: {
      clicks: number;
      previous_clicks: number;
      impressions: number;
      top_queries: { query: string; clicks: number; position: number }[];
    } | null;
  } | null;
}
