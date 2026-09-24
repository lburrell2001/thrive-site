// Reads for the admin CRM: the pipeline board and one contact's full story.
//
// A contact's timeline is assembled here from every table that knows about
// them — notes and stage changes (crm_activities), website inquiries,
// messages and reminders (client_reminders), builder proposals, uploaded
// proposals and invoices — rather than copied into one table, so nothing
// can drift out of sync.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  STAGE_LABEL,
  type CrmContact,
  type CrmContactDetail,
  type CrmContactRow,
  type CrmDeal,
  type CrmDealCard,
  type CrmInquiry,
  type CrmLinkedProposal,
  type CrmStage,
  type CrmTask,
  type TimelineItem,
} from '@/types/crm';
import { formatPhone } from '@/lib/phone';

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function latest(a: string | undefined, b: string | null | undefined): string | undefined {
  if (!b) return a;
  return !a || b > a ? b : a;
}

/** Last time anything happened with each contact: inquiry, note, proposal. */
async function lastTouches(db: SupabaseClient) {
  const [inquiries, activities, proposals] = await Promise.all([
    db.from('contact_inquiries').select('crm_contact_id, crm_deal_id, status, created_at').not('crm_contact_id', 'is', null),
    db.from('crm_activities').select('contact_id, created_at').order('created_at', { ascending: false }),
    db.from('proposals')
      .select('crm_deal_id, status, total_cents, currency, updated_at, proposal_clients ( crm_contact_id )')
      .order('updated_at', { ascending: false }),
  ]);
  const touched = new Map<string, string>();
  const bump = (id: string | null | undefined, at: string) => {
    if (id) touched.set(id, latest(touched.get(id), at)!);
  };
  for (const i of inquiries.data ?? []) bump(i.crm_contact_id, i.created_at);
  for (const a of activities.data ?? []) bump(a.contact_id, a.created_at);
  for (const p of proposals.data ?? []) {
    const link = p.proposal_clients as unknown as { crm_contact_id: string | null } | null;
    bump(link?.crm_contact_id, p.updated_at);
  }
  return { touched, inquiries: inquiries.data ?? [], proposals: proposals.data ?? [] };
}

const isOpen = (stage: CrmStage) => stage === 'lead' || stage === 'contacted' || stage === 'proposal';

export async function loadDealBoard(db: SupabaseClient): Promise<CrmDealCard[]> {
  const [deals, tasks, touches] = await Promise.all([
    db.from('crm_deals')
      .select('*, crm_contacts ( id, name, company, email, tags, portal_client_id )')
      .order('stage_changed_at', { ascending: false }),
    db.from('crm_tasks').select('contact_id, title, due_date').is('completed_at', null),
    lastTouches(db),
  ]);
  if (deals.error) throw new Error(deals.error.message);

  const openTasks = new Map<string, { count: number; due: string | null; title: string | null }>();
  for (const t of tasks.data ?? []) {
    const cur = openTasks.get(t.contact_id) ?? { count: 0, due: null, title: null };
    cur.count += 1;
    // Dated tasks come before undated ones; the earliest date wins.
    if (!cur.title || (t.due_date && (!cur.due || t.due_date < cur.due))) {
      cur.due = t.due_date;
      cur.title = t.title;
    }
    openTasks.set(t.contact_id, cur);
  }

  const newInquiries = new Map<string, number>();
  for (const i of touches.inquiries) {
    if (i.status === 'new' && i.crm_deal_id) newInquiries.set(i.crm_deal_id, (newInquiries.get(i.crm_deal_id) ?? 0) + 1);
  }

  const latestProposal = new Map<string, CrmDealCard['latest_proposal']>();
  for (const p of touches.proposals) {
    if (p.crm_deal_id && !latestProposal.has(p.crm_deal_id)) {
      latestProposal.set(p.crm_deal_id, { status: p.status, total_cents: p.total_cents, currency: p.currency });
    }
  }

  return (deals.data ?? []).map(({ crm_contacts: contact, ...deal }) => {
    const d = deal as CrmDeal;
    // Follow-ups are the contact's; show them on open deals, not closed ones.
    const t = isOpen(d.stage) ? openTasks.get(d.contact_id) : undefined;
    return {
      ...d,
      contact: contact as unknown as CrmDealCard['contact'],
      open_tasks: t?.count ?? 0,
      next_task_due: t?.due ?? null,
      next_task_title: t?.title ?? null,
      new_inquiries: newInquiries.get(d.id) ?? 0,
      latest_proposal: latestProposal.get(d.id) ?? null,
      last_touch_at: latest(touches.touched.get(d.contact_id), d.updated_at) ?? d.created_at,
    };
  });
}

