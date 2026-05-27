import type { SupabaseClient } from '@supabase/supabase-js';

export type IntervalUnit = 'week' | 'month' | 'year';

// Find the next sequential invoice number for a client with a given prefix.
// Looks at existing invoice_numbers of the form "{PREFIX}-{NUMBER}" and returns PREFIX-(maxNumber+1)
// padded to at least 3 digits. If no matches, returns "{PREFIX}-001".
export async function nextInvoiceNumberFor(
  admin: SupabaseClient,
  clientId: string,
  prefix = 'INV',
): Promise<string> {
  const { data } = await admin
    .from('portal_invoices')
    .select('invoice_number')
    .eq('client_id', clientId);
  const rows = (data ?? []) as { invoice_number: string }[];
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');
  let max = 0;
  for (const r of rows) {
    const m = r.invoice_number?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// Advance a date by a given number of weeks / months / years.
// For months/years, clamps the day to the last day of the target month if needed.
export function addInterval(dateStr: string, count: number, unit: IntervalUnit): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (unit === 'week') {
    d.setUTCDate(d.getUTCDate() + 7 * count);
    return d.toISOString().slice(0, 10);
  }
  const monthsToAdd = unit === 'year' ? 12 * count : count;
  const targetMonthIdx = d.getUTCMonth() + monthsToAdd;
  const targetYear  = d.getUTCFullYear() + Math.floor(targetMonthIdx / 12);
  const normMonth   = ((targetMonthIdx % 12) + 12) % 12;
  const dayInTarget = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
  const day         = Math.min(d.getUTCDate(), dayInTarget);
  return new Date(Date.UTC(targetYear, normMonth, day)).toISOString().slice(0, 10);
}

export function addOneMonth(dateStr: string): string {
  return addInterval(dateStr, 1, 'month');
}

interface SubscriptionRow {
  id: string;
  client_id: string;
  project_name: string;
  invoice_prefix: string;
  amount_cents: number;
  next_due_date: string;
  day_of_month: number;
  interval_count: number;
  interval_unit: IntervalUnit;
}

// Mark any invoice that is still 'due' and whose due_date has passed as 'overdue'.
// Returns the number of rows updated. Safe to call frequently.
export async function markOverdueInvoices(admin: SupabaseClient, today = new Date().toISOString().slice(0, 10)) {
  const { data, error } = await admin
    .from('portal_invoices')
    .update({ status: 'overdue' })
    .eq('status', 'due')
    .lt('due_date', today)
    .select('id');
  if (error) return { ok: false, error: error.message, updated: 0 };
  return { ok: true, updated: (data ?? []).length };
}

// Find all active subscriptions due as of `today` and insert one invoice per due row,
// advancing each subscription's next_due_date by its configured interval.
// Also flips any past-due invoices from 'due' → 'overdue' as part of the same run.
export async function generateDueInvoices(admin: SupabaseClient, today = new Date().toISOString().slice(0, 10)) {
  const overdue = await markOverdueInvoices(admin, today);

  const { data: due, error: fetchErr } = await admin
    .from('portal_invoice_subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('next_due_date', today);

  if (fetchErr) return { ok: false, error: fetchErr.message, generated: 0, items: [], errors: [], overdue: overdue.updated };

  const subs = (due ?? []) as SubscriptionRow[];
  const generated: { id: string; invoice_number: string }[] = [];
  const errors: { subscription_id: string; error: string }[] = [];

  for (const sub of subs) {
    const invoiceNumber = await nextInvoiceNumberFor(admin, sub.client_id, sub.invoice_prefix || 'INV');
    const { data: invoice, error: insertErr } = await admin.from('portal_invoices').insert({
      client_id:      sub.client_id,
      invoice_number: invoiceNumber,
      project_name:   sub.project_name,
      amount_cents:   sub.amount_cents,
      invoice_date:   sub.next_due_date,
      due_date:       sub.next_due_date,
      status:         'due',
    }).select().single();

    if (insertErr) { errors.push({ subscription_id: sub.id, error: insertErr.message }); continue; }

    const advancedDate = addInterval(sub.next_due_date, sub.interval_count || 1, sub.interval_unit || 'month');
    const { error: advErr } = await admin
      .from('portal_invoice_subscriptions')
      .update({ next_due_date: advancedDate, last_generated_date: today })
      .eq('id', sub.id);

    if (advErr) errors.push({ subscription_id: sub.id, error: `invoice created but advance failed: ${advErr.message}` });
    generated.push({ id: invoice.id, invoice_number: invoiceNumber });
  }

  return { ok: true, generated: generated.length, items: generated, errors, overdue: overdue.updated };
}
