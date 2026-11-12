// A receipt for every payment on an invoice (Nov 2026): Stripe card payments
// (full, deposit or balance) and payments Lauren records by hand. Every line
// is listed on its own with its full description — never collapsed into
// category totals — so the client has what they need for their books and
// taxes. Sent once per payment (callers send only when their update actually
// recorded the payment), from CONTACT_NOTIFY_FROM, with Lauren copied.
// A description Lauren hid from the client ("Show description" off) stays hidden.

import 'server-only';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BRAND, brandEmail, button, esc, paragraph, rows, signoff } from './emailLayout';
import { formatLineMoney, isMonthly, type LineItem } from './lineItems';
import { portalContact } from './clientNotify';
import { postalAddress } from './newsletter';
import { SITE_URL } from './seo';

export type ReceiptPart = 'full' | 'deposit' | 'balance';
export type ReceiptMethod = 'card' | 'recorded';

const BODY = "'Bai Jamjuree', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const dallasDay = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' });
const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');

/** The lines as a table: name, full description, amount. */
function itemsTable(lines: LineItem[]): string {
  const body = lines.map((it) => {
    const desc = it.hide_description ? '' : stripMo(it.description).trim();
    const hours = it.hours !== null && it.rate_cents !== null ? `${it.hours} h × ${formatLineMoney(it.rate_cents)}` : it.hours !== null ? `${it.hours} h` : '';
    const amount = it.amount_cents === 0 ? 'Included' : `${formatLineMoney(it.amount_cents)}${isMonthly(it) ? '/mo' : ''}`;
    return `<tr>
<td style="border-bottom:1px solid ${BRAND.rule};padding:12px 0;vertical-align:top;font-family:${BODY};">
<div style="font-size:14px;font-weight:700;color:${BRAND.ink};">${esc(it.name)}</div>
${desc ? `<div style="margin-top:3px;font-size:13px;line-height:1.5;color:${BRAND.body};white-space:pre-line;">${esc(desc)}</div>` : ''}
${hours ? `<div style="margin-top:3px;font-size:12px;color:${BRAND.muted};">${esc(hours)}</div>` : ''}
</td>
<td style="border-bottom:1px solid ${BRAND.rule};padding:12px 0 12px 16px;vertical-align:top;text-align:right;white-space:nowrap;font-family:${BODY};font-size:14px;font-weight:700;color:${BRAND.ink};">${esc(amount)}</td>
</tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;border-collapse:collapse;border-top:2px solid ${BRAND.ink};">${body}</table>`;
}

export type ReceiptInput = {
  invoice: { invoice_number: string; project_name: string | null; amount_cents: number; deposit_cents?: number | null; line_items?: LineItem[] | null; notes?: string | null };
  part: ReceiptPart; method: ReceiptMethod; paidOn: Date;
  firstName: string; email: string; billedTo: string; address: string | null;
};

/** The receipt email (HTML and text) — pure, so it can be previewed. */
export function buildReceipt({ invoice: inv, part, method, paidOn, firstName, email, billedTo, address }: ReceiptInput) {
    const total: number = inv.amount_cents;
    const deposit: number = inv.deposit_cents ?? 0;
    const paid = part === 'deposit' ? deposit : part === 'balance' ? total - deposit : total;
    const paidToDate = part === 'deposit' ? deposit : total;
    const remaining = Math.max(0, total - paidToDate);
    const lines = ((inv.line_items ?? []) as LineItem[]);
    const today = dallasDay(paidOn);
    const number = `${inv.invoice_number}${part === 'deposit' ? '-D' : part === 'balance' ? '-B' : ''}`;
    const what = part === 'deposit' ? 'Deposit' : part === 'balance' ? 'Balance' : 'Payment in full';

    const html = brandEmail({
      title: `Receipt ${number} — ${formatLineMoney(paid)}`,
      preheader: `Your receipt for ${formatLineMoney(paid)} on invoice ${inv.invoice_number}. Keep it for your records.`,
      eyebrow: 'Payment receipt',
      accent: 'green',
      heading: 'Payment received — thank you',
      body: [
        paragraph(`Hi ${firstName || 'there'}, thank you for your payment. This email is your receipt — keep it for your records and taxes.`),
        rows([
          { label: 'Receipt', value: number },
          { label: 'Date paid', value: today },
          { label: 'Paid by', value: billedTo || email },
          { label: 'Payment method', value: method === 'card' ? 'Card (Stripe)' : 'Recorded by Thrive Creative Studios' },
          { label: 'Invoice', value: inv.invoice_number },
          ...(inv.project_name ? [{ label: 'Project', value: inv.project_name }] : []),
          { label: what, value: formatLineMoney(paid), strong: true },
        ]),
        lines.length
          ? `<p style="margin:0 0 4px;font-family:${BODY};font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${BRAND.muted};">What this invoice covers</p>${itemsTable(lines)}`
          : '',
        rows([
          { label: 'Invoice total', value: formatLineMoney(total) },
          ...(deposit > 0 ? [{ label: 'Paid to date', value: formatLineMoney(paidToDate) }] : []),
          ...(remaining > 0 ? [{ label: 'Balance remaining', value: formatLineMoney(remaining) }] : [{ label: 'Balance remaining', value: '$0 — paid in full' }]),
        ]),
        inv.notes?.trim() ? paragraph(inv.notes.trim(), { size: 13, color: BRAND.muted }) : '',
        paragraph(
          `<strong style="color:${BRAND.ink};">Thrive Creative Studios</strong><br>${address ? esc(address).replace(/\n/g, '<br>') + '<br>' : 'Dallas, TX<br>'}hello@thrivecreativestudios.org`,
          { html: true, size: 13, color: BRAND.body },
        ),
        button(`${SITE_URL}/portal/invoices`, 'View your invoices', 'green'),
        signoff(),
      ].join('\n'),
    });

    const text = [
      `Payment received — thank you. This is your receipt; keep it for your records and taxes.`,
      ``,
      `Receipt: ${number}`, `Date paid: ${today}`, `Paid by: ${billedTo || email}`,
      `Payment method: ${method === 'card' ? 'Card (Stripe)' : 'Recorded by Thrive Creative Studios'}`,
      `Invoice: ${inv.invoice_number}${inv.project_name ? ` — ${inv.project_name}` : ''}`,
      `${what}: ${formatLineMoney(paid)}`,
      ``,
      ...lines.map((it) => `${it.name} — ${it.amount_cents === 0 ? 'Included' : formatLineMoney(it.amount_cents)}${!it.hide_description && it.description.trim() ? `\n  ${stripMo(it.description).trim().replace(/\n/g, '\n  ')}` : ''}`),
      ``,
      `Invoice total: ${formatLineMoney(total)}`,
      ...(deposit > 0 ? [`Paid to date: ${formatLineMoney(paidToDate)}`] : []),
      `Balance remaining: ${formatLineMoney(remaining)}`,
      ``,
      `Thrive Creative Studios${address ? `\n${address}` : ', Dallas, TX'}\nhello@thrivecreativestudios.org`,
    ].join('\n');

    return { html, text, number, paid, what };
}

export async function sendPaymentReceipt(
  db: SupabaseClient,
  invoiceId: string,
  part: ReceiptPart,
  method: ReceiptMethod,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.CONTACT_NOTIFY_FROM;
    if (!key || !from) return { ok: false, error: 'Email is not set up' };

    const { data: inv } = await db.from('portal_invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (!inv) return { ok: false, error: 'Invoice not found' };
    const contact = await portalContact(db, inv.client_id);
    if (!contact?.email) return { ok: false, error: 'No email for this client' };
    const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', inv.client_id).maybeSingle();

    const address = await postalAddress(db).catch(() => null);
    const billedTo = [client?.full_name || contact.name, client?.company_name].filter(Boolean).join(' · ');
    const { html, text, paid, what } = buildReceipt({
      invoice: inv, part, method, paidOn: new Date(), firstName: contact.firstName, email: contact.email, billedTo, address,
    });

    const notify = process.env.CONTACT_NOTIFY_TO;
    const { error } = await new Resend(key).emails.send({
      from, to: contact.email,
      ...(notify ? { bcc: notify } : {}),
      replyTo: notify || 'hello@thrivecreativestudios.org',
      subject: `Receipt for ${formatLineMoney(paid)} — invoice ${inv.invoice_number}`,
      html, text,
    }, { idempotencyKey: `receipt-${invoiceId}-${part}` });
    if (error) return { ok: false, error: error.message };

    await db.from('portal_activity').insert({
      client_id: inv.client_id,
      text: `Receipt sent for ${formatLineMoney(paid)} (${what.toLowerCase()}) on invoice ${inv.invoice_number}`,
      dot_color: '#0cf574',
      project_name: inv.project_name,
    });
    return { ok: true };
  } catch (e) {
    console.error('[receipt] not sent', invoiceId, e);
    return { ok: false, error: (e as Error).message };
  }
}
