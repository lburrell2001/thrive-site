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

export interface CrmContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: CrmStage;
  stage_changed_at: string;
  value_cents: number | null;
  source: string;
  tags: string[];
  lost_reason: string | null;
  portal_client_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A contact on the board, with just enough to sort and flag it. */
export interface CrmContactCard extends CrmContact {
  open_tasks: number;
  /** Earliest due date among open tasks, YYYY-MM-DD. */
  next_task_due: string | null;
  next_task_title: string | null;
  new_inquiries: number;
  /** Latest builder proposal, for the card's one-line status. */
  latest_proposal: { status: string; total_cents: number; currency: string } | null;
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
  | 'inquiry' | 'message' | 'proposal' | 'portal_proposal' | 'invoice';

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
}

export interface CrmInquiry {
  id: string;
  created_at: string;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  message: string | null;
  status: string;
}

export interface CrmLinkedProposal {
  id: string;
  title: string;
  status: string;
  total_cents: number;
  currency: string;
  updated_at: string;
}

export interface CrmContactDetail {
  contact: CrmContact;
  tasks: CrmTask[];
  timeline: TimelineItem[];
  inquiries: CrmInquiry[];
  proposals: CrmLinkedProposal[];
  /** The proposal recipient record to preselect when starting a proposal. */
  proposal_client_id: string | null;
  portal: { id: string; name: string; paid_cents: number; outstanding_cents: number } | null;
}
