export interface InvoiceForPDF {
  invoice_number: string;
  project_name: string;
  amount_cents: number;
  invoice_date: string;
  due_date: string;
  status: string;
}

function fmtCurrency(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
  doc.text('INVOICE', W - M - 7, 23, { align: 'right' });

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
    { label: 'INVOICE #', value: invoice.invoice_number },
    { label: 'INVOICE DATE', value: fmtDate(invoice.invoice_date) },
    { label: 'DUE DATE', value: fmtDate(invoice.due_date) },
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
    doc.text('BILLED TO', M, ly);
    ly += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#0a0a0a');
    doc.text(clientName, M, ly);
    ly += 8;
  }

  // ── Line items table ─────────────────────────────────────────────────────────
  const tableY = Math.max(ry + 4, ly + 10);
  const tableW = W - M * 2 - 7;

  // Header row
  doc.setFillColor('#f6f5f4');
  doc.rect(M, tableY, tableW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor('#808080');
  doc.text('DESCRIPTION', M + 5, tableY + 6);
  doc.text('AMOUNT', M + tableW - 5, tableY + 6, { align: 'right' });

  // Item row
  const itemY = tableY + 9;
  doc.setDrawColor('#e5e5e5');
  doc.setFillColor('#ffffff');
  doc.rect(M, itemY, tableW, 15, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor('#0a0a0a');
  doc.text(invoice.project_name || 'Creative Services', M + 5, itemY + 10);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtCurrency(invoice.amount_cents), M + tableW - 5, itemY + 10, { align: 'right' });

  // Total row (dark bg)
  const totalY = itemY + 15;
  doc.setFillColor('#0a0a0a');
  doc.rect(M, totalY, tableW, 15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#808080');
  doc.text('TOTAL DUE', M + 5, totalY + 9.5);
  doc.setFontSize(17);
  doc.setTextColor('#ffffff');
  doc.text(fmtCurrency(invoice.amount_cents), M + tableW - 5, totalY + 10, { align: 'right' });

  // ── Status badge ──────────────────────────────────────────────────────────────
  const badgeY = totalY + 22;
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

  doc.save(`Invoice-${invoice.invoice_number}.pdf`);
}
