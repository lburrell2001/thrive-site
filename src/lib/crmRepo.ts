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
  type CrmCallLog,
  type CrmCallRow,
  type CrmTask,
  type CrmToday,
  type TimelineItem,
} from '@/types/crm';
import { formatPhone } from '@/lib/phone';
import { callSummary, readCall } from '@/lib/calls';
import { visitsForContact } from '@/lib/siteVisitors';

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

  const counts = new Map<string, { deals: number; open: number; won: number; wonDeals: number }>();
  for (const d of deals.data ?? []) {
    const cur = counts.get(d.contact_id) ?? { deals: 0, open: 0, won: 0, wonDeals: 0 };
    cur.deals += 1;
    if (isOpen(d.stage)) cur.open += 1;
    if (d.stage === 'won') { cur.won += d.value_cents ?? 0; cur.wonDeals += 1; }
    counts.set(d.contact_id, cur);
  }

  return (contacts.data as CrmContact[]).map((c) => ({
    ...c,
    deals: counts.get(c.id)?.deals ?? 0,
    open_deals: counts.get(c.id)?.open ?? 0,
    won_value_cents: counts.get(c.id)?.won ?? 0,
    won_deals: counts.get(c.id)?.wonDeals ?? 0,
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

  const { data: reviewRows } = await db
    .from('reviews')
    .select('id, crm_deal_id, status, rating, body, display_name, requested_at, submitted_at')
    .eq('crm_contact_id', id)
    .order('created_at', { ascending: false });
  const reviewIds = (reviewRows ?? []).map((r) => r.id);

  // Messages to this person by any route: from the CRM, or reminders sent
  // from the client page or proposal list.
  const reminderFilter = [
    `and(target_type.eq.crm_contact,target_id.eq.${id})`,
    portalId && `portal_client_id.eq.${portalId}`,
    recipientIds.length > 0 && `proposal_client_id.in.(${recipientIds.join(',')})`,
    reviewIds.length > 0 && `and(target_type.eq.review,target_id.in.(${reviewIds.join(',')}))`,
  ].filter(Boolean).join(',');

  const none = Promise.resolve({ data: [] as never[] });
  const [deals, tasks, activities, inquiries, reminders, proposals, portalProfile, portalProposals, invoices, newsletters, prospects, replies, print, bookings] = await Promise.all([
    db.from('crm_deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    db.from('crm_tasks').select('*').eq('contact_id', id)
      .order('completed_at', { ascending: false, nullsFirst: true })
      .order('due_date', { ascending: true, nullsFirst: false }),
    db.from('crm_activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(300),
    db.from('contact_inquiries')
      .select('id, crm_deal_id, created_at, project_type, budget, timeline, message, status, source, first_source, session_id')
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
    db.from('newsletter_sends').select('id, status, error, sent_at, newsletters ( id, subject )').eq('contact_id', id).order('sent_at', { ascending: false }).limit(100),
    db.from('prospect_emails').select('id, subject, body, style, status, error, sent_at').eq('contact_id', id).order('sent_at', { ascending: false }).limit(100),
    db.from('email_replies').select('id, subject, text, from_email, received_at').eq('contact_id', id).order('received_at', { ascending: false }).limit(100),
    db.from('marketing_recipients').select('id, outcome, note, created_at, marketing_campaigns ( id, name, piece, sent_on )').eq('contact_id', id),
    db.from('bookings').select('id, starts_at, ends_at, status, notes, crm_deal_id').eq('crm_contact_id', id).order('starts_at', { ascending: false }).limit(50),
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
    } else if (a.kind === 'call') {
      const call = readCall(a.metadata);
      timeline.push({
        key: `activity:${a.id}`,
        kind: 'call',
        at: a.created_at,
        title: call ? `Call · ${callSummary(call)}` : 'Call',
        body: a.body || null,
        activityId: a.id,
        dealId: a.deal_id ?? null,
        call,
      });
    } else {
      timeline.push({
        key: `activity:${a.id}`,
        kind: a.kind,
        at: a.created_at,
        title: ACTIVITY_TITLE[a.kind] ?? 'Note',
        body: a.body,
        activityId: a.id,
        dealId: a.deal_id ?? null,
      });
    }
  }

  // Website visits, once an inquiry tied a browser to this person.
  const sessionIds = (inquiries.data ?? []).map((i) => (i as { session_id?: string | null }).session_id).filter((v): v is string => Boolean(v));
  for (const v of await visitsForContact(db, sessionIds)) {
    const mins = Math.round(v.ms / 60_000);
    timeline.push({
      key: `visit:${v.session_id}`,
      kind: 'visit',
      at: v.at,
      title: `Visited the site · ${v.pages.length} page${v.pages.length === 1 ? '' : 's'}${mins ? ` · ${mins} min` : ''}`,
      meta: v.source ? `From ${v.source}` : null,
      body: v.pages.map((pg) => pg.label).join(' → '),
    });
  }

  // Calls booked through /book. The booking's inquiry shows separately.
  for (const b of bookings.data ?? []) {
    const minutes = Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000);
    const upcoming = b.status === 'confirmed' && Date.parse(b.starts_at) > Date.now();
    timeline.push({
      key: `booking:${b.id}`,
      kind: 'call',
      at: b.starts_at,
      title: b.status === 'cancelled' ? 'Booked call · cancelled' : upcoming ? 'Booked call · coming up' : 'Booked call',
      meta: `${minutes} min, booked through the website`,
      body: b.notes || null,
      dealId: b.crm_deal_id,
    });
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
      title: r.target_type === 'review'
        ? 'Review requested'
        : r.target_type === 'crm_contact' || r.target_type === 'custom' ? r.subject : `Reminder · ${r.subject}`,
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

  // Review requests show as messages (from client_reminders); the review
  // itself shows when it arrives.
  for (const r of reviewRows ?? []) {
    if (!r.submitted_at) continue;
    timeline.push({
      key: `review:${r.id}`,
      kind: 'review',
      at: r.submitted_at,
      title: `Review received${r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}`,
      body: r.body ? `“${r.body}”` : null,
      meta: r.status === 'approved' ? 'On the website' : r.status === 'hidden' ? 'Hidden' : 'Waiting for approval in Reviews',
      href: '/admin/reviews',
      dealId: r.crm_deal_id,
    });
  }

  for (const n of newsletters.data ?? []) {
    const letter = n.newsletters as unknown as { id: string; subject: string } | null;
    timeline.push({
      key: `newsletter:${n.id}`,
      kind: 'newsletter',
      at: n.sent_at,
      title: `Email · ${letter?.subject || 'Untitled'}`,
      meta: n.status === 'sent' ? 'Sent' : `Failed — ${n.error ?? 'unknown error'}`,
      href: letter ? `/admin/crm/emails/${letter.id}` : null,
    });
  }

  for (const r of print.data ?? []) {
    const c = r.marketing_campaigns as unknown as { id: string; name: string; piece: string; sent_on: string | null } | null;
    if (!c) continue;
    const piece = c.piece.replace(/_/g, ' ');
    timeline.push({
      key: `print:${r.id}`,
      kind: 'print',
      at: c.sent_on ? `${c.sent_on}T12:00:00` : r.created_at,
      title: `${piece[0].toUpperCase()}${piece.slice(1)} · ${c.name}`,
      meta: { sent: c.sent_on ? 'Sent' : 'On the list — not sent yet', responded: 'Got in touch', lead: 'Became a lead', won: 'Became a client', no_response: 'No response' }[r.outcome as string] ?? r.outcome,
      body: r.note || null,
      href: `/admin/crm/campaigns/${c.id}`,
    });
  }

  for (const r of replies.data ?? []) {
    timeline.push({
      key: `reply:${r.id}`,
      kind: 'reply',
      at: r.received_at,
      title: `They replied · ${r.subject || '(no subject)'}`,
      body: r.text ? r.text.slice(0, 1200) : null,
      meta: `From ${r.from_email}`,
    });
  }

  for (const e of prospects.data ?? []) {
    timeline.push({
      key: `prospect:${e.id}`,
      kind: 'prospect',
      at: e.sent_at,
      title: `Email · ${e.subject}`,
      body: e.body ? e.body.split('\n—\n')[0].trim().slice(0, 600) : null,
      meta: e.status === 'sent' ? `Sent · ${e.style === 'designed' ? 'Designed' : 'Personal'}` : `Failed — ${e.error ?? 'unknown error'}`,
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
    reviews: (reviewRows ?? []).map(({ id: rid, crm_deal_id, status, rating, requested_at }) => ({ id: rid, crm_deal_id, status, rating, requested_at })),
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

/** Two weeks without a note, email or proposal: worth a nudge. */
const QUIET_DAYS = 14;

export async function loadToday(db: SupabaseClient): Promise<CrmToday> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const [replies, tasks, inquiries, board, prospects] = await Promise.all([
    db.from('email_replies')
      .select('id, contact_id, from_email, from_name, subject, text, received_at, forwarded, crm_contacts ( name, company )')
      .is('handled_at', null)
      .gte('received_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
      .order('received_at', { ascending: false })
      .limit(30),
    db.from('crm_tasks')
      .select('id, contact_id, title, due_date, crm_contacts ( name, email )')
      .is('completed_at', null)
      .lte('due_date', today)
      .order('due_date'),
    db.from('contact_inquiries')
      .select('id, crm_contact_id, project_type, created_at, name')
      .eq('status', 'new')
      .not('crm_contact_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),
    loadDealBoard(db),
    loadProspectCounts(db),
  ]);

  const nameOf = (c: unknown, fallback: string) => (c as { name?: string } | null)?.name || fallback;
  const cutoff = Date.now() - QUIET_DAYS * 86_400_000;
  const month = today.slice(0, 7);

  return {
    replies: (replies.data ?? []).map((r) => ({
      id: r.id,
      contact_id: r.contact_id,
      name: nameOf(r.crm_contacts, r.from_name || r.from_email),
      company: (r.crm_contacts as unknown as { company: string | null } | null)?.company ?? null,
      subject: r.subject,
      text: r.text.slice(0, 400),
      received_at: r.received_at,
      forwarded: r.forwarded,
    })),
    tasks: (tasks.data ?? []).map((t) => ({
      id: t.id, contact_id: t.contact_id, title: t.title, due_date: t.due_date,
      name: nameOf(t.crm_contacts, (t.crm_contacts as unknown as { email?: string } | null)?.email ?? 'Someone'),
    })),
    inquiries: (inquiries.data ?? []).map((i) => ({
      id: i.id, contact_id: i.crm_contact_id as string, name: i.name || 'Someone', project_type: i.project_type, created_at: i.created_at,
    })),
    quiet: board
      .filter((d) => isOpen(d.stage) && Date.parse(d.last_touch_at) < cutoff)
      .sort((a, b) => a.last_touch_at.localeCompare(b.last_touch_at))
      .slice(0, 12)
      .map((d) => ({ id: d.id, contact_id: d.contact_id, title: d.title, name: d.contact.name || d.contact.email || 'Unnamed', stage: d.stage, last_touch_at: d.last_touch_at })),
    prospects,
    pipeline_cents: board.filter((d) => isOpen(d.stage)).reduce((s, d) => s + (d.value_cents ?? 0), 0),
    won_this_month_cents: board.filter((d) => d.stage === 'won' && d.stage_changed_at.slice(0, 7) === month).reduce((s, d) => s + (d.value_cents ?? 0), 0),
  };
}

async function loadProspectCounts(db: SupabaseClient) {
  const { data } = await db.from('crm_contacts').select('id').eq('prospect_status', 'prospect');
  const ids = (data ?? []).map((r) => r.id);
  if (!ids.length) return { total: 0, never_emailed: 0 };
  const [a, b] = await Promise.all([
    db.from('prospect_emails').select('contact_id').in('contact_id', ids).eq('status', 'sent'),
    db.from('newsletter_sends').select('contact_id').in('contact_id', ids).eq('status', 'sent'),
  ]);
  const emailed = new Set([...(a.data ?? []), ...(b.data ?? [])].map((r) => r.contact_id));
  return { total: ids.length, never_emailed: ids.filter((id) => !emailed.has(id)).length };
}

/** How far back the Calls page looks. */
const CALL_LOG_DAYS = 180;

/** Every logged call and every booked call, for the Calls page. */
export async function loadCallLog(db: SupabaseClient): Promise<CrmCallLog> {
  const since = new Date(Date.now() - CALL_LOG_DAYS * 86_400_000).toISOString();
  const [activities, bookings] = await Promise.all([
    db.from('crm_activities')
      .select('id, contact_id, deal_id, body, metadata, created_at, crm_contacts ( name, email, company, phone ), crm_deals ( title )')
      .eq('kind', 'call').gte('created_at', since)
      .order('created_at', { ascending: false }).limit(500),
    db.from('bookings')
      .select('id, starts_at, ends_at, name, email, company, phone, notes, crm_contact_id, crm_deal_id, crm_deals ( title )')
      .eq('status', 'confirmed').gte('starts_at', since)
      .order('starts_at', { ascending: false }).limit(500),
  ]);
  if (activities.error) throw new Error(activities.error.message);

  type One<T> = T | T[] | null;
  const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  const calls: CrmCallRow[] = (activities.data ?? []).map((a) => {
    const c = one(a.crm_contacts as One<{ name: string; email: string | null; company: string | null; phone: string | null }>);
    return {
      key: `activity:${a.id}`,
      activity_id: a.id,
      booking_id: null,
      contact_id: a.contact_id,
      contact_name: c?.name || c?.email || 'Unnamed',
      company: c?.company ?? null,
      phone: c?.phone ?? null,
      deal_id: a.deal_id,
      deal_title: one(a.crm_deals as One<{ title: string }>)?.title ?? null,
      at: a.created_at,
      call: readCall(a.metadata),
      body: a.body || null,
    };
  });

  const now = Date.now();
  const upcoming: CrmCallRow[] = [];
  for (const b of bookings.data ?? []) {
    const row: CrmCallRow = {
      key: `booking:${b.id}`,
      activity_id: null,
      booking_id: b.id,
      contact_id: b.crm_contact_id,
      contact_name: b.name || b.email,
      company: b.company,
      phone: b.phone,
      deal_id: b.crm_deal_id,
      deal_title: one(b.crm_deals as One<{ title: string }>)?.title ?? null,
      at: b.starts_at,
      call: null,
      body: b.notes || null,
    };
    if (Date.parse(b.starts_at) > now) upcoming.push(row);
    else calls.push(row);
  }

  calls.sort((a, b) => b.at.localeCompare(a.at));
  upcoming.sort((a, b) => a.at.localeCompare(b.at));
  return { upcoming, calls };
}
