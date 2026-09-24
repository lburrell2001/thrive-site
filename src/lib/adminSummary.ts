// What needs Lauren's attention, in one read: follow-ups, unread
// inquiries, proposals waiting on a signature, unpaid invoices, the
// pipeline, and how the site did this week. The admin home page and the
// weekly digest email are both built from this, so they always agree.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildReport } from '@/lib/analyticsReport';
import { markOverdueInvoices } from '@/lib/invoiceHelpers';
import { sitemapPaths } from '@/lib/sitemapPaths';
import { searchReport } from '@/lib/searchConsole';
import type { AdminSummary } from '@/types/adminSummary';
import type { CrmStage } from '@/types/crm';

const TZ = 'America/Chicago';

/** YYYY-MM-DD in Dallas, `offset` days from today. */
export function dallasDate(offset = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offset * 86_400_000));
}

export async function buildAdminSummary(db: SupabaseClient): Promise<AdminSummary> {
  const today = dallasDate();
  const weekAhead = dallasDate(7);
  const monthStart = `${today.slice(0, 7)}-01`;

  // Keep invoice statuses honest without waiting for the daily cron.
  await markOverdueInvoices(db).catch(() => {});

  const [paths, search] = await Promise.all([sitemapPaths(), searchReport(7)]);

  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const [tasks, inquiries, deals, proposals, reminders, portalProposals, invoices, clients, report, reviewQueue, recentWins, askedDeals, calls] = await Promise.all([
    db.from('crm_tasks')
      .select('id, title, due_date, contact_id, crm_contacts ( name, company )')
      .is('completed_at', null)
      .not('due_date', 'is', null)
      .lte('due_date', weekAhead)
      .order('due_date'),
    db.from('contact_inquiries')
      .select('id, created_at, name, email, project_type, budget, source, crm_contact_id, crm_deal_id')
      .eq('status', 'new')
      .order('created_at', { ascending: false }),
    db.from('crm_deals').select('stage, value_cents, stage_changed_at'),
    db.from('proposals')
      .select('id, title, status, total_cents, currency, sent_at, first_viewed_at, proposal_clients ( name, company )')
      .in('status', ['sent', 'viewed'])
      .order('sent_at', { ascending: true }),
    db.from('client_reminders')
      .select('target_id, created_at')
      .in('target_type', ['proposal', 'portal_proposal', 'invoice'])
      .or('email_status.eq.sent,sms_status.eq.sent')
      .order('created_at', { ascending: false }),
    db.from('portal_proposals').select('id, name, client_id, created_at').eq('status', 'pending').order('created_at'),
    db.from('portal_invoices')
      .select('id, invoice_number, project_name, amount_cents, due_date, status, client_id')
      .neq('status', 'paid')
      .order('due_date'),
    db.from('portal_clients').select('id, full_name, company_name'),
    buildReport(db, 7, paths, search).catch(() => null),
    db.from('reviews').select('id, display_name, rating, body, submitted_at').eq('status', 'submitted').order('submitted_at', { ascending: false }),
    db.from('crm_deals')
      .select('id, title, contact_id, stage_changed_at, crm_contacts ( name, company )')
      .eq('stage', 'won')
      .gte('stage_changed_at', since60)
      .order('stage_changed_at', { ascending: false }),
    db.from('reviews').select('crm_deal_id').not('crm_deal_id', 'is', null),
    db.from('bookings')
      .select('id, starts_at, name, company, notes, crm_contact_id')
      .eq('status', 'confirmed')
      .gte('starts_at', new Date(Date.now() - 30 * 60_000).toISOString())
      .lte('starts_at', new Date(Date.now() + 7 * 86_400_000).toISOString())
      .order('starts_at'),
  ]);

  const asked = new Set((askedDeals.data ?? []).map((r) => r.crm_deal_id));

  const lastReminded = new Map<string, string>();
  for (const r of reminders.data ?? []) {
    if (r.target_id && !lastReminded.has(r.target_id)) lastReminded.set(r.target_id, r.created_at);
  }
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.company_name || c.full_name]));

  const stages: Record<CrmStage, { count: number; value_cents: number }> = {
    lead: { count: 0, value_cents: 0 },
    contacted: { count: 0, value_cents: 0 },
    proposal: { count: 0, value_cents: 0 },
    won: { count: 0, value_cents: 0 },
    lost: { count: 0, value_cents: 0 },
  };
  let wonThisMonth = 0;
  for (const d of deals.data ?? []) {
    const stage = d.stage as CrmStage;
    stages[stage].count += 1;
    stages[stage].value_cents += d.value_cents ?? 0;
    if (stage === 'won' && d.stage_changed_at.slice(0, 10) >= monthStart) wonThisMonth += d.value_cents ?? 0;
  }

  const unpaid = (invoices.data ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    project_name: inv.project_name,
    amount_cents: inv.amount_cents,
    due_date: inv.due_date,
    overdue: inv.status === 'overdue' || inv.due_date < today,
    client_id: inv.client_id,
    client_name: clientName.get(inv.client_id) ?? 'Client',
    last_reminded_at: lastReminded.get(inv.id) ?? null,
  }));

  return {
    today,
    followUps: (tasks.data ?? []).map((t) => {
      const contact = t.crm_contacts as unknown as { name: string; company: string | null } | null;
      return {
        id: t.id,
        title: t.title,
        due_date: t.due_date!,
        overdue: t.due_date! < today,
        contact_id: t.contact_id,
        contact_name: contact?.name || contact?.company || 'Contact',
      };
    }),
    newInquiries: (inquiries.data ?? []).map((i) => ({
      id: i.id,
      created_at: i.created_at,
      name: i.name,
      email: i.email,
      project_type: i.project_type,
      budget: i.budget,
      source: i.source,
      contact_id: i.crm_contact_id,
      deal_id: i.crm_deal_id,
    })),
    pipeline: {
      stages,
      open_value_cents: stages.lead.value_cents + stages.contacted.value_cents + stages.proposal.value_cents,
      won_this_month_cents: wonThisMonth,
    },
    proposalsAwaiting: [
      ...(proposals.data ?? []).map((p) => {
        const client = p.proposal_clients as unknown as { name: string; company: string | null } | null;
        return {
          kind: 'builder' as const,
          id: p.id,
          title: p.title,
          client_name: client?.company || client?.name || 'No client',
          status: p.status,
          total_cents: p.total_cents,
          currency: p.currency,
          since: p.sent_at ?? p.first_viewed_at,
          viewed: p.status === 'viewed',
          client_id: null,
          last_reminded_at: lastReminded.get(p.id) ?? null,
        };
      }),
      ...(portalProposals.data ?? []).map((p) => ({
        kind: 'portal' as const,
        id: p.id,
        title: p.name,
        client_name: clientName.get(p.client_id) ?? 'Client',
        status: 'pending',
        total_cents: null,
        currency: 'USD',
        since: p.created_at,
        viewed: false,
        client_id: p.client_id,
        last_reminded_at: lastReminded.get(p.id) ?? null,
      })),
    ],
    unpaidInvoices: unpaid,
    reviewsToApprove: (reviewQueue.data ?? []) as AdminSummary['reviewsToApprove'],
    upcomingCalls: (calls.data ?? []).map((c) => ({
      id: c.id, starts_at: c.starts_at, name: c.name, company: c.company, notes: c.notes, contact_id: c.crm_contact_id,
    })),
    reviewCandidates: (recentWins.data ?? [])
      .filter((d) => !asked.has(d.id))
      .slice(0, 5)
      .map((d) => {
        const contact = d.crm_contacts as unknown as { name: string; company: string | null } | null;
        return {
          deal_id: d.id,
          deal_title: d.title,
          contact_id: d.contact_id,
          contact_name: contact?.name || contact?.company || 'Client',
          won_at: d.stage_changed_at,
        };
      }),
    unpaidTotals: {
      overdue_cents: unpaid.filter((i) => i.overdue).reduce((s, i) => s + i.amount_cents, 0),
      due_cents: unpaid.filter((i) => !i.overdue).reduce((s, i) => s + i.amount_cents, 0),
    },
    traffic: report
      ? {
          visits: report.totals.visits,
          previous_visits: report.previous.visits,
          inquiries: report.totals.inquiries,
          previous_inquiries: report.previous.inquiries,
          top_source: report.sources[0] ? { source: report.sources[0].source, visits: report.sources[0].visits } : null,
          top_insight: report.insights.find((i) => i.tone !== 'info') ?? report.insights[0] ?? null,
          search: search.status === 'ok'
            ? {
                clicks: search.totals.clicks,
                previous_clicks: search.previous.clicks,
                impressions: search.totals.impressions,
                top_queries: search.queries.slice(0, 3).map((q) => ({ query: q.key, clicks: q.clicks, position: q.position })),
              }
            : null,
        }
      : null,
  };
}
