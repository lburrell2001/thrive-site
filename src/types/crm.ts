// CRM shapes shared by the /api/crm routes and the admin CRM page.

export const CRM_STAGES = ['lead', 'contacted', 'proposal', 'won', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const STAGE_LABEL: Record<CrmStage, string> = {
  lead: 'New lead',
  contacted: 'Contacted',
  proposal: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
};

export const ACTIVITY_KINDS = ['note', 'call', 'meeting', 'email'] as const;
export type CrmActivityKind = (typeof ACTIVITY_KINDS)[number];

/** A person. Their pieces of work are deals. */
export interface CrmContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  tags: string[];
  portal_client_id: string | null;
  /** Null = never asked; only 'subscribed' receives newsletters. */
  newsletter_status: 'pending' | 'subscribed' | 'unsubscribed' | null;
  newsletter_source: string | null;
  newsletter_consent_note: string | null;
  newsletter_subscribed_at: string | null;
  newsletter_unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One opportunity with a contact: what the pipeline board shows. */
export interface CrmDeal {
  id: string;
  contact_id: string;
  title: string;
  stage: CrmStage;
  stage_changed_at: string;
  value_cents: number | null;
  lost_reason: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

/** A deal on the board, with its contact and just enough to flag it. */
export interface CrmDealCard extends CrmDeal {
  contact: Pick<CrmContact, 'id' | 'name' | 'company' | 'email' | 'tags' | 'portal_client_id'>;
  /** Open follow-ups are per contact; shown on each of their open deals. */
  open_tasks: number;
  /** Earliest due date among open tasks, YYYY-MM-DD. */
  next_task_due: string | null;
  next_task_title: string | null;
  new_inquiries: number;
  /** Latest builder proposal on this deal, for the card's one-line status. */
  latest_proposal: { status: string; total_cents: number; currency: string } | null;
  last_touch_at: string;
}

/** A contact in the Contacts list. */
export interface CrmContactRow extends CrmContact {
  deals: number;
  open_deals: number;
  won_value_cents: number;
  last_touch_at: string;
}

export interface CrmTask {
  id: string;
  contact_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export type TimelineKind =
  | 'note' | 'call' | 'meeting' | 'email' | 'stage'
  | 'inquiry' | 'message' | 'proposal' | 'portal_proposal' | 'invoice' | 'review' | 'newsletter';

export interface TimelineItem {
  /** Unique across sources, e.g. "activity:<uuid>". */
  key: string;
  kind: TimelineKind;
  at: string;
  title: string;
  body?: string | null;
  /** Small secondary line: amounts, statuses, delivery results. */
  meta?: string | null;
  href?: string | null;
  /** Set on notes Lauren wrote, which she can delete. */
  activityId?: string;
  /** The deal this entry is about, when it is about one. */
  dealId?: string | null;
}

export interface CrmInquiry {
  id: string;
  crm_deal_id: string | null;
  created_at: string;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  message: string | null;
  status: string;
  /** Where the visit that sent it came from; null before tracking. */
  source: string | null;
  first_source: string | null;
}

export interface CrmLinkedProposal {
  id: string;
  crm_deal_id: string | null;
  title: string;
  status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
}

export interface CrmContactDetail {
  contact: CrmContact;
  /** Newest first. */
  deals: CrmDeal[];
  /** Review requests and reviews, for the "Ask for a review" button on each deal. */
  reviews: { id: string; crm_deal_id: string | null; status: string; rating: number | null; requested_at: string | null }[];
  tasks: CrmTask[];
  timeline: TimelineItem[];
  inquiries: CrmInquiry[];
  proposals: CrmLinkedProposal[];
  /** The proposal recipient record to preselect when starting a proposal. */
  proposal_client_id: string | null;
  portal: { id: string; name: string; paid_cents: number; outstanding_cents: number } | null;
}
