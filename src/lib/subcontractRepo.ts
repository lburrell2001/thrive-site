// Subcontract jobs (migration 076): reads and writes, and the protocol steps
// read from the system (estimates, invoices, the portal, the deal). The deal's
// contact is the prime; their portal login is where the work is delivered.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { STEPS, nextStep, stepStates, type AutoState, type ManualTicks, type StepKey, type StepState } from './subcontract';

export class SubcontractError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export interface SubcontractJob {
  deal_id: string;
  deal_title: string;
  stage: string;
  value_cents: number | null;
  closed_at: string | null;
  contact_id: string;
  prime_name: string;
  prime_company: string | null;
  prime_email: string | null;
  portal_client_id: string | null;
  end_client: string | null;
  notes: string | null;
  created_at: string;
  steps: StepState[];
  done: number;
  total: number;
  next: { key: StepKey; label: string } | null;
}

const missing = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /subcontract_jobs/.test(e.message ?? '')));

const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count: n, error } = await q;
  return error ? 0 : n ?? 0;
};

type DealRow = { id: string; title: string; stage: string; value_cents: number | null; closed_at: string | null; contact_id: string };

async function autoState(db: SupabaseClient, deal: DealRow, portalClientId: string | null): Promise<AutoState> {
  const [estimates, { data: invoices }, { data: projects }] = await Promise.all([
    count(db.from('estimates').select('id', { count: 'exact', head: true }).eq('crm_deal_id', deal.id).in('status', ['accepted', 'invoiced'])),
    db.from('portal_invoices').select('status, deposit_paid_at').eq('crm_deal_id', deal.id),
    db.from('portal_projects').select('id, name, client_id').eq('crm_deal_id', deal.id),
  ]);
  const inv = (invoices ?? []) as { status: string; deposit_paid_at: string | null }[];
  const prj = (projects ?? []) as { id: string; name: string; client_id: string }[];
  const ids = prj.map((p) => p.id);
  const [qs, asks, vault, miles, reports] = await Promise.all([
    ids.length ? count(db.from('client_questionnaires').select('id', { count: 'exact', head: true }).in('project_id', ids)) : 0,
    ids.length ? count(db.from('asset_requests').select('id', { count: 'exact', head: true }).in('project_id', ids)) : 0,
    portalClientId ? count(db.from('portal_credentials').select('id', { count: 'exact', head: true }).eq('client_id', portalClientId)) : 0,
    prj.length ? count(db.from('portal_milestones').select('id', { count: 'exact', head: true }).eq('client_id', prj[0].client_id).in('project_name', prj.map((p) => p.name))) : 0,
    ids.length ? count(db.from('project_reports').select('id', { count: 'exact', head: true }).in('project_id', ids)) : 0,
  ]);
  return {
    estimate_accepted: estimates > 0,
    deposit_paid: inv.some((i) => i.status === 'paid' || Boolean(i.deposit_paid_at)),
    setup: prj.length > 0 && qs + asks > 0,
    vault: vault > 0,
    milestones: miles > 0,
    balance_paid: inv.length > 0 && inv.every((i) => i.status === 'paid'),
    report_sent: reports > 0,
    closed: Boolean(deal.closed_at),
  };
}

type JobRow = { deal_id: string; end_client: string | null; notes: string | null; steps: unknown; created_at: string };

