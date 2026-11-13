// The client's view of an estimate: /e/<id>?t=<access_token> (migration 051).
// The token is compared in constant time; a wrong one is "not found".

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { proposalServiceClient } from './proposalAccess';
import type { LineItem, LineSelection } from './lineItems';

export type ClientEstimate = {
  id: string; estimate_number: string; title: string; client_name: string; line_items: LineItem[]; notes: string | null;
  total_cents: number; issue_date: string; valid_until: string | null; status: string; totals_only: boolean | null;
  accepted_at: string | null; accepted_by: string | null; invoice_id: string | null; access_token: string;
  /** Declined on its page with a reason (migration 058). */
  declined_at?: string | null; decline_reason?: string | null;
  /** The client's choice of tier and extras (migration 061). */
  selection?: LineSelection | null;
};

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function loadClientEstimate(id: string, token: string | undefined): Promise<ClientEstimate | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const cols = 'id, estimate_number, title, client_name, line_items, notes, total_cents, issue_date, valid_until, status, totals_only, accepted_at, accepted_by, invoice_id, access_token';
  const db = proposalServiceClient();
  let { data, error } = await db.from('estimates').select(`${cols}, declined_at, decline_reason, selection`).eq('id', id).maybeSingle();
  // Before migration 061 / 058.
  if (error) ({ data, error } = await db.from('estimates').select(`${cols}, declined_at, decline_reason`).eq('id', id).maybeSingle());
  if (error) ({ data } = await db.from('estimates').select(cols).eq('id', id).maybeSingle());
  if (!data?.access_token || !same(data.access_token, token)) return null;
  return data as ClientEstimate;
}

import { clientRows, rangeText, rangeTotals, tierTotal, tiersOf } from './lineItems';
import type { InvoiceForPDF } from './invoicePDF';

/**
 * What the client may see of an estimate: the rows its PDF prints (category
 * subtotals when it's totals-only), collapsed here so the page never carries
 * a price the estimate hides. Used by the estimate page and a proposal page.
 */
export function estimateForClientPdf(est: Pick<ClientEstimate, 'estimate_number' | 'title' | 'line_items' | 'notes' | 'total_cents' | 'issue_date' | 'valid_until' | 'totals_only'> & { selection?: ClientEstimate['selection'] }): InvoiceForPDF {
  const rows = clientRows(est.line_items, !!est.totals_only);
  const tiers = tiersOf(est.line_items);
  return {
    kind: 'estimate',
    invoice_number: est.estimate_number,
    project_name: est.title,
    amount_cents: est.total_cents,
    invoice_date: est.issue_date,
    due_date: est.valid_until ?? '',
    status: 'sent',
    notes: est.notes,
    totals_only: false,
    line_items: rows.map((r) => ({
      name: r.name,
      description: r.monthly && !r.oneTime ? `${r.description} /mo`.trim() : r.description,
      hours: r.hours,
      rate_cents: null,
      amount_cents: r.oneTime + r.monthly,
      ...(r.tier ? { tier: r.tier } : {}),
      ...(r.optional ? { optional: true, source: r.source } : {}),
      ...(r.range ? { range: r.range } : {}),
      ...(r.phase ? { phase: r.phase, ...(r.phase_terms ? { phase_terms: r.phase_terms } : {}), ...(r.phase_timeline ? { phase_timeline: r.phase_timeline } : {}) } : {}),
    })),
    // Worked out from the full lines here, since the rows may be collapsed.
    options: tiers.length ? tiers.map((tier) => {
      // A price range (migration 063) shows as "$4,000 – $7,500".
      const ends = rangeTotals(est.line_items, { tier, optional: [] });
      return { tier, total_cents: tierTotal(est.line_items, tier), label: rangeText(ends.low, ends.high) };
    }) : null,
    selection: est.selection ?? null,
  };
}
