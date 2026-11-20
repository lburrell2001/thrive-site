export const runtime = 'nodejs';

// The receipts for an invoice — one per payment made (the deposit, each
// payment of a plan, the balance, or payment in full) — with everything the
// emailed receipt shows, for the portal's "Receipt" download (a PDF made in
// the browser by src/lib/receiptPDF.ts). Only the client's own invoice.

import { NextResponse } from 'next/server';
import { requirePortalClient } from '@/lib/portalAuth';
import { contactAddress, receiptFigures, type ReceiptPart } from '@/lib/paymentReceipt';
import { installmentsOf } from '@/lib/paymentPlan';
import { postalAddress } from '@/lib/newsletter';
import type { LineItem } from '@/lib/lineItems';

export type PortalReceipt = {
  number: string; what: string; part: ReceiptPart; index?: number;
  paid_cents: number; paid_to_date_cents: number; remaining_cents: number; total_cents: number; deposit_cents: number;
  paid_on: string | null; method: 'card' | 'recorded';
  invoice_number: string; project_name: string | null; notes: string | null;
  billed_to: string; billing_address: string | null; thrive_address: string | null;
  lines: { name: string; description: string; amount_cents: number }[];
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;

  const { data: inv } = await db.from('portal_invoices').select('*').eq('id', id).maybeSingle();
  if (!inv || inv.client_id !== auth.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Which payments have been made, and when.
  const payments: { part: ReceiptPart; index?: number; at: string | null; card: boolean }[] = [];
  const plan = installmentsOf(inv.installments) as ({ paid_at?: string | null; session_id?: string | null }[] | null);
  if (plan) {
    plan.forEach((p, i) => {
      if (p.paid_at) payments.push({ part: i === 0 ? 'deposit' : 'installment', index: i, at: p.paid_at, card: Boolean(i === 0 ? inv.deposit_session_id : p.session_id) });
    });
  } else {
    if (inv.deposit_cents && inv.deposit_paid_at) payments.push({ part: 'deposit', at: inv.deposit_paid_at, card: Boolean(inv.deposit_session_id) });
    if (inv.status === 'paid') payments.push({ part: inv.deposit_cents && inv.deposit_paid_at ? 'balance' : 'full', at: null, card: Boolean(inv.stripe_checkout_session_id) });
  }
  if (!payments.length) return NextResponse.json({ receipts: [] }, { headers: { 'Cache-Control': 'no-store' } });

  let found = await db.from('portal_clients').select('full_name, company_name, billing_address').eq('id', auth.user.id).maybeSingle();
  if (found.error) found = await db.from('portal_clients').select('full_name, company_name').eq('id', auth.user.id).maybeSingle();
  const client = found.data as { full_name: string | null; company_name: string | null; billing_address?: string | null } | null;
  const [thrive, fallbackAddress, sent] = await Promise.all([
    postalAddress(db).catch(() => null),
    client?.billing_address ? Promise.resolve(null) : contactAddress(db, auth.user.id),
    // A full or balance payment's date: when its receipt went out.
    db.from('portal_activity').select('text, created_at').eq('client_id', auth.user.id).like('text', `Receipt sent%on invoice ${inv.invoice_number}`).order('created_at', { ascending: false }),
  ]);

  const lines = ((inv.line_items ?? []) as LineItem[]).map((it) => ({
    name: it.name,
    description: it.hide_description ? '' : it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '').trim(),
    amount_cents: it.amount_cents,
  }));

  const receipts: PortalReceipt[] = payments.map((p) => {
    const f = receiptFigures(inv, p.part, p.index);
    const at = p.at ?? sent.data?.find((a) => a.text.includes(`(${f.what.toLowerCase()})`))?.created_at ?? null;
    return {
      number: f.number, what: f.what, part: p.part, ...(p.index !== undefined ? { index: p.index } : {}),
      paid_cents: f.paid, paid_to_date_cents: f.paidToDate, remaining_cents: f.remaining, total_cents: f.total, deposit_cents: f.deposit,
      paid_on: at, method: p.card ? 'card' : 'recorded',
      invoice_number: inv.invoice_number, project_name: inv.project_name ?? null, notes: inv.notes?.trim() || null,
      billed_to: [client?.full_name, client?.company_name].filter(Boolean).join(' · ') || auth.user.email || '',
      billing_address: client?.billing_address?.trim() || fallbackAddress || null,
      thrive_address: thrive ?? null,
      lines,
    };
  });
  return NextResponse.json({ receipts }, { headers: { 'Cache-Control': 'no-store' } });
}
