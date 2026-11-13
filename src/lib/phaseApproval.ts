// Phased estimates and proposals (migration 062): the client approves phases,
// not a total. Nothing is invoiced — the estimate is marked accepted with the
// phases they chose (estimates.selection.phases), and Lauren is texted and
// emailed a link that opens it on "Make an estimate from phases".

import type { SupabaseClient } from '@supabase/supabase-js';
import { tellLauren } from './agencyNotify';
import { formatLineMoney, phasesOf, type LineItem, type LineSelection } from './lineItems';
import { SITE_URL } from './seo';

/** The approved phases that exist on these lines, in the estimate's order. */
export function cleanPhases(lines: LineItem[], phases: string[] | undefined): string[] {
  const want = new Set(phases ?? []);
  return phasesOf(lines).map((p) => p.name).filter((n) => want.has(n));
}

/** Marks the estimate accepted with those phases (keeping any estimates already made from it). */
export async function recordPhaseApproval(db: SupabaseClient, estimateId: string, phases: string[], by: { name: string; ip: string | null; at?: string }) {
  const { data: cur } = await db.from('estimates').select('selection, status').eq('id', estimateId).maybeSingle();
  const made = ((cur?.selection ?? null) as LineSelection | null)?.made;
  const selection: LineSelection = { tier: null, optional: [], phases, ...(made?.length ? { made } : {}) };
  return db.from('estimates').update({
    selection,
    accepted_at: by.at ?? new Date().toISOString(),
    accepted_by: by.name,
    accepted_ip: by.ip,
    status: cur?.status === 'invoiced' ? 'invoiced' : 'accepted',
    updated_at: new Date().toISOString(),
  }).eq('id', estimateId);
}

/** Lauren's text and email: what was approved, and the link to make the estimate. */
export async function tellPhasesApproved(opts: {
  who: string; what: string; estimateId: string; lines: LineItem[]; phases: string[];
}) {
  const link = `${SITE_URL}/admin/invoices?estimate=${opts.estimateId}`;
  const rows = phasesOf(opts.lines).filter((p) => opts.phases.includes(p.name));
  const list = rows.map((p) => p.name).join(', ');
  await tellLauren(
    `Phases approved: ${opts.what} — ${list}`,
    `${opts.who} approved ${rows.length === 1 ? 'a phase' : `${rows.length} phases`} of ${opts.what}:\n\n${rows
      .map((p) => `• ${p.name} — ${formatLineMoney(p.total_cents)}${p.terms ? ` (${p.terms})` : ''}`).join('\n')}\n\nNothing has been invoiced. Make the estimate for ${rows.length === 1 ? 'it' : 'the phase you’re starting'} and send it:\n${link}`,
    `Phases approved: ${opts.what} by ${opts.who} — ${list}. Make the estimate: ${link}`,
  );
}
