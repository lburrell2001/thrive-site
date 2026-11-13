// Estimates from the invoice and estimate builder (/admin/invoices, migration 039).
// Admin-only: every read and write goes through /api/estimates with the service role.

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { lineItemsSchema, totalCents, type LineItem } from './lineItems';

export const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'invoiced'] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export type Estimate = {
  id: string;
  estimate_number: string;
  portal_client_id: string | null;
  crm_contact_id: string | null;
  client_name: string;
  title: string;
  line_items: LineItem[];
  notes: string | null;
  total_cents: number;
  issue_date: string;
  valid_until: string | null;
  status: EstimateStatus;
  /** Declined on its page with a reason (migration 058). */
  declined_at?: string | null;
  declined_by?: string | null;
  decline_reason?: string | null;
  invoice_id: string | null;
  /** Migration 047: the client's PDF shows category subtotals, not each line. */
  totals_only?: boolean;
  /** Migration 064: a deposit to start (percent of the total); the invoice asks for just that, the rest when Lauren opens it. */
  deposit_percent?: number | null;
  /** Migration 049: the deal it belongs to. */
  crm_deal_id?: string | null;
  created_at: string;
  updated_at: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

export const estimateSchema = z.object({
  portal_client_id: z.string().uuid().nullable(),
  crm_contact_id: z.string().uuid().nullable(),
  client_name: z.string().trim().max(200),
  title: z.string().trim().max(200),
  line_items: lineItemsSchema,
  notes: z.string().max(4000).nullable(),
  issue_date: isoDate,
  valid_until: isoDate.nullable(),
  totals_only: z.boolean().optional(),
  /** Migration 064: a deposit to start, as a percent (null / 0 = invoiced in full). */
  deposit_percent: z.number().min(0).max(100).nullable().optional(),
  /** Migration 049: the deal to file it under (else the insert trigger picks one). */
  crm_deal_id: z.string().uuid().nullable().optional(),
  /** Migration 062: made from these phases of a phased estimate (not stored on this row). */
  from_phases: z.object({ estimate_id: z.string().uuid(), phases: z.array(z.string().trim().min(1).max(80)).min(1).max(50) }).optional(),
});

export const estimatePatchSchema = estimateSchema.partial().extend({
  status: z.enum(ESTIMATE_STATUSES).optional(),
  invoice_id: z.string().uuid().nullable().optional(),
});

/** The stored row for a create or edit: the lines set the total. */
export function estimateRow(input: Partial<z.infer<typeof estimateSchema>>) {
  const row: Record<string, unknown> = { ...input };
  delete row.from_phases;
  if (row.crm_deal_id === undefined || row.crm_deal_id === null) delete row.crm_deal_id;
  if (input.line_items) row.total_cents = totalCents(input.line_items);
  if (typeof input.notes === 'string') row.notes = input.notes.trim() || null;
  return row;
}

export async function nextEstimateNumber(db: SupabaseClient): Promise<string> {
  const { data } = await db.from('estimates').select('estimate_number');
  let max = 0;
  for (const r of (data ?? []) as { estimate_number: string }[]) {
    const m = r.estimate_number.match(/^EST-(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `EST-${String(max + 1).padStart(3, '0')}`;
}

/** Before migration 047 (totals_only) or 064 (deposit_percent) the column isn't there: save without it. */
const OPTIONAL_COLUMNS = ['totals_only', 'deposit_percent'] as const;
export const missingTotalsOnly = (message: string) => OPTIONAL_COLUMNS.some((c) => message.includes(c));

export function withoutTotalsOnly<T extends Record<string, unknown>>(row: T, message = ''): T {
  const copy = { ...row };
  for (const c of OPTIONAL_COLUMNS) if (!message || message.includes(c)) delete copy[c];
  return copy;
}

/** Postgres/PostgREST errors that mean migration 039 isn't in yet. */
export const missingEstimatesTable = (message: string) =>
  /estimates|line_items/.test(message) && /does not exist|schema cache|Could not find/i.test(message);
