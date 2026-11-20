// The payment receipt as a PDF, for the portal's "Receipt" download — the same
// receipt that's emailed after each payment (src/lib/paymentReceipt.ts), in the
// invoice PDF's look (src/lib/invoicePDF.ts). Data from
// GET /api/portal/invoices/[id]/receipts.

import { fetchImageAsBase64 } from './invoicePDF';
import { formatLineMoney } from './lineItems';
import type { PortalReceipt } from '@/app/api/portal/invoices/[id]/receipts/route';

const PINK = '#e40586';
const INK = '#0a0a0a';
const MUTED = '#808080';

const fmtDay = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' })
  : '—';

export async function generateReceiptPDF(r: PortalReceipt): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 22;
  const right = W - M - 7;
  const tableW = right - M;

  const stripe = () => { doc.setFillColor(PINK); doc.rect(W - 7, 0, 7, H, 'F'); };
  stripe();

  // Logo, RECEIPT, rule.
  try {
    const logo = await fetchImageAsBase64('/new-thrive/logo.png');
    doc.addImage(logo.data, 'PNG', M, 14, 44, (logo.h / logo.w) * 44);
  } catch {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(INK);
    doc.text('Thrive Creative Studios', M, 22);
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(34); doc.setTextColor(INK);
  doc.text('RECEIPT', right, 23, { align: 'right' });
  doc.setFillColor(PINK); doc.rect(M, 36, tableW, 1.2, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED);
  doc.text('thrivecreativestudios.org', M, 42);

  // Receipt details, right column.
  let ry = 42;
  for (const row of [
    { label: 'RECEIPT #', value: r.number },
    { label: 'DATE PAID', value: fmtDay(r.paid_on) },
    { label: 'INVOICE #', value: r.invoice_number },
  ]) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(MUTED);
    doc.text(row.label, right, ry, { align: 'right' }); ry += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(INK);
    doc.text(row.value, right, ry, { align: 'right' }); ry += 7;
  }

  // Paid by, left column.
  let y = 50;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(MUTED);
  doc.text('PAID BY', M, y); y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(INK);
  doc.text(doc.splitTextToSize(r.billed_to, 100) as string[], M, y); y += 6;
  const addr = (r.billing_address ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  for (const line of addr.slice(0, 5)) { doc.text(doc.splitTextToSize(line, 100) as string[], M, y); y += 5; }
  y += 3;
  if (r.project_name) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(MUTED);
    doc.text('PROJECT', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(INK);
    doc.text(doc.splitTextToSize(r.project_name, 100) as string[], M, y); y += 6;
  }
  y = Math.max(y, ry) + 6;

  // The payment, in a dark band.
  doc.setFillColor(INK); doc.roundedRect(M, y, tableW, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#bfbfbf');
  doc.text(`${r.what.toUpperCase()} RECEIVED — THANK YOU`, M + 6, y + 8);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(r.method === 'card' ? 'Paid by card (Stripe)' : 'Recorded by Thrive Creative Studios', M + 6, y + 15);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor('#ffffff');
  doc.text(formatLineMoney(r.paid_cents), right - 6, y + 14.5, { align: 'right' });
  y += 32;

  // What the invoice covers: every line with its description.
  const page = () => { doc.addPage(); stripe(); y = 22; };
  if (r.lines.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(MUTED);
    doc.text('WHAT THIS INVOICE COVERS', M, y); doc.text('AMOUNT', right, y, { align: 'right' }); y += 3;
    doc.setFillColor(INK); doc.rect(M, y, tableW, 0.6, 'F'); y += 2;
    for (const it of r.lines) {
      const name = doc.splitTextToSize(it.name, tableW - 45) as string[];
      doc.setFontSize(9);
      const desc = it.description ? doc.splitTextToSize(it.description, tableW - 45) as string[] : [];
      const h = 6 + name.length * 5 + desc.length * 4;
      if (y + h > H - 40) page();
      let ty = y + 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(INK);
      doc.text(name, M + 2, ty);
      doc.text(it.amount_cents === 0 ? 'Included' : formatLineMoney(it.amount_cents), right - 2, ty, { align: 'right' });
      ty += name.length * 5;
      if (desc.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#666666'); doc.text(desc, M + 2, ty - 0.5); }
      y += h;
      doc.setDrawColor('#e5e5e5'); doc.line(M, y, right, y);
    }
    y += 6;
  }

  // Totals.
  const totals = [
    { label: 'Invoice total', value: formatLineMoney(r.total_cents) },
    ...(r.deposit_cents > 0 || r.paid_to_date_cents !== r.total_cents ? [{ label: 'Paid to date', value: formatLineMoney(r.paid_to_date_cents) }] : []),
    { label: 'Balance remaining', value: r.remaining_cents > 0 ? formatLineMoney(r.remaining_cents) : '$0 — paid in full' },
  ];
  if (y + totals.length * 7 + 30 > H - 20) page();
  for (const t of totals) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(MUTED);
    doc.text(t.label, right - 60, y, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setTextColor(INK);
    doc.text(t.value, right - 2, y, { align: 'right' });
    y += 7;
  }

  if (r.notes) {
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#666666');
    const notes = doc.splitTextToSize(r.notes, tableW) as string[];
    if (y + notes.length * 4 > H - 30) page();
    doc.text(notes, M, y); y += notes.length * 4 + 4;
  }

  // Footer: who it's from.
  const from = ['Thrive Creative Studios', ...(r.thrive_address ? r.thrive_address.split('\n') : ['Dallas, TX']), 'hello@thrivecreativestudios.org'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED);
  doc.text('Keep this receipt for your records and taxes.', M, H - 14 - from.length * 4);
  doc.text(from, M, H - 10 - (from.length - 1) * 4);

  doc.save(`Receipt ${r.number}.pdf`);
}