export async function loadContactList(db: SupabaseClient): Promise<CrmContactRow[]> {
  const [contacts, deals, touches] = await Promise.all([
    db.from('crm_contacts').select('*').order('created_at', { ascending: false }),
    db.from('crm_deals').select('contact_id, stage, value_cents'),
    lastTouches(db),
  ]);
  if (contacts.error) throw new Error(contacts.error.message);

  const counts = new Map<string, { deals: number; open: number; won: number }>();
  for (const d of deals.data ?? []) {
    const cur = counts.get(d.contact_id) ?? { deals: 0, open: 0, won: 0 };
    cur.deals += 1;
    if (isOpen(d.stage)) cur.open += 1;
    if (d.stage === 'won') cur.won += d.value_cents ?? 0;
    counts.set(d.contact_id, cur);
  }

  return (contacts.data as CrmContact[]).map((c) => ({
    ...c,
    deals: counts.get(c.id)?.deals ?? 0,
    open_deals: counts.get(c.id)?.open ?? 0,
    won_value_cents: counts.get(c.id)?.won ?? 0,
    last_touch_at: latest(touches.touched.get(c.id), c.updated_at) ?? c.created_at,
  }));
}

const ACTIVITY_TITLE: Record<string, string> = {
  note: 'Note',
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email (logged)',
};

function deliveryLine(r: {
  email_status: string; email_to: string | null; email_error: string | null;
  sms_status: string; sms_to: string | null; sms_error: string | null;
}): string {
  const parts: string[] = [];
  if (r.email_status !== 'skipped' || r.email_error) {
    parts.push(r.email_status === 'sent' ? `Emailed ${r.email_to}` : `Email ${r.email_status}${r.email_error ? ` — ${r.email_error}` : ''}`);
  }
  if (r.sms_status !== 'skipped' || (r.sms_error && r.sms_to)) {
    parts.push(r.sms_status === 'sent' ? `Texted ${formatPhone(r.sms_to)}` : `Text ${r.sms_status}${r.sms_error ? ` — ${r.sms_error}` : ''}`);
  }
  return parts.join(' · ');
}