async function build(db: SupabaseClient, rows: JobRow[]): Promise<SubcontractJob[]> {
  if (!rows.length) return [];
  const { data: deals } = await db.from('crm_deals').select('id, title, stage, value_cents, closed_at, contact_id').in('id', rows.map((r) => r.deal_id));
  const dealMap = new Map(((deals ?? []) as DealRow[]).map((d) => [d.id, d]));
  const contactIds = [...new Set([...dealMap.values()].map((d) => d.contact_id))];
  const { data: contacts } = contactIds.length
    ? await db.from('crm_contacts').select('id, name, company, email, portal_client_id').in('id', contactIds)
    : { data: [] };
  const people = new Map((contacts ?? []).map((c) => [c.id, c as { id: string; name: string; company: string | null; email: string | null; portal_client_id: string | null }]));

  return Promise.all(rows.filter((r) => dealMap.has(r.deal_id)).map(async (r) => {
    const deal = dealMap.get(r.deal_id)!;
    const c = people.get(deal.contact_id);
    const manual = (r.steps && typeof r.steps === 'object' ? r.steps : {}) as ManualTicks;
    const states = stepStates(manual, await autoState(db, deal, c?.portal_client_id ?? null));
    const nx = nextStep(states);
    return {
      deal_id: deal.id, deal_title: deal.title, stage: deal.stage, value_cents: deal.value_cents, closed_at: deal.closed_at,
      contact_id: deal.contact_id, prime_name: c?.name || 'Unknown', prime_company: c?.company ?? null, prime_email: c?.email ?? null,
      portal_client_id: c?.portal_client_id ?? null,
      end_client: r.end_client, notes: r.notes, created_at: r.created_at,
      steps: states, done: states.filter((s) => s.done).length, total: states.length,
      next: nx ? { key: nx.key, label: nx.label } : null,
    };
  }));
}

export async function listJobs(db: SupabaseClient): Promise<SubcontractJob[]> {
  const { data, error } = await db.from('subcontract_jobs').select('deal_id, end_client, notes, steps, created_at').order('created_at', { ascending: false });
  if (error) throw new SubcontractError(missing(error) ? 'Run migration 076 to turn on subcontracts.' : error.message, 500);
  return build(db, (data ?? []) as JobRow[]);
}

/** The job on a deal, or null when the deal isn't subcontract work. */
export async function jobFor(db: SupabaseClient, dealId: string): Promise<SubcontractJob | null> {
  const { data, error } = await db.from('subcontract_jobs').select('deal_id, end_client, notes, steps, created_at').eq('deal_id', dealId).maybeSingle();
  if (error) {
    if (missing(error)) return null;
    throw new SubcontractError(error.message, 500);
  }
  if (!data) return null;
  return (await build(db, [data as JobRow]))[0] ?? null;
}

export async function markSubcontract(db: SupabaseClient, dealId: string, endClient: string | null) {
  const { data: deal } = await db.from('crm_deals').select('id').eq('id', dealId).maybeSingle();
  if (!deal) throw new SubcontractError('Deal not found', 404);
  const { error } = await db.from('subcontract_jobs').upsert({ deal_id: dealId, end_client: endClient?.trim() || null }, { onConflict: 'deal_id', ignoreDuplicates: true });
  if (error) throw new SubcontractError(missing(error) ? 'Run migration 076 to turn on subcontracts.' : error.message, 500);
  return jobFor(db, dealId);
}

export async function updateJob(db: SupabaseClient, dealId: string, patch: { end_client?: string | null; notes?: string | null; step?: { key: StepKey; done: boolean } }) {
  const { data: row } = await db.from('subcontract_jobs').select('steps').eq('deal_id', dealId).maybeSingle();
  if (!row) throw new SubcontractError('Not a subcontract job', 404);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.end_client !== undefined) update.end_client = patch.end_client?.trim().slice(0, 160) || null;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim().slice(0, 4000) || null;
  if (patch.step) {
    if (!STEPS.some((s) => s.key === patch.step!.key)) throw new SubcontractError('Unknown step');
    const steps = { ...((row.steps ?? {}) as ManualTicks) };
    if (patch.step.done) steps[patch.step.key] = new Date().toISOString();
    else delete steps[patch.step.key];
    update.steps = steps;
  }
  const { error } = await db.from('subcontract_jobs').update(update).eq('deal_id', dealId);
  if (error) throw new SubcontractError(error.message, 500);
  return jobFor(db, dealId);
}

export async function removeJob(db: SupabaseClient, dealId: string) {
  const { error } = await db.from('subcontract_jobs').delete().eq('deal_id', dealId);
  if (error) throw new SubcontractError(error.message, 500);
}
