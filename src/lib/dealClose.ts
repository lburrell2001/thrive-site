// Closing finished work (migration 045). The pipeline is for leads, open
// deals and won work still running; a closed deal stays Won (totals,
// lifecycle and history don't change) but leaves the board.
//
// closeDeal():  stamps closed_at, archives the deal's portal projects, stops
//               their recurring invoices, and notes it on the timeline.
// closeEndedRetainers(): closes every won retainer whose last month is over.
//               Runs daily (before recurring invoices are generated) and when
//               the pipeline loads.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { retainerProgress } from './retainer';

const TZ = 'America/Chicago';
const todayDallas = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

type DealRow = {
  id: string; contact_id: string; title: string; stage: string; stage_changed_at: string;
  monthly_cents: number | null; term_months: number | null; starts_on: string | null; closed_at?: string | null;
};

export type CloseResult = { archivedProjects: number; stoppedSchedules: number };

export async function closeDeal(db: SupabaseClient, dealId: string, reason: 'retainer_ended' | 'manual', note?: string): Promise<CloseResult> {
  const { data: deal, error } = await db.from('crm_deals')
    .update({ closed_at: new Date().toISOString(), closed_reason: reason })
    .eq('id', dealId).is('closed_at', null)
    .select('id, contact_id, title').maybeSingle();
  if (error) throw new Error(/closed_at/.test(error.message) ? 'Run migration 045 in Supabase first.' : error.message);
  if (!deal) return { archivedProjects: 0, stoppedSchedules: 0 }; // already closed

  // The work in the client portal: archive the projects, stop their recurring invoices.
  const { data: projects } = await db.from('portal_projects').select('id, name, client_id, archived').eq('crm_deal_id', dealId);
  let archivedProjects = 0;
  let stoppedSchedules = 0;
  for (const pr of projects ?? []) {
    if (!pr.archived) {
      const { error: aErr } = await db.from('portal_projects').update({ archived: true }).eq('id', pr.id);
      if (!aErr) archivedProjects++;
    }
    const { data: stopped } = await db.from('portal_invoice_subscriptions')
      .update({ status: 'cancelled' })
      .eq('client_id', pr.client_id).eq('project_name', pr.name).in('status', ['active', 'paused'])
      .select('id');
    stoppedSchedules += stopped?.length ?? 0;
  }

  const done = [
    archivedProjects && `${archivedProjects} project${archivedProjects === 1 ? '' : 's'} archived`,
    stoppedSchedules && `${stoppedSchedules} recurring invoice${stoppedSchedules === 1 ? '' : 's'} stopped`,
  ].filter(Boolean).join(', ');
  await db.from('crm_activities').insert({
    contact_id: deal.contact_id,
    deal_id: deal.id,
    kind: 'stage',
    body: [note, done].filter(Boolean).join(' · ') || null,
    metadata: { deal: deal.title, closed: true, reason },
  });
  return { archivedProjects, stoppedSchedules };
}

export async function reopenDeal(db: SupabaseClient, dealId: string) {
  const { data: deal, error } = await db.from('crm_deals')
    .update({ closed_at: null, closed_reason: null })
    .eq('id', dealId).not('closed_at', 'is', null)
    .select('id, contact_id, title').maybeSingle();
  if (error) throw new Error(error.message);
  if (!deal) return;
  await db.from('crm_activities').insert({
    contact_id: deal.contact_id, deal_id: deal.id, kind: 'stage', body: null,
    metadata: { deal: deal.title, reopened: true },
  });
}

/** Close every won retainer whose term is over. Quietly does nothing before migration 045. */
export async function closeEndedRetainers(db: SupabaseClient, today = todayDallas()): Promise<number> {
  const { data, error } = await db.from('crm_deals')
    .select('id, contact_id, title, stage, stage_changed_at, monthly_cents, term_months, starts_on, closed_at')
    .eq('stage', 'won').is('closed_at', null).not('monthly_cents', 'is', null).not('term_months', 'is', null);
  if (error) return 0;
  let closed = 0;
  for (const d of (data ?? []) as DealRow[]) {
    const progress = retainerProgress(d, today);
    if (progress?.status !== 'ended') continue;
    await closeDeal(db, d.id, 'retainer_ended', `Retainer ended: ${d.term_months} of ${d.term_months} months`).catch(() => undefined);
    closed++;
  }
  return closed;
}
