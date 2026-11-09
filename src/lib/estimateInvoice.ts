// An accepted estimate (or a signed proposal's estimate) becomes an invoice in
// the client's portal, inside the project it's for (migration 051).
//
//   1. The client: the estimate's portal client; else its CRM contact (or one
//      made from the address it was sent to) gets a portal login.
//   2. The project: theirs with the estimate's name, else a new one filed
//      under the estimate's deal.
//   3. The invoice: the estimate's lines, due in 14 days — or, from a proposal
//      with a deposit, the deposit due now and the rest held until Lauren
//      opens it (migration 048).
//   4. The estimate is marked invoiced; the client is emailed (and texted if
//      they opted in) that the invoice is ready.
//
// Safe to call twice: an estimate with an invoice returns that invoice.

import type { SupabaseClient } from '@supabase/supabase-js';
import { makePortalClient } from './portalClient';
import { nextInvoiceNumberFor } from './invoiceHelpers';
import { notifyPortalClient } from './clientNotify';
import { formatLineMoney, type LineItem } from './lineItems';
import { SITE_URL } from './seo';

type Result = { ok: true; invoiceId: string; portalId: string; created: boolean } | { ok: false; error: string };

const dallasToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function invoiceForEstimate(
  db: SupabaseClient,
  estimateId: string,
  opts: { depositPercent?: number; notify?: boolean } = {},
): Promise<Result> {
  const { data: est } = await db.from('estimates').select('*').eq('id', estimateId).maybeSingle();
  if (!est) return { ok: false, error: 'Estimate not found' };
  if (est.invoice_id) {
    const { data: inv } = await db.from('portal_invoices').select('id, client_id').eq('id', est.invoice_id).maybeSingle();
    if (inv) return { ok: true, invoiceId: inv.id, portalId: inv.client_id, created: false };
  }
  const lines = (est.line_items ?? []) as LineItem[];
  if (!lines.length || !(est.total_cents > 0)) return { ok: false, error: 'The estimate has nothing to invoice' };

  // 1. Their portal login.
  let portalId: string | null = est.portal_client_id;
  if (!portalId) {
    let contactId: string | null = est.crm_contact_id;
    const email = (est.sent_to ?? '').trim().toLowerCase() || null;
    if (!contactId && email) {
      const { data: found } = await db.from('crm_contacts').select('id').ilike('email', email).limit(1).maybeSingle();
      contactId = found?.id ?? null;
      if (!contactId) {
        const { data: made, error } = await db.from('crm_contacts')
          .insert({ name: est.client_name || email, email, source: 'estimate' }).select('id').single();
        if (error) return { ok: false, error: error.message };
        contactId = made.id;
      }
    }
    if (!contactId) return { ok: false, error: 'The estimate has no client to invoice' };
    if (email) await db.from('crm_contacts').update({ email }).eq('id', contactId).is('email', null);
    const made = await makePortalClient(db, contactId);
    if (!made.ok) return made;
    portalId = made.portalId;
    await db.from('estimates').update({ portal_client_id: portalId }).eq('id', estimateId);
  }

  // 2. The project folder.
  const projectName = (est.title ?? '').trim() || `Estimate ${est.estimate_number}`;
  const { data: projects } = await db.from('portal_projects').select('id, name').eq('client_id', portalId);
  const project = (projects ?? []).find((p) => p.name.trim().toLowerCase() === projectName.toLowerCase());
  if (!project) {
    if (est.crm_deal_id) {
      const { error } = await db.rpc('create_deal_project', { p_client: portalId, p_deal: est.crm_deal_id, p_name: projectName });
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await db.from('portal_projects').insert({ client_id: portalId, name: projectName, status: 'kickoff', progress: 0 });
      if (error) return { ok: false, error: error.message };
    }
  }

  // 3. The invoice.
  const today = dallasToday();
  const pct = opts.depositPercent ?? 0;
  const deposit = pct > 0 && pct < 100 ? Math.round((est.total_cents * pct) / 100) : 0;
  const invoiceNumber = await nextInvoiceNumberFor(db, portalId, 'INV');
  const { data: inv, error: invErr } = await db.from('portal_invoices').insert({
    client_id: portalId,
    invoice_number: invoiceNumber,
    project_name: project?.name ?? projectName,
    amount_cents: est.total_cents,
    invoice_date: today,
    due_date: addDays(today, 14),
    status: 'due',
    line_items: lines,
    notes: est.notes,
    totals_only: est.totals_only ?? false,
    ...(est.crm_deal_id ? { crm_deal_id: est.crm_deal_id } : {}),
    ...(deposit > 0 ? { deposit_cents: deposit, deposit_due_date: today, balance_open: false } : {}),
  }).select('id').single();
  if (invErr) return { ok: false, error: invErr.message };

  await db.from('estimates').update({ invoice_id: inv.id, status: 'invoiced', updated_at: new Date().toISOString() }).eq('id', estimateId);

  const total = formatLineMoney(est.total_cents);
  await db.from('portal_activity').insert({
    client_id: portalId,
    text: deposit
      ? `Invoice ${invoiceNumber} ready — ${formatLineMoney(deposit)} deposit due now (${total} total)`
      : `Invoice ${invoiceNumber} ready — ${total} due`,
    dot_color: '#1e3add',
    project_name: project?.name ?? projectName,
  });

  // 4. Tell them.
  if (opts.notify !== false) {
    await notifyPortalClient(db, portalId, deposit
      ? {
          subject: `Invoice ${invoiceNumber} — ${formatLineMoney(deposit)} deposit to get started`,
          headline: `Thank you! Your invoice is ready in your portal. The ${formatLineMoney(deposit)} deposit gets us started; the rest is due later.`,
          detail: [`Project: ${projectName}`, `Deposit: ${formatLineMoney(deposit)}`, `Total: ${total}`].join('\n'),
          ctaUrl: `${SITE_URL}/portal/invoices`, ctaLabel: 'Pay the deposit',
          sms: `thank you! Invoice ${invoiceNumber} is ready: ${formatLineMoney(deposit)} deposit to get started. Pay here:`,
        }
      : {
          subject: `Invoice ${invoiceNumber} — ${total}`,
          headline: `Thank you! Your invoice is ready in your portal.`,
          detail: [`Project: ${projectName}`, `Amount: ${total}`].join('\n'),
          ctaUrl: `${SITE_URL}/portal/invoices`, ctaLabel: 'View invoice',
          sms: `thank you! Invoice ${invoiceNumber} (${total}) is ready. View and pay:`,
        });
  }
  return { ok: true, invoiceId: inv.id, portalId, created: true };
}
