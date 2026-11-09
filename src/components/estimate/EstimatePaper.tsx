// The estimate as the client sees it, on its own page (/e/…) and inside a
// proposal (/p/…). Takes the rows already collapsed for the client
// (estimateForClientPdf), so nothing hidden reaches the page.

import { amountText, formatLineMoney, isMonthly, splitTotals } from '@/lib/lineItems';
import type { InvoiceForPDF } from '@/lib/invoicePDF';

const day = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');

/** "$1,250", "$100/mo": the headline figure for a footer. */
export function estimateTotalLabel(pdf: InvoiceForPDF): string {
  const split = splitTotals(pdf.line_items ?? []);
  return split.monthly && !split.oneTime ? `${formatLineMoney(split.monthly)}/mo` : formatLineMoney(split.oneTime);
}

export function EstimatePaper({ pdf, clientName }: { pdf: InvoiceForPDF; clientName: string | null }) {
  const rows = pdf.line_items ?? [];
  const split = splitTotals(rows);
  return (
    <article className="estimatePaper">
      <header className="estimateHead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/new-thrive/logo.png" alt="Thrive Creative Studios" className="estimateLogo" />
        <h1 className="estimateKind">Estimate</h1>
      </header>

      <div className="estimateMeta">
        <div>
          {clientName && <><span>Prepared for</span><strong>{clientName}</strong></>}
          {pdf.project_name && <><span>Project</span><strong>{pdf.project_name}</strong></>}
        </div>
        <div className="estimateMetaRight">
          <span>Estimate</span><strong>{pdf.invoice_number}</strong>
          <span>Date</span><strong>{day(pdf.invoice_date)}</strong>
          {pdf.due_date && <><span>Good until</span><strong>{day(pdf.due_date)}</strong></>}
        </div>
      </div>

      <ul className="estimateRows">
        {rows.map((r, i) => (
          <li key={i}>
            <div>
              <strong>{r.name}</strong>
              {stripMo(r.description) && <p>{stripMo(r.description)}</p>}
            </div>
            <span>{isMonthly(r) ? amountText(0, r.amount_cents) : amountText(r.amount_cents, 0)}</span>
          </li>
        ))}
      </ul>

      <div className="estimateTotal">
        <span>{split.monthly && split.oneTime ? 'One-time total' : split.monthly ? 'Monthly' : 'Estimate total'}</span>
        <strong>{estimateTotalLabel(pdf)}</strong>
      </div>
      {split.monthly > 0 && split.oneTime > 0 && (
        <div className="estimateTotal estimateTotalSub"><span>Monthly</span><strong>{formatLineMoney(split.monthly)}/mo</strong></div>
      )}
      {pdf.notes?.trim() && <p className="estimateNotes">{pdf.notes.trim()}</p>}
    </article>
  );
}
