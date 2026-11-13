import { amountText, clientRows, defaultSelection, formatLineMoney, hasChoices, hasRange, isPhased, rangeText, rangeTotals, splitTotals, tierTotal, tiersOf, type EndTotals, type LineItem, type LineSelection } from './lineItems';
import { dueNow } from './invoiceDeposit';

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
  /** Category subtotals instead of every line (migration 047). */
  totals_only?: boolean | null;
  /** A deposit first (migration 048). */
  deposit_cents?: number | null;
  deposit_due_date?: string | null;
  deposit_paid_at?: string | null;
  balance_open?: boolean | null;
  /** Tiers (migration 061): each option's total — shared lines included, no extras. Worked out from the lines when absent. */
  options?: { tier: string; total_cents: number; label?: string }[] | null;
  /** The client's choice, once they've accepted. */
  selection?: LineSelection | null;
  /** An estimate's payment terms (migration 064): a deposit to start, as a percent. */
  deposit_percent?: number | null;
}

/**
 * An estimate's payment terms as one line (migration 064), or null: "50%
 * deposit to start — $1,200, invoiced when you accept. The remaining $1,200
 * is invoiced later." Not for phases or a price range (their own estimates
 * come later).
 */
export function estimateTermsLine(e: Pick<InvoiceForPDF, 'deposit_percent' | 'amount_cents' | 'line_items'> & { selection?: LineSelection | null }): string | null {
  const pct = Number(e.deposit_percent ?? 0);
  const lines = (e.line_items ?? []) as LineItem[];
  if (!(pct > 0 && pct < 100) || isPhased(lines) || hasRange(lines)) return null;
  // Tiers, before the client picks: no amounts — the deposit is a share of the option they choose.
  if (tiersOf(lines).length && !e.selection?.tier) return `Payment terms: ${pct}% deposit to start on the option you choose, invoiced when you accept. The rest is invoiced later.`;
  const deposit = Math.round((e.amount_cents * pct) / 100);
  return `Payment terms: ${pct}% deposit to start — ${formatLineMoney(deposit)}, invoiced when you accept. The remaining ${formatLineMoney(e.amount_cents - deposit)} is invoiced later.`;
}

type Row = { name: string; description: string; hours: number | null; amount: string; heading?: boolean };

/** Each option's total, from the PDF data or worked out from full lines. */
export function optionTotals(invoice: Pick<InvoiceForPDF, 'line_items' | 'options'>): { tier: string; total_cents: number; label?: string }[] {
  if (invoice.options?.length) return invoice.options;
  const lines = (invoice.line_items ?? []) as LineItem[];
  return tiersOf(lines).map((tier) => {
    const ends = rangeTotals(lines, { tier, optional: [] });
    return { tier, total_cents: tierTotal(lines, tier), label: rangeText(ends.low, ends.high) };
  });
}


/** What the table prints: every line, or one row per category. */
export function tableRows(invoice: InvoiceForPDF): Row[] {
  const lines = invoice.line_items ?? [];
  if (!lines.length) {
    return [{ name: invoice.project_name || 'Creative Services', description: '', hours: null, amount: fmtMoney(invoice.amount_cents) }];
  }
  const rows = clientRows(lines as LineItem[], !!invoice.totals_only);
  // A line in only one end of a price range (migration 063) says so.
  const plain = (r: (typeof rows)[number]): Row => ({ name: `${r.name}${r.range ? ` (${r.range} end)` : ''}`, description: r.description.trim(), hours: r.hours, amount: amountText(r.oneTime, r.monthly) });
  if (isPhased(rows)) {
    // Phases (migration 062): each phase with its terms, its lines and its subtotal — no grand total.
    const approved = invoice.selection?.phases;
    return phaseGroups(rows).flatMap((g, n): Row[] => [
      { name: `Phase ${n + 1}: ${g.name}${g.timeline ? ` · ${g.timeline}` : ''}${approved?.includes(g.name) ? ' — approved' : ''}`, description: g.terms ? `Payment terms: ${g.terms}` : '', hours: null, amount: '', heading: true },
      ...g.rows.map(plain),
      { name: `Phase ${n + 1} ${g.ranged ? 'price range' : 'total'}`, description: '', hours: null, amount: g.ranged ? rangeText(g.low, g.high) : amountText(g.oneTime, g.monthly) },
    ]);
  }
  if (!hasChoices(rows)) return rows.map(plain);
  // Tiers and extras: the items (a line in one option names it), then each option's total, then the extras.
  const totals = optionTotals(invoice);
  const chosen = invoice.selection;
  const out: Row[] = rows.filter((r) => !r.optional).map((r) => ({ ...plain(r), name: r.tier ? `${r.name} — ${r.tier}` : r.name }));
  if (totals.length) {
    out.push({ name: chosen ? 'Options' : 'Choose one option', description: '', hours: null, amount: '', heading: true });
    totals.forEach((t, n) => out.push({ name: `Option ${n + 1}: ${t.tier}${chosen?.tier === t.tier ? ' — chosen' : ''}`, description: '', hours: null, amount: t.label ?? formatLineMoney(t.total_cents) }));
  }
  const extras = rows.filter((r) => r.optional);
  if (extras.length) {
    out.push({ name: 'Optional extras', description: chosen ? 'Ticked extras are in the total' : 'Add any of these', hours: null, amount: '', heading: true });
    for (const r of extras) {
      const ticked = chosen && r.source !== undefined && chosen.optional.includes(r.source);
      out.push({ ...plain(r), name: `${r.name}${ticked ? ' — added' : chosen ? '' : ' (optional)'}` });
    }
  }
  return out;
}