export async function loadContactDetail(db: SupabaseClient, id: string): Promise<CrmContactDetail | null> {
  const { data: contact } = await db.from('crm_contacts').select('*').eq('id', id).maybeSingle();
  if (!contact) return null;
  const c = contact as CrmContact;

  const { data: recipientRows } = await db
    .from('proposal_clients')
    .select('id, created_at')
    .eq('crm_contact_id', id)
    .order('created_at', { ascending: false });
  const recipientIds = (recipientRows ?? []).map((r) => r.id);
  const portalId = c.portal_client_id;

  // Messages to this person by any route: from the CRM, or reminders sent
  // from the client page or proposal list.
  const reminderFilter = [
    `and(target_type.eq.crm_contact,target_id.eq.${id})`,
    portalId && `portal_client_id.eq.${portalId}`,
    recipientIds.length > 0 && `proposal_client_id.in.(${recipientIds.join(',')})`,
  ].filter(Boolean).join(',');

  const none = Promise.resolve({ data: [] as never[] });
  const [deals, tasks, activities, inquiries, reminders, proposals, portalProfile, portalProposals, invoices] = await Promise.all([
    db.from('crm_deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    db.from('crm_tasks').select('*').eq('contact_id', id)
      .order('completed_at', { ascending: false, nullsFirst: true })
      .order('due_date', { ascending: true, nullsFirst: false }),
    db.from('crm_activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(300),
    db.from('contact_inquiries')
      .select('id, crm_deal_id, created_at, project_type, budget, timeline, message, status, source, first_source')
      .eq('crm_contact_id', id).order('created_at', { ascending: false }),
    db.from('client_reminders').select('*').or(reminderFilter).order('created_at', { ascending: false }).limit(200),
    recipientIds.length
      ? db.from('proposals')
          .select('id, crm_deal_id, title, status, total_cents, currency, created_at, updated_at, sent_at, first_viewed_at, signed_at, declined_at, decline_reason')
          .in('client_id', recipientIds).order('updated_at', { ascending: false })
      : none,
    portalId ? db.from('portal_clients').select('id, full_name').eq('id', portalId).maybeSingle() : Promise.resolve({ data: null }),
    portalId ? db.from('portal_proposals').select('id, name, status, created_at').eq('client_id', portalId) : none,
    portalId ? db.from('portal_invoices').select('id, invoice_number, project_name, amount_cents, due_date, status, created_at').eq('client_id', portalId) : none,
  ]);

  const timeline: TimelineItem[] = [];

  for (const a of activities.data ?? []) {
    if (a.kind === 'stage') {
      const to = a.metadata?.to as CrmStage | undefined;
      const from = a.metadata?.from as CrmStage | undefined;
      const deal = a.metadata?.deal as string | undefined;
      timeline.push({
        key: `activity:${a.id}`,
        kind: 'stage',
        at: a.created_at,
        title: `${deal ? `${deal} → ` : 'Moved to '}${to ? STAGE_LABEL[to] : 'a new stage'}`,
        meta: from ? `from ${STAGE_LABEL[from]}` : null,
        body: a.body || null,
        dealId: a.deal_id ?? null,
      });
    } else {
      timeline.push({
        key: `activity:${a.id}`,
        kind: a.kind,
        at: a.created_at,
        title: ACTIVITY_TITLE[a.kind] ?? 'Note',
        body: a.body,
        activityId: a.id,
      });
    }
  }

  for (const i of (inquiries.data ?? []) as CrmInquiry[]) {
    timeline.push({
      key: `inquiry:${i.id}`,
      kind: 'inquiry',
      at: i.created_at,
      title: `Website inquiry${i.project_type ? ` · ${i.project_type}` : ''}`,
      dealId: i.crm_deal_id,
      meta: [
        i.source && `Via ${i.source}${i.first_source && i.first_source !== i.source ? ` (first found via ${i.first_source})` : ''}`,
        i.budget && `Budget ${i.budget}`,
        i.timeline && `Timeline ${i.timeline}`,
      ].filter(Boolean).join(' · ') || null,
      body: i.message,
    });
  }

  for (const r of reminders.data ?? []) {
    timeline.push({
      key: `message:${r.id}`,
      kind: 'message',
      at: r.created_at,
      title: r.target_type === 'crm_contact' || r.target_type === 'custom' ? r.subject : `Reminder · ${r.subject}`,
      body: r.note,
      meta: deliveryLine(r) || null,
    });
  }

  const proposalRows = (proposals.data ?? []) as (CrmLinkedProposal & {
    created_at: string; sent_at: string | null; first_viewed_at: string | null;
    signed_at: string | null; declined_at: string | null; decline_reason: string | null;
  })[];
  for (const p of proposalRows) {
    const href = `/admin/proposals/${p.id}/edit`;
    const amount = money(p.total_cents, p.currency);
    const push = (suffix: string, at: string | null, title: string, body?: string | null) => {
      if (at) timeline.push({ key: `proposal:${p.id}:${suffix}`, kind: 'proposal', at, title, meta: amount, href, body, dealId: p.crm_deal_id });
    };
    push('created', p.created_at, `Proposal drafted · ${p.title}`);
    push('sent', p.sent_at, `Proposal sent · ${p.title}`);
    push('viewed', p.first_viewed_at, `Proposal opened · ${p.title}`);
    push('signed', p.signed_at, `Proposal signed · ${p.title}`);
    push('declined', p.declined_at, `Proposal declined · ${p.title}`, p.decline_reason ? `“${p.decline_reason}”` : null);
  }

  for (const p of portalProposals.data ?? []) {
    timeline.push({
      key: `portal_proposal:${p.id}`,
      kind: 'portal_proposal',
      at: p.created_at,
      title: `Proposal uploaded to portal · ${p.name}`,
      meta: p.status === 'signed' ? 'Signed' : 'Awaiting signature',
    });
  }

  let paid = 0;
  let outstanding = 0;
  for (const inv of invoices.data ?? []) {
    if (inv.status === 'paid') paid += inv.amount_cents;
    else outstanding += inv.amount_cents;
    timeline.push({
      key: `invoice:${inv.id}`,
      kind: 'invoice',
      at: inv.created_at,
      title: `Invoice ${inv.invoice_number}${inv.project_name ? ` · ${inv.project_name}` : ''}`,
      meta: `${money(inv.amount_cents)} · ${inv.status}`,
    });
  }

  timeline.sort((a, b) => b.at.localeCompare(a.at));

  return {
    contact: c,
    deals: (deals.data ?? []) as CrmDeal[],
    tasks: (tasks.data ?? []) as CrmTask[],
    timeline,
    inquiries: (inquiries.data ?? []) as CrmInquiry[],
    proposals: proposalRows.map(({ id: pid, crm_deal_id, title, status, total_cents, currency, updated_at }) => ({
      id: pid, crm_deal_id, title, status, total_cents, currency, updated_at,
    })),
    proposal_client_id: recipientIds[0] ?? null,
    portal: portalProfile.data
      ? { id: portalProfile.data.id, name: portalProfile.data.full_name, paid_cents: paid, outstanding_cents: outstanding }
      : null,
  };
}
