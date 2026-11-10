// The completion report as a PDF (jsPDF, in the browser): what was delivered,
// the timeline, growth on each social account (start → end, and the change),
// what was invoiced and paid, what comes next, and a note from Lauren. The
// same data is saved with the report so the client can download it again.

import { formatLineMoney } from './lineItems';
import { growth, type Metric } from './projectWork';

export type ReportData = {
  project: string;
  client: string;
  started_on: string;
  finished_on: string;
  items: { title: string; done_on: string | null }[];
  social: { platform: string; handle: string; start_on: string | null; end_on: string | null; metrics: Metric[] }[];
  invoiced_cents: number;
  paid_cents: number;
  next_step: string;
  note: string;
};

const day = (s: string | null) => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—');
const num = (n: number, unit?: string) => (unit === '%' ? `${Number(n.toFixed(2))}%` : Math.round(n).toLocaleString('en-US'));

/** "+1,240 (+38%)", "-12 (-4%)", "+1.2 pts" for a percent stat. */
export function changeText(m: Metric): string {
  const g = growth(m);
  if (!g) return '—';
  // A plain hyphen: the PDF's built-in font has no minus sign.
  const sign = g.diff > 0 ? '+' : g.diff < 0 ? '-' : '';
  if (m.unit === '%') return `${sign}${Number(Math.abs(g.diff).toFixed(2))} pts`;
  const pct = g.pct === null ? '' : ` (${sign}${Math.round(Math.abs(g.pct))}%)`;
  return `${sign}${Math.round(Math.abs(g.diff)).toLocaleString('en-US')}${pct}`;
}

export function duration(start: string, end: string): string {
  const days = Math.max(1, Math.round((Date.parse(end.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 86_400_000));
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.4);
  return `${months} month${months === 1 ? '' : 's'}`;
}

async function logo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch('/new-thrive/logo.png')).blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => {
        const img = new Image();
        img.onload = () => resolve({ data: r.result as string, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = r.result as string;
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Downloads it, or with { output: 'base64' } returns it for emailing. */
export async function generateReportPDF(data: ReportData, opts: { output?: 'save' | 'base64' } = {}): Promise<string | void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 22;
  const R = W - M - 7;
  const bottom = 272;
  let y = 0;

  const stripe = () => { doc.setFillColor('#e40586'); doc.rect(W - 7, 0, 7, 297, 'F'); };
  const page = () => { doc.addPage(); stripe(); y = 22; };
  const need = (h: number) => { if (y + h > bottom) page(); };
  const label = (t: string, x = M) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor('#808080'); doc.text(t.toUpperCase(), x, y); };
  const heading = (t: string) => {
    need(18);
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#0a0a0a');
    doc.text(t, M, y);
    doc.setFillColor('#e40586'); doc.rect(M, y + 2.5, 18, 1, 'F');
    y += 10;
  };

  stripe();
  const img = await logo();
  if (img) doc.addImage(img.data, 'PNG', M, 14, 44, (img.h / img.w) * 44);
  else { doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Thrive Creative Studios', M, 22); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor('#0a0a0a');
  doc.text('COMPLETION REPORT', R, 22, { align: 'right' });
  doc.setFillColor('#e40586'); doc.rect(M, 34, R - M, 1.2, 'F');

  y = 46;
  label('Prepared for'); label('Project', 110);
  y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor('#0a0a0a');
  doc.text(doc.splitTextToSize(data.client, 80) as string[], M, y);
  doc.text(doc.splitTextToSize(data.project, R - 110) as string[], 110, y);
  y += 12;
  label('Started'); label('Finished', 80); label('Timeline', 140);
  y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(day(data.started_on), M, y); doc.text(day(data.finished_on), 80, y); doc.text(duration(data.started_on, data.finished_on), 140, y);
  y += 6;

  // What we delivered.
  if (data.items.length) {
    heading('What we delivered');
    for (const it of data.items) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(it.title, R - M - 50) as string[];
      need(lines.length * 5 + 3);
      doc.setFillColor(it.done_on ? '#0cf574' : '#d4d4d4'); doc.circle(M + 1.6, y - 1.3, 1.6, 'F');
      doc.setTextColor('#0a0a0a'); doc.text(lines, M + 6, y);
      doc.setFontSize(9); doc.setTextColor('#808080');
      doc.text(it.done_on ? day(it.done_on) : 'In progress', R, y, { align: 'right' });
      y += lines.length * 5 + 2.5;
    }
  }

  // Growth.
  for (const acct of data.social) {
    const metrics = acct.metrics.filter((m) => m.start !== null || m.end !== null);
    if (!metrics.length) continue;
    heading(`Growth · ${[acct.platform, acct.handle && `@${acct.handle}`].filter(Boolean).join(' ') || 'Social account'}`);
    if (acct.start_on || acct.end_on) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#808080');
      doc.text(`${day(acct.start_on)} to ${day(acct.end_on)}`, M, y - 2);
      y += 5;
    }
    need(10);
    label('Stat'); label('Start', 100); label('End', 136); label('Change', R - 16);
    y += 3;
    doc.setDrawColor('#e5e5e5'); doc.line(M, y, R, y);
    y += 6;
    for (const m of metrics) {
      need(8);
      const g = growth(m);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor('#0a0a0a');
      doc.text(m.label, M, y);
      doc.text(m.start === null ? '-' : num(m.start, m.unit), 100, y);
      doc.text(m.end === null ? '-' : num(m.end, m.unit), 136, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(!g || g.diff === 0 ? '#808080' : g.diff > 0 ? '#0a8f4f' : '#e40586');
      doc.text(changeText(m), R, y, { align: 'right' });
      y += 3; doc.setDrawColor('#f0f0f0'); doc.line(M, y, R, y); y += 5;
    }
  }

  // Investment.
  if (data.invoiced_cents > 0) {
    heading('Investment');
    need(8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor('#0a0a0a');
    doc.text('Invoiced', M, y); doc.text(formatLineMoney(data.invoiced_cents), R, y, { align: 'right' }); y += 6;
    doc.text('Paid', M, y); doc.text(formatLineMoney(data.paid_cents), R, y, { align: 'right' }); y += 6;
    if (data.invoiced_cents > data.paid_cents) {
      doc.setFont('helvetica', 'bold'); doc.text('Still to pay', M, y); doc.text(formatLineMoney(data.invoiced_cents - data.paid_cents), R, y, { align: 'right' }); y += 6;
    }
  }

  for (const [title, text] of [['What’s next', data.next_step], ['A note from Lauren', data.note]] as const) {
    if (!text.trim()) continue;
    heading(title);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor('#333333');
    for (const para of text.trim().split('\n')) {
      const lines = doc.splitTextToSize(para, R - M) as string[];
      need(lines.length * 5 + 2);
      doc.text(lines, M, y);
      y += lines.length * 5 + 2;
    }
  }

  doc.setDrawColor('#e5e5e5'); doc.line(M, 280, R, 280);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#0a0a0a'); doc.text('Thrive Creative Studios', M, 286);
  doc.setFont('helvetica', 'normal'); doc.setTextColor('#808080'); doc.text('thrivecreativestudios.org', R, 286, { align: 'right' });

  if (opts.output === 'base64') return doc.output('datauristring').split(',')[1] ?? '';
  doc.save(`${data.project.replace(/[^\w\- ]+/g, '').trim() || 'Project'} - Completion report.pdf`);
}
