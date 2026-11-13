// The estimate as the client sees it, on its own page (/e/…) and inside a
// proposal (/p/…). Takes the rows already collapsed for the client
// (estimateForClientPdf), so nothing hidden reaches the page.
//
// Tiers and extras (migration 061): the items (a line in one option tagged
// with its name), then each option's total, then the extras. With `choose`, the options are radio
// buttons and the extras checkboxes (the estimate page, before accepting).
//
// Phases (migration 062): each phase with its payment terms, its lines and its
// subtotal, and no grand total. With `approve`, each phase has a checkbox (the
// estimate page, before approving).

import { amountText, clientRows, formatLineMoney, hasChoices, hasRange, isMonthly, isPhased, rangeText, rangeTotals, splitTotals, type LineItem, type LineSelection } from '@/lib/lineItems';
import { estimateTermsLine, optionTotals, phaseGroups, PHASES_NOTE, TIERS_NOTE, type InvoiceForPDF } from '@/lib/invoicePDF';

export type EstimateApprove = { phases: string[]; onToggle: (phase: string, on: boolean) => void };

export type EstimateChoose = {
  selection: LineSelection;
  onTier: (tier: string) => void;
  onExtra: (source: number, on: boolean) => void;
};

const day = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const stripMo = (d: string) => d.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');

/** "$1,250", "$100/mo": the headline figure for a footer. */
export function estimateTotalLabel(pdf: InvoiceForPDF): string {
  // Phases have no grand total.
  if (isPhased(pdf.line_items ?? [])) return phasesLabel(pdf);
  // A price range (migration 063): "$4,000 – $7,500".
  if (!hasChoices(pdf.line_items ?? []) && hasRange(pdf.line_items ?? [])) {
    const ends = rangeTotals(pdf.line_items ?? []);
    return rangeText(ends.low, ends.high);
  }

  // With choices the rows can't be re-added (discounts follow the choice): the saved total is the default or chosen one.
  if (hasChoices(pdf.line_items ?? [])) return formatLineMoney(pdf.amount_cents);
  const split = splitTotals(pdf.line_items ?? []);
  return split.monthly && !split.oneTime ? `${formatLineMoney(split.monthly)}/mo` : formatLineMoney(split.oneTime);
}

/** "3 phases", for where a total would go. */
export function phasesLabel(pdf: InvoiceForPDF): string {
  const n = new Set((pdf.line_items ?? []).map((r) => r.phase).filter(Boolean)).size;
  return `${n} phase${n === 1 ? '' : 's'}`;
}

function Phases({ pdf, approve }: { pdf: InvoiceForPDF; approve?: EstimateApprove }) {
  const groups = phaseGroups(clientRows(pdf.line_items ?? [], false));
  const approved = pdf.selection?.phases;
  return (<>
    {groups.map((g, n) => {
      const on = approve ? approve.phases.includes(g.name) : !!approved?.includes(g.name);
      return (
        <section key={g.name} className={`estimateSection estimatePhase${on ? ' estimateOptionOn' : ''}`}>
          <h2 className="estimateSectionHead estimatePhaseHead">
            {approve ? (
              <label className="estimatePick">
                <input type="checkbox" checked={on} onChange={(e) => approve.onToggle(g.name, e.target.checked)} />
                <span>Phase {n + 1}: {g.name}{g.timeline ? ` · ${g.timeline}` : ''}</span>
              </label>
            ) : <span>Phase {n + 1}: {g.name}{g.timeline ? ` · ${g.timeline}` : ''}{approved ? (on ? ' — approved' : '') : ''}</span>}
          </h2>
          <ul className="estimateRows">
            {(pdf.line_items ?? []).filter((r) => r.phase === g.name).map((r, i) => <Row key={i} r={r} />)}
          </ul>
          <div className="estimatePhaseFoot">
            <span className="estimatePhaseTerms">{g.terms ? <>Payment terms: <strong>{g.terms}</strong></> : 'Payment terms to follow'}</span>
            <strong className="estimatePhaseTotal">{g.ranged ? rangeText(g.low, g.high) : amountText(g.oneTime, g.monthly)}</strong>
          </div>
        </section>
      );
    })}
  </>);
}

function Row({ r, control }: { r: LineItem; control?: React.ReactNode }) {
  return (
    <li className={control ? 'estimateRowChoice' : undefined}>
      {control}
      <div>
        <strong>{r.name}{r.tier ? <span className="estimateTierTag">{r.tier}</span> : null}{r.range ? <span className="estimateTierTag">{r.range === 'low' ? 'Low end' : 'High end'}</span> : null}{r.optional && !control ? <span className="estimateTag"> Optional</span> : null}</strong>
        {stripMo(r.description) && <p>{stripMo(r.description)}</p>}
      </div>
      <span>{isMonthly(r) ? amountText(0, r.amount_cents) : amountText(r.amount_cents, 0)}</span>
    </li>
  );
}