/** Client rows grouped by phase, in order, with each phase's terms and subtotal (from the rows, which may be collapsed). */
export function phaseGroups<R extends { phase?: string; phase_terms?: string; phase_timeline?: string; range?: 'low' | 'high'; oneTime: number; monthly: number }>(rows: R[]) {
  // oneTime / monthly are the low end; with a price range (migration 063), low and high are both ends.
  const out: { name: string; terms: string; timeline: string; rows: R[]; oneTime: number; monthly: number; ranged: boolean; low: EndTotals; high: EndTotals }[] = [];
  for (const r of rows) {
    if (!r.phase) continue;
    let g = out.find((x) => x.name === r.phase);
    if (!g) { g = { name: r.phase, terms: '', timeline: '', rows: [], oneTime: 0, monthly: 0, ranged: false, low: { oneTime: 0, monthly: 0 }, high: { oneTime: 0, monthly: 0 } }; out.push(g); }
    if (!g.terms && r.phase_terms) g.terms = r.phase_terms;
    if (!g.timeline && r.phase_timeline) g.timeline = r.phase_timeline;
    g.rows.push(r);
    if (r.range) g.ranged = true;
    if (r.range !== 'high') { g.oneTime += r.oneTime; g.monthly += r.monthly; g.low.oneTime += r.oneTime; g.low.monthly += r.monthly; }
    if (r.range !== 'low') { g.high.oneTime += r.oneTime; g.high.monthly += r.monthly; }
  }
  return out;
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

/** Downloads the PDF; with { output: 'base64' } returns it instead (for emailing). */
export async function generateInvoicePDF(invoice: InvoiceForPDF, clientName?: string | null, opts: { output?: 'save' | 'base64' } = {}): Promise<string | void> {
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
  const lines = tableRows(invoice);
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

    if (line.heading) {
      doc.setFillColor('#fbe6f1');
      doc.rect(M, y, tableW, rowH, 'F');
    }
    doc.setDrawColor('#e5e5e5');
    doc.line(M, y + rowH, M + tableW, y + rowH);

    let ty = y + 7.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(line.heading ? '#c4046f' : '#0a0a0a');
    doc.text(nameLines, M + 5, ty);
    doc.text(line.amount, amountX, ty, { align: 'right' });
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

  // Total row (dark bg). An estimate with monthly lines shows one-time and
  // monthly apart; an invoice is due in full, first month included.
  const sel = invoice.line_items?.length && hasChoices(invoice.line_items as LineItem[])
    ? defaultSelection(invoice.line_items as LineItem[], invoice.selection) : null;
  const split = invoice.line_items?.length ? splitTotals(invoice.line_items as LineItem[], sel) : { oneTime: invoice.amount_cents, monthly: 0 };
  const choiceLabel = sel?.tier ? ` — ${sel.tier.toUpperCase()}${invoice.selection ? '' : ', NO EXTRAS'}` : sel && !invoice.selection ? ' — NO EXTRAS' : '';
  // A phased estimate has no grand total: each phase's subtotal is in the table.
  const ranged = !!invoice.line_items?.length && hasRange(invoice.line_items as LineItem[]);
  const ends = ranged ? rangeTotals(invoice.line_items as LineItem[], sel) : null;
  const tiersUnchosen = !!invoice.line_items?.length && tiersOf(invoice.line_items as LineItem[]).length > 0 && !invoice.selection?.tier;
  const totals: { label: string; value: string }[] = invoice.line_items?.length && isPhased(invoice.line_items as LineItem[]) ? []
    // Tiers before the client picks: no total — each option's price is in the table.
    : tiersUnchosen ? []
    // A price range (migration 063): low – high, the final price comes in a later estimate.
    : ends ? [{ label: `PRICE RANGE${sel?.tier ? ` — ${sel.tier.toUpperCase()}` : ''}`, value: rangeText(ends.low, ends.high) }]
    : sel && !split.monthly
    ? [{ label: `${isEstimate ? 'ESTIMATE TOTAL' : 'TOTAL DUE'}${choiceLabel}`, value: fmtMoney(split.oneTime) }]
    : isEstimate && split.monthly
    ? [
        ...(split.oneTime ? [{ label: 'ONE-TIME TOTAL', value: fmtMoney(split.oneTime) }] : []),
        { label: 'MONTHLY', value: `${fmtMoney(split.monthly)}/mo` },
      ]
    : [{ label: isEstimate ? 'ESTIMATE TOTAL' : 'TOTAL DUE', value: fmtMoney(invoice.amount_cents) }];
  if (y + 15 * totals.length > pageBottom) { doc.addPage(); y = 20; }
  const totalY = y;
  totals.forEach((t, i) => {
    const ty = totalY + i * 15;
    doc.setFillColor('#0a0a0a');
    doc.rect(M, ty, tableW, 15, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#808080');
    doc.text(t.label, M + 5, ty + 9.5);
    doc.setFontSize(17);
    doc.setTextColor('#ffffff');
    doc.text(t.value, M + tableW - 5, ty + 10, { align: 'right' });
  });

  let after = totalY + 15 * totals.length + 7;

  // A deposit first: what's due now and what comes later.
  if (!isEstimate && invoice.deposit_cents && invoice.deposit_cents > 0) {
    const dep = invoice.deposit_cents;
    const bal = invoice.amount_cents - dep;
    const rows: [string, string, boolean][] = [
      [invoice.deposit_paid_at ? `Deposit — paid ${fmtDate(invoice.deposit_paid_at.slice(0, 10))}` : `Deposit — due ${fmtDate(invoice.deposit_due_date ?? '')}`, fmtMoney(dep), !invoice.deposit_paid_at],
      [invoice.balance_open === false ? 'Balance — due when we let you know' : `Balance — due ${fmtDate(invoice.due_date)}`, fmtMoney(bal), !!invoice.deposit_paid_at && invoice.balance_open !== false],
    ];
    doc.setDrawColor('#0a0a0a');
    doc.setLineWidth(0.4);
    doc.rect(M, after - 4, tableW, 18);
    rows.forEach(([label, value, now], i) => {
      const ry2 = after + 2 + i * 7.5;
      doc.setFont('helvetica', now ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(now ? '#e40586' : '#333333');
      doc.text(label, M + 5, ry2);
      doc.text(value, M + tableW - 5, ry2, { align: 'right' });
    });
    after += 22;
  }

  if (!isEstimate && split.monthly) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#666666');
    doc.text(`Includes the first month of monthly services (${fmtMoney(split.monthly)}/mo).`, M, after);
    after += 8;
  }

  // An estimate's payment terms (migration 064).
  const terms = isEstimate ? estimateTermsLine(invoice) : null;
  if (terms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor('#0a0a0a');
    const termLines = doc.splitTextToSize(terms, tableW) as string[];
    if (after + termLines.length * 4.6 > pageBottom) { doc.addPage(); after = 20; }
    doc.text(termLines, M, after);
    after += termLines.length * 4.6 + 4;
  }

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
    // A deposit invoice says which part is due.
    const due = dueNow(invoice);
    const depositBadge = due.kind === 'pay' && due.part === 'deposit' ? { bg: '#fd6100', text: '#ffffff', label: 'DEPOSIT DUE' }
      : due.kind === 'held' ? { bg: '#0cf574', text: '#0a0a0a', label: 'DEPOSIT PAID' }
      : due.kind === 'pay' && due.part === 'balance' ? { bg: '#fd6100', text: '#ffffff', label: 'BALANCE DUE' }
      : null;
    const badge = depositBadge ?? statusMap[invoice.status] ?? { bg: '#808080', text: '#ffffff', label: invoice.status.toUpperCase() };

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
      doc.text(
        due.kind === 'held'
          ? 'Thank you, your deposit is in. We’ll let you know when the balance is ready to pay.'
          : 'Please remit payment by the due date. Thank you for your business!',
        M, badgeY + 20,
      );
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

  if (opts.output === 'base64') return doc.output('datauristring').split(',')[1] ?? '';
  doc.save(`${isEstimate ? 'Estimate' : 'Invoice'}-${invoice.invoice_number}.pdf`);
}
