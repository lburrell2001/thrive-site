// Adding an invoice to a client's portal (the `add_invoice` action on
// /api/admin, and scheduled invoices in src/lib/scheduledSends.ts): the row,
// with its lines and optional deposit (migrations 039, 047, 048), a line on the
// client's activity feed, and the message to send them. The caller sends the
// message: the admin route after responding, the cron straight away.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientMessage } from './clientNotify';
import { lineItemsSchema, selectLines, totalCents } from './lineItems';
import { SITE_URL } from './seo';

const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

export async function createPortalInvoice(
  db: SupabaseClient,
  params: Record<string, unknown>,
): Promise<{ ok: true; invoice: Record<string, unknown>; clientId: string; notice: ClientMessage } | { ok: false; error: string }> {
  const { clientId, invoice_number, project_name, invoice_date, due_date, status, subscription_id, line_items, notes, totals_only, deposit_cents, deposit_due_date, crm_deal_id } = params;
  let { amount_cents } = params;
  if (typeof clientId !== 'string' || !clientId) return { ok: false, error: 'Choose a client' };
  const row: Record<string, unknown> = { client_id: clientId, invoice_number, project_name, amount_cents: Number(amount_cents), invoice_date, due_date, status };
  if (subscription_id) row.subscription_id = subscription_id;
  // From an estimate on a deal: the invoice joins the same deal.
  if (typeof crm_deal_id === 'string' && /^[0-9a-f-]{36}$/i.test(crm_deal_id)) row.crm_deal_id = crm_deal_id;
  // From the invoice builder: the lines set the total.
  if (line_items !== undefined) {
    const lines = lineItemsSchema.safeParse(line_items);
    if (!lines.success) return { ok: false, error: lines.error.issues[0]?.message ?? 'Check the invoice lines' };
    // An invoice bills one set of lines: tiers and optional extras (estimate-only) are resolved
    // to the first option with no extras, and the markers dropped.
    const billed = selectLines(lines.data.map(({ optional: _o, ...it }) => { void _o; return it; }));
    amount_cents = totalCents(billed);
    if (Number(amount_cents) <= 0) return { ok: false, error: 'The invoice total must be more than $0' };
    row.amount_cents = amount_cents;
    row.line_items = billed;
    row.notes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 4000) : null;
    if (typeof totals_only === 'boolean') row.totals_only = totals_only;
  }
  // A deposit (migration 048): only it is payable until the balance is opened.
  if (deposit_cents !== undefined && deposit_cents !== null) {
    const dep = Math.round(Number(deposit_cents));
    if (!(dep > 0) || dep >= Number(row.amount_cents)) return { ok: false, error: 'The deposit must be more than $0 and less than the total' };
    if (typeof deposit_due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deposit_due_date)) return { ok: false, error: 'Add a date for the deposit' };
    row.deposit_cents = dep;
    row.deposit_due_date = deposit_due_date;
    row.balance_open = false;
  }
  let { data, error } = await db.from('portal_invoices').insert(row).select().single();
  // Before migration 047 there's no totals_only column.
  if (error && /totals_only/.test(error.message)) {
    delete row.totals_only;
    ({ data, error } = await db.from('portal_invoices').insert(row).select().single());
  }
  if (error || !data) {
    const msg = error?.message ?? 'Could not add the invoice';
    return { ok: false, error: /deposit|balance_open/.test(msg) ? 'Run migration 048 in Supabase to add deposits.' : /line_items|notes/.test(msg) ? 'Run migration 039 in Supabase to save invoice lines.' : msg };
  }

  const fmtAmt = usd(Number(amount_cents));
  const project = typeof project_name === 'string' && project_name ? project_name : null;
  const activity = (text: string) => db.from('portal_activity').insert({ client_id: clientId, text, dot_color: '#1e3add', ...(project ? { project_name: project } : {}) });
  const cta = (label: string) => ({ ctaUrl: `${SITE_URL}/portal/invoices`, ctaLabel: label });
  let notice: ClientMessage;
  if (row.deposit_cents) {
    const dep = usd(row.deposit_cents as number);
    const by = new Date(`${row.deposit_due_date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    await activity(`Invoice ${invoice_number} sent — ${dep} deposit due ${by} (${fmtAmt} total)`);
    notice = {
      subject: `Invoice ${invoice_number} — ${dep} deposit due ${by}`,
      headline: 'A new invoice has been added to your portal. The deposit is due now; the rest will be ready to pay later.',
      detail: [project && `Project: ${project}`, `Deposit: ${dep} due ${by}`, `Total: ${fmtAmt}`].filter(Boolean).join('\n'),
      sms: `new invoice ${invoice_number}: ${dep} deposit due ${by}. View and pay:`,
      ...cta('Pay the deposit'),
    };
  } else {
    await activity(`Invoice ${invoice_number} sent — ${fmtAmt} due`);
    notice = {
      subject: `Invoice ${invoice_number} — ${fmtAmt} due`,
      headline: 'A new invoice has been added to your portal.',
      detail: project ? `Project: ${project}\nAmount: ${fmtAmt}` : `Amount: ${fmtAmt}`,
      sms: `new invoice ${invoice_number} for ${fmtAmt}. View and pay:`,
      ...cta('View invoice'),
    };
  }
  return { ok: true, invoice: data as Record<string, unknown>, clientId, notice };
}