export function EstimatePaper({ pdf, clientName, choose, totalLabel, approve }: {
  pdf: InvoiceForPDF; clientName: string | null;
  /** Phases: the client can still tick the phases they approve. */
  approve?: EstimateApprove;
  /** The client can still pick an option and extras. */
  choose?: EstimateChoose;
  /** The live total for the current choice. */
  totalLabel?: string;
}) {
  const rows = pdf.line_items ?? [];
  const phased = isPhased(rows);
  const choices = hasChoices(rows);
  const split = choices ? { oneTime: pdf.amount_cents, monthly: 0 } : splitTotals(rows);
  const options = choices ? optionTotals(pdf) : [];
  const picked = choose?.selection ?? pdf.selection ?? null;
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

      {phased ? <Phases pdf={pdf} approve={approve} /> : !choices ? (
        <ul className="estimateRows">
          {rows.map((r, i) => <Row key={i} r={r} />)}
        </ul>
      ) : (<>
        {/* The items first — a line in one option carries its name — then each option's total, then the extras. */}
        <ul className="estimateRows">
          {rows.filter((r) => !r.optional).map((r, i) => <Row key={i} r={r} />)}
        </ul>

        {options.length > 0 && (
          <section className="estimateSection">
            <h2 className="estimateSectionHead">{choose ? 'Choose your option' : 'Options'}</h2>
            <ul className="estimateRows estimateOptionRows">
              {options.map((o, n) => {
                const on = picked?.tier === o.tier;
                return (
                  <li key={o.tier} className={`estimateOptionRow${on ? ' estimateOptionOn' : ''}`}>
                    {choose ? (
                      <label className="estimatePick">
                        <input type="radio" name="estimate-option" checked={on} onChange={() => choose.onTier(o.tier)} />
                        <span><strong>Option {n + 1}: {o.tier}</strong></span>
                      </label>
                    ) : <strong>Option {n + 1}: {o.tier}{on && pdf.selection ? ' — chosen' : ''}</strong>}
                    <span>{o.label ?? formatLineMoney(o.total_cents)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {rows.some((r) => r.optional) && (
          <section className="estimateSection">
            <h2 className="estimateSectionHead">Optional extras</h2>
            <ul className="estimateRows">
              {rows.filter((r) => r.optional).map((r, i) => {
                const src = r.source ?? -1;
                const ticked = !!picked?.optional.includes(src);
                return (
                  <Row key={i} r={r} control={choose ? (
                    <input type="checkbox" className="estimateTick" aria-label={`Add ${r.name}`} checked={ticked} onChange={(e) => choose.onExtra(src, e.target.checked)} />
                  ) : pdf.selection ? <span className="estimateTickMark" aria-label={ticked ? 'Added' : 'Not added'}>{ticked ? '✓' : '–'}</span> : undefined} />
                );
              })}
            </ul>
          </section>
        )}
      </>)}

      {/* Tiers: no total until the client picks an option (then theirs) — just a line saying so. Phases: how they're paid. */}
      {options.length > 0 && !picked?.tier && <p className="estimateNotes">{TIERS_NOTE}</p>}
      {phased && <p className="estimateNotes">{PHASES_NOTE}</p>}
      {!phased && !(options.length > 0 && !picked?.tier) && <>
      <div className="estimateTotal">
        <span>{!choices && hasRange(rows) ? 'Price range' : choices ? (picked?.tier ? `${hasRange(rows) ? 'Price range' : 'Total'} — ${picked.tier}` : hasRange(rows) ? 'Price range' : 'Estimate total') : split.monthly && split.oneTime ? 'One-time total' : split.monthly ? 'Monthly' : 'Estimate total'}</span>
        <strong>{totalLabel ?? estimateTotalLabel(pdf)}</strong>
      </div>
      {!hasRange(rows) && split.monthly > 0 && split.oneTime > 0 && (
        <div className="estimateTotal estimateTotalSub"><span>Monthly</span><strong>{formatLineMoney(split.monthly)}/mo</strong></div>
      )}
      </>}
      {estimateTermsLine(pdf) && <p className="estimateTerms">{estimateTermsLine(pdf)}</p>}
      {pdf.notes?.trim() && <p className="estimateNotes">{pdf.notes.trim()}</p>}
    </article>
  );
}
