import { formatLineMoney, type LineItem } from './lineItems';

export interface InvoiceForPDF {
  invoice_number: string;
  project_name: string;
  amount_cents: number;
  invoice_date: string;
  /** For an estimate: the date it's good until (may be blank). */
  due_date: string;
  status: string;
  /** From the invoice builder; older invoices print as one line. */
  line_items?: LineItem[] | null;
  notes?: string | null;
  kind?: 'invoice' | 'estimate';
}

/** Whole dollars stay whole; cents show when there are any. */
const fmtMoney = formatLineMoney;

function fmtDate(s: string) {
  if (!s) return '—';
  // A bare date is a calendar day, not UTC midnight (which prints the day before in Dallas).
  return new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function fetchImageAsBase64(src: string): Promise<{ data: string; w: number; h: number }> {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => resolve({ data: reader.result as string, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePDF(invoice: InvoiceForPDF, clientName?: string | null) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const isEstimate = invoice.kind === 'estimate';
  const W = 210;
  const M = 22;

  // ── Pink side stripe ────────────────────────────────────────────────────────
  doc.setFillColor('#e40586');
  doc.rect(W - 7, 0, 7, 297, 'F');

  // ── Header area ─────────────────────────────────────────────────────────────
  // Logo
  try {
    const logo = await fetchImageAsBase64('/new-thrive/logo.png');
    const logoW = 44;
    const logoH = (logo.h / logo.w) * logoW;
    doc.addImage(logo.data, 'PNG', M, 14, logoW, logoH);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#0a0a0a');
    doc.text('Thrive Creative Studios', M, 22);
  }

  // "INVOICE" heading (top-right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor('#0a0a0a');
  doc.text(isEstimate ? 'ESTIMATE' : 'INVOICE', W - M - 7, 23, { align: 'right' });

  // Pink underline
  doc.setFillColor('#e40586');
  doc.rect(M, 36, W - M * 2 - 7, 1.2, 'F');

  // Studio URL
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#808080');
  doc.text('thrivecreativestudios.org', M, 42);

  // ── Invoice meta (right column) ─────────────────────────────────────────────
  const metaRows = [
    { label: isEstimate ? 'ESTIMATE #' : 'INVOICE #', value: invoice.invoice_number },
    { label: isEstimate ? 'DATE' : 'INVOICE DATE', value: fmtDate(invoice.invoice_date) },
    ...(isEstimate && !invoice.due_date ? [] : [{ label: isEstimate ? 'VALID UNTIL' : 'DUE DATE', value: fmtDate(invoice.due_date) }]),
  ];
  let ry = 42;
  const rx = W - M - 7;
  for (const row of metaRows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#808080');
    doc.text(row.label, rx, ry, { align: 'right' });
    ry += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor('#0a0a0a');
    doc.text(row.value, rx, ry, { align: 'right' });
    ry += 7;
  }

  // ── Billed To (left column) ──────────────────────────────────────────────────
  let ly = 50;
  if (clientName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#808080');
    doc.text(isEstimate ? 'PREPARED FOR' : 'BILLED TO', M, ly);
    ly += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#0a0a0a');
    doc.text(clientName, M, ly);
    ly += 8;
  }
  // With itemised lines, the project name no longer prints as the only line.
  if (invoice.line_items?.length && invoice.project_name) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#808080');
    doc.text('PROJECT', M, ly);
    ly += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#0a0a0a');
    doc.text(doc.splitTextToSize(invoice.project_name, 100) as string[], M, ly);
    ly += 6;
  }

  // ── Line items table ─────────────────────────────────────────────────────────
  const tableW = W - M * 2 - 7;
  const lines: LineItem[] = invoice.line_items?.length
    ? invoice.line_items
    : [{ name: invoice.project_name || 'Creative Services', description: '', hours: null, rate_cents: null, amount_cents: invoice.amount_cents }];
  const showHours = lines.some((l) => l.hours !== null);
  const amountX = M + tableW - 5;
  const hoursX = amountX - 34;
  const nameW = (showHours ? hoursX - 14 : amountX - 34) - (M + 5);

  const header = (top: number) => {
    doc.setFillColor('#f6f5f4');
    doc.rect(M, top, tableW, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor('#808080');
    doc.text('DESCRIPTION', M + 5, top + 6);
    if (showHours) doc.text('HOURS', hoursX, top + 6, { align: 'right' });
    doc.text('AMOUNT', amountX, top + 6, { align: 'right' });
    return top + 9;
  };

  let y = header(Math.max(ry + 4, ly + 10));
  const pageBottom = 262;

  for (const line of lines) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const nameLines = doc.splitTextToSize(line.name, nameW) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const descLines = line.description
      ? line.description.split('\n').flatMap((d) => doc.splitTextToSize(d, nameW) as string[])
      : [];
    const rowH = 6 + nameLines.length * 5 + descLines.length * 4.2 + 3;

    if (y + rowH > pageBottom) {
      doc.addPage();
      doc.setFillColor('#e40586');
      doc.rect(W - 7, 0, 7, 297, 'F');
      y = header(20);
    }

    doc.setDrawColor('#e5e5e5');
    doc.line(M, y + rowH, M + tableW, y + rowH);

    let ty = y + 7.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor('#0a0a0a');
    doc.text(nameLines, M + 5, ty);
    doc.text(line.amount_cents === 0 ? 'Included' : fmtMoney(line.amount_cents), amountX, ty, { align: 'right' });
    if (showHours && line.hours !== null) {
      doc.setFont('helvetica', 'normal');
      doc.text(String(line.hours), hoursX, ty, { align: 'right' });
    }
    ty += nameLines.length * 5;
    if (descLines.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#666666');
      doc.text(descLines, M + 5, ty - 0.5);
    }
    y += rowH;
  }

  // Total row (dark bg)
  if (y + 15 > pageBottom) { doc.addPage(); y = 20; }
  const totalY = y;
  doc.setFillColor('#0a0a0a');
  doc.rect(M, totalY, tableW, 15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#808080');
  doc.text(isEstimate ? 'ESTIMATE TOTAL' : 'TOTAL DUE', M + 5, totalY + 9.5);
  doc.setFontSize(17);
  doc.setTextColor('#ffffff');
  doc.text(fmtMoney(invoice.amount_cents), M + tableW - 5, totalY + 10, { align: 'right' });

  let after = totalY + 22;

  // ── Notes ────────────────────────────────────────────────────────────────────
  if (invoice.notes?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const noteLines = invoice.notes.trim().split('\n').flatMap((n) => doc.splitTextToSize(n, tableW) as string[]);
    if (after + 6 + noteLines.length * 4.6 > pageBottom) { doc.addPage(); after = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor('#808080');
    doc.text('NOTES', M, after);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor('#333333');
    doc.text(noteLines, M, after + 5.5);
    after += 10 + noteLines.length * 4.6;
  }

  if (after + 28 > pageBottom) { doc.addPage(); after = 20; }

  if (isEstimate) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor('#808080');
    doc.text(
      invoice.due_date ? `This estimate is good until ${fmtDate(invoice.due_date)}.` : 'Thank you for considering Thrive Creative Studios.',
      M, after,
    );
  } else {
    // ── Status badge ──────────────────────────────────────────────────────────────
    const badgeY = after;
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      paid:    { bg: '#0cf574', text: '#0a0a0a', label: 'PAID' },
      due:     { bg: '#fd6100', text: '#ffffff', label: 'PAYMENT DUE' },
      overdue: { bg: '#e40586', text: '#ffffff', label: 'OVERDUE' },
    };
    const badge = statusMap[invoice.status] ?? { bg: '#808080', text: '#ffffff', label: invoice.status.toUpperCase() };

    const badgePadding = 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const badgeLabelW = doc.getTextWidth(badge.label);
    const badgeW = badgeLabelW + badgePadding * 2;
    doc.setFillColor(badge.bg);
    doc.roundedRect(M, badgeY, badgeW, 8, 2, 2, 'F');
    doc.setTextColor(badge.text);
    doc.text(badge.label, M + badgeW / 2, badgeY + 5.5, { align: 'center' });

    // Note for unpaid
    if (invoice.status !== 'paid') {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor('#808080');
      doc.text('Please remit payment by the due date. Thank you for your business!', M, badgeY + 20);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = 274;
  doc.setDrawColor('#e5e5e5');
  doc.line(M, footerY, W - M - 7, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#0a0a0a');
  doc.text('Thrive Creative Studios', M, footerY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#808080');
  doc.text('thrivecreativestudios.org', W - M - 7, footerY + 7, { align: 'right' });

  doc.save(`${isEstimate ? 'Estimate' : 'Invoice'}-${invoice.invoice_number}.pdf`);
}
