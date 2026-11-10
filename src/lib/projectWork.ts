// Project checklists, social growth and completion reports (migration 052).
//
// - An accepted estimate / signed proposal turns its lines into the project's
//   checklist (projectChecklistFromEstimate). Ticking tasks sets the progress
//   bar the client sees on My Projects (syncProjectProgress).
// - A social media package marks the project kind 'social', adds one account
//   row per account in the package, and opens a CRM task to get starting
//   analytics. The completion report shows start, end and the change.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LineItem } from './lineItems';

export type Metric = { key: string; label: string; unit?: '' | '%'; start: number | null; end: number | null };
export type SocialAccount = {
  id: string; project_id: string; platform: string; handle: string; metrics: Metric[];
  start_captured_on: string | null; end_captured_on: string | null; position: number;
};
export type ProjectTask = { id: string; project_id: string; estimate_id: string | null; title: string; description: string; position: number; done_at: string | null };

export const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'Pinterest', 'X', 'Threads', 'Google Business'] as const;

export const DEFAULT_METRICS: Metric[] = [
  { key: 'followers', label: 'Followers', unit: '', start: null, end: null },
  { key: 'avg_views', label: 'Average views per post', unit: '', start: null, end: null },
  { key: 'engagement', label: 'Engagement rate', unit: '%', start: null, end: null },
  { key: 'reach', label: 'Monthly reach', unit: '', start: null, end: null },
  { key: 'profile_visits', label: 'Profile visits (month)', unit: '', start: null, end: null },
];

/** A line from the social media part of the price list. */
export function isSocialLine(line: Pick<LineItem, 'name' | 'category'>): boolean {
  return /social/i.test(line.category ?? '') || /^social\s*[–—-]/i.test(line.name);
}

/** How many accounts the package covers: Essentials 1, Growth 2, Premium 3, plus "Additional account (x2)". */
export function socialAccountCount(lines: Pick<LineItem, 'name' | 'category'>[]): number {
  let n = 0;
  for (const l of lines) {
    if (/social\s*[–—-]\s*essentials/i.test(l.name)) n = Math.max(n, 1);
    else if (/social\s*[–—-]\s*growth/i.test(l.name)) n = Math.max(n, 2);
    else if (/social\s*[–—-]\s*premium/i.test(l.name)) n = Math.max(n, 3);
  }
  for (const l of lines) {
    if (/^additional account/i.test(l.name)) n += Number(l.name.match(/\(x(\d+)\)/i)?.[1] ?? 1);
  }
  return Math.max(n, lines.some(isSocialLine) ? 1 : 0);
}

/** Change from start to end: the difference and the percent, when both are known. */
export function growth(m: Pick<Metric, 'start' | 'end'>): { diff: number; pct: number | null } | null {
  if (m.start === null || m.end === null || !Number.isFinite(m.start) || !Number.isFinite(m.end)) return null;
  const diff = m.end - m.start;
  return { diff, pct: m.start !== 0 ? (diff / Math.abs(m.start)) * 100 : null };
}

/** Starting stats are in when every account has at least one starting number. */
export const hasStartingStats = (accounts: Pick<SocialAccount, 'metrics'>[]) =>
  accounts.length > 0 && accounts.every((a) => a.metrics.some((m) => m.start !== null));

export const hasEndingStats = (accounts: Pick<SocialAccount, 'metrics'>[]) =>
  accounts.length > 0 && accounts.every((a) => a.metrics.some((m) => m.end !== null));

/** The client's progress bar follows the checklist; a started project leaves Kickoff. */
export async function syncProjectProgress(db: SupabaseClient, projectId: string): Promise<number | null> {
  const { data: tasks } = await db.from('project_tasks').select('done_at').eq('project_id', projectId);
  if (!tasks?.length) return null;
  const progress = Math.round((tasks.filter((t) => t.done_at).length / tasks.length) * 100);
  const { data: project } = await db.from('portal_projects').select('status').eq('id', projectId).maybeSingle();
  const status = project?.status === 'kickoff' && progress > 0 ? 'in_progress' : undefined;
  await db.from('portal_projects').update({ progress, ...(status ? { status } : {}) }).eq('id', projectId);
  return progress;
}

/**
 * The estimate's lines as the project's checklist (once per estimate), and
 * for a social media package: kind 'social', one account row per account,
 * and a CRM task to get starting analytics now.
 */
export async function projectChecklistFromEstimate(db: SupabaseClient, estimateId: string, projectId: string): Promise<void> {
  const { count } = await db.from('project_tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('estimate_id', estimateId);
  if (count) return;
  const { data: est } = await db.from('estimates').select('line_items, crm_deal_id, title').eq('id', estimateId).maybeSingle();
  const lines = ((est?.line_items ?? []) as LineItem[]).filter((l) => l.amount_cents >= 0);
  if (!lines.length) return;

  const { data: last } = await db.from('project_tasks').select('position').eq('project_id', projectId).order('position', { ascending: false }).limit(1).maybeSingle();
  const start = (last?.position ?? -1) + 1;
  await db.from('project_tasks').insert(lines.map((l, i) => ({
    project_id: projectId,
    estimate_id: estimateId,
    title: l.name.replace(/\s*\(optional\)\s*$/i, '').slice(0, 200),
    description: l.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '').slice(0, 2000),
    position: start + i,
  })));
  await syncProjectProgress(db, projectId);

  const accounts = socialAccountCount(lines);
  if (!accounts) return;
  await db.from('portal_projects').update({ kind: 'social' }).eq('id', projectId);
  const { count: have } = await db.from('project_social_accounts').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  const missing = accounts - (have ?? 0);
  if (missing > 0) {
    await db.from('project_social_accounts').insert(Array.from({ length: missing }, (_, i) => ({
      project_id: projectId, metrics: DEFAULT_METRICS, position: (have ?? 0) + i,
    })));
  }
  // The prompt: a task on the contact to get starting analytics today.
  if (est?.crm_deal_id) {
    const { data: deal } = await db.from('crm_deals').select('contact_id').eq('id', est.crm_deal_id).maybeSingle();
    if (deal?.contact_id) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
      await db.from('crm_tasks').insert({ contact_id: deal.contact_id, title: `Get starting analytics for ${est.title || 'their social accounts'}`, due_date: today });
    }
  }
}
