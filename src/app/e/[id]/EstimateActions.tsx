'use client';

// The estimate page's footer: the total, "Export PDF", "Not going ahead" and
// "Accept estimate" — no login needed. Both open the same light dialogs as a
// proposal (src/components/ClientDialog.tsx). With tiers (migration 061) the
// client must pick an option — nothing is preselected — and can tick extras,
// in the dialog or on the paper (one shared choice). Accepting turns it into
// an invoice in their portal if they have one; if not, Lauren sets their
// portal up and the invoice waits there (src/lib/acceptedPortal.ts). A decline
// needs a reason (migration 058), which Lauren is sent. A phased estimate
// (migration 062) is approved phase by phase instead: no total, no invoice —
// Lauren is texted and sends the estimate for the approved phases.

import { useState } from 'react';
import { ClientDialog } from '@/components/ClientDialog';
import type { InvoiceForPDF } from '@/lib/invoicePDF';
import { formatLineMoney, type LineSelection } from '@/lib/lineItems';

export type EstimateChooser = {
  options: { tier: string; total_cents: number; label?: string }[];
  extras: { source: number; name: string; description: string; amount_cents: number }[];
  selection: LineSelection;
  onTier: (tier: string) => void;
  onExtra: (source: number, on: boolean) => void;
};

export type EstimatePhaser = {
  all: { name: string; terms: string; timeline?: string; amount: string }[];
  selected: string[];
  onToggle: (phase: string, on: boolean) => void;
};

const REASONS = ['The price', 'The timing', 'The scope isn’t right', 'We’re going another way', 'Something else'];

export function EstimateActions({ id, token, pdf, clientName, totalLabel, accepted, canAccept, declined = false, invoiced = false, chooser, pricing = false, phaser, ranged = false }: {
  id: string; token: string; pdf: InvoiceForPDF; clientName: string | null; totalLabel: string; accepted: boolean; canAccept: boolean; declined?: boolean; invoiced?: boolean;
  /** Tiers and extras: the options, the extras and the shared choice. */
  chooser?: EstimateChooser;
  /** The total is being worked out for a new choice. */
  pricing?: boolean;
  /** Phases: which ones they're approving. */
  phaser?: EstimatePhaser;
  /** A price range (migration 063): approved at low – high, the final price comes in a later estimate. */
  ranged?: boolean;
}) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [chip, setChip] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ invoiceReady: boolean; needsSetup: boolean; ranged?: boolean } | null>(null);
  const [declinedNow, setDeclinedNow] = useState(false);

  const sel = chooser?.selection;
  const needsTier = !!chooser?.options.length;
  const chosen = !needsTier || !!sel?.tier;
  const ready = chosen && !pricing && name.trim() && agreed && (!phaser || phaser.selected.length > 0);
  const reason = [chip && chip !== 'Something else' ? chip : null, detail.trim() || null].filter(Boolean).join(' — ');

  async function exportPdf() {
    setPdfBusy(true);
    try {
      const { generateInvoicePDF } = await import('@/lib/invoicePDF');
      await generateInvoicePDF(pdf, clientName);
    } finally {
      setPdfBusy(false);
    }
  }

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/e/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), agreed,
          ...(phaser ? { selection: { tier: null, optional: [], phases: phaser.selected } } : sel ? { selection: sel } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; invoiceReady?: boolean; needsSetup?: boolean; ranged?: boolean };
      if (!res.ok) setError(body.error ?? 'Something went wrong. Please try again.');
      else setDone({ invoiceReady: !!body.invoiceReady, needsSetup: !!body.needsSetup, ranged: !!body.ranged });
    } catch {
      setError('We couldn’t reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  async function decline(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/e/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason, name: name.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(body.error ?? 'Something went wrong. Please try again.');
      else setDeclinedNow(true);
    } catch {
      setError('We couldn’t reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  const isAccepted = accepted || !!done;
  const isDeclined = declined || declinedNow;

  return (
    <>
      <div className="proposalFooter">
        <div style={{ minWidth: 0 }}>
          <div className="proposalFooterLabel">{isAccepted ? (phaser ? 'Approved' : 'Accepted') : isDeclined ? 'Declined' : phaser ? 'Phased estimate' : ranged ? 'Price range' : 'Estimate total'}</div>
          <div className="proposalFooterTotal">{totalLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="proposalFooterAction" onClick={exportPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Making the PDF…' : 'Export PDF'}
          </button>
          {isAccepted ? (
            (invoiced || done?.invoiceReady) ? <a className="proposalFooterAction proposalFooterActionPrimary" href="/portal/invoices">Go to your invoice</a> : null
          ) : canAccept && !isDeclined ? (<>
            <button type="button" className="proposalFooterAction" onClick={() => { setError(''); setDeclineOpen(true); }}>Not going ahead</button>
            <button type="button" className="proposalFooterAction proposalFooterActionPrimary" onClick={() => { setError(''); setAcceptOpen(true); }}>{phaser ? 'Approve phases' : 'Accept estimate'}</button>
          </>) : null}
        </div>
      </div>

      {/* Accept */}
      <ClientDialog open={acceptOpen} onClose={() => { if (done) window.location.reload(); else setAcceptOpen(false); }} labelledBy="accept-title" locked={busy} wide={needsTier || !!chooser?.extras.length || !!phaser}>
        {phaser ? (done ? (
          <div className="pdDone">
            <span className="pdCheck" aria-hidden>✓</span>
            <h2 id="accept-title" className="pdTitle">Approved — thank you!</h2>
            <dl className="pdSummary">
              <div><dt>{phaser.selected.length === 1 ? 'Phase' : 'Phases'}</dt><dd>{phaser.selected.join(', ')}</dd></div>
            </dl>
            <p className="pdLead">Lauren will send you the estimate for {phaser.selected.length === 1 ? 'this phase' : 'each phase'} next — nothing is invoiced until you accept it.</p>
            <div className="pdActions"><button type="button" className="pdBtn" onClick={() => window.location.reload()}>Done</button></div>
          </div>
        ) : (
          <form onSubmit={accept} noValidate>
            <h2 id="accept-title" className="pdTitle">Approve phases</h2>
            <p className="pdLead">Tick the phases you’d like to go ahead with. Each phase is paid on its own terms — we’ll send you its estimate next.</p>
            <fieldset className="pdGroup">
              <legend className="pdLabel">Phases <span className="pdReq">At least one</span></legend>
              <div className="pdExtras">
                {phaser.all.map((ph, i) => {
                  const on = phaser.selected.includes(ph.name);
                  return (
                    <label key={ph.name} className={`pdExtra${on ? ' pdOn' : ''}`}>
                      <input type="checkbox" checked={on} onChange={(e) => phaser.onToggle(ph.name, e.target.checked)} />
                      <span className="pdExtraText">
                        <span className="pdExtraName">Phase {i + 1}: {ph.name}{ph.timeline ? ` · ${ph.timeline}` : ''}</span>
                        <span className="pdExtraDesc">{ph.terms ? `Payment terms: ${ph.terms}` : 'Payment terms to follow'}</span>
                      </span>
                      <span className="pdExtraPrice">{ph.amount}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="pdField">
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>
            <label className="pdAgree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I approve {phaser.selected.length === 1 ? 'this phase' : 'these phases'} and understand each one is invoiced only after I accept its estimate.</span>
            </label>
            {error && <p className="pdError" role="alert">{error}</p>}
            <div className="pdActions">
              <button type="button" className="pdBtn pdBtnGhost" onClick={() => setAcceptOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="pdBtn" disabled={busy || !ready}>
                {busy ? 'Approving…' : !phaser.selected.length ? 'Tick a phase first' : `Approve ${phaser.selected.length === 1 ? 'phase' : `${phaser.selected.length} phases`}`}
              </button>
            </div>
          </form>
        )) : done ? (
          <div className="pdDone">
            <span className="pdCheck" aria-hidden>✓</span>
            <h2 id="accept-title" className="pdTitle">Accepted — thank you!</h2>
            <dl className="pdSummary">
              {sel?.tier && <div><dt>Your option</dt><dd>{sel.tier}</dd></div>}
              <div><dt>{done.ranged ? 'Price range' : 'Total'}</dt><dd>{totalLabel}</dd></div>
            </dl>
            <p className="pdLead">
              {done.ranged ? 'Lauren will send you the estimate with the final price next — nothing is invoiced until you accept it.'
                : done.invoiceReady
                ? 'Your invoice is ready in your client portal — we’ve emailed you the link.'
                : done.needsSetup
                  ? 'Next, we’ll set up your client portal and email you there — your invoice will be waiting.'
                  : 'We’ve got it and will send your invoice shortly.'}
            </p>
            <div className="pdActions">
              {done.invoiceReady
                ? <a className="pdBtn" href="/portal/invoices">Go to your invoice</a>
                : <button type="button" className="pdBtn" onClick={() => window.location.reload()}>Done</button>}
            </div>
          </div>
        ) : (
          <form onSubmit={accept} noValidate>
            <h2 id="accept-title" className="pdTitle">Accept estimate</h2>
            <p className="pdLead">
              {needsTier ? 'Choose your option, add any extras, and accept. ' : ''}
              {ranged ? 'This is a price range: once you accept, Lauren sends the estimate with the final price — nothing is invoiced until you accept that.' : 'Once you accept, we’ll send your invoice to your client portal.'}
            </p>

            {needsTier && (
              <fieldset className="pdGroup">
                <legend className="pdLabel">Choose your option <span className="pdReq">Required</span></legend>
                <div className="pdOptions">
                  {chooser!.options.map((o, i) => (
                    <label key={o.tier} className={`pdOption${sel?.tier === o.tier ? ' pdOn' : ''}`}>
                      <input type="radio" name="accept-tier" checked={sel?.tier === o.tier} onChange={() => chooser!.onTier(o.tier)} />
                      <span className="pdOptionKicker">Option {i + 1}</span>
                      <span className="pdOptionName">{o.tier}</span>
                      <span className="pdOptionPrice">{o.label ?? formatLineMoney(o.total_cents)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {!!chooser?.extras.length && (
              <fieldset className="pdGroup">
                <legend className="pdLabel">Add extras <span className="pdHint">optional</span></legend>
                <div className="pdExtras">
                  {chooser.extras.map((x) => {
                    const on = !!sel?.optional.includes(x.source);
                    return (
                      <label key={x.source} className={`pdExtra${on ? ' pdOn' : ''}`}>
                        <input type="checkbox" checked={on} onChange={(e) => chooser.onExtra(x.source, e.target.checked)} />
                        <span className="pdExtraText">
                          <span className="pdExtraName">{x.name}</span>
                          {x.description && <span className="pdExtraDesc">{x.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}</span>}
                        </span>
                        <span className="pdExtraPrice">+ {formatLineMoney(x.amount_cents)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="pdTotal" aria-live="polite">
              <div>
                <span>{ranged ? 'Price range' : 'Your total'}{sel?.tier ? ` — ${sel.tier}` : ''}</span>
                <strong>{!chosen ? 'Choose an option' : pricing ? '…' : totalLabel}</strong>
              </div>
            </div>

            <label className="pdField">
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>

            <label className="pdAgree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{ranged
                ? `I accept this estimate${chosen && !pricing ? ` at ${totalLabel}` : ''} and understand the final price comes in an estimate I accept before I’m invoiced.`
                : `I accept this estimate${chosen && !pricing ? ` for ${totalLabel}` : ''} and agree to be invoiced for it.`}</span>
            </label>

            {error && <p className="pdError" role="alert">{error}</p>}

            <div className="pdActions">
              <button type="button" className="pdBtn pdBtnGhost" onClick={() => setAcceptOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="pdBtn" disabled={busy || !ready}>
                {busy ? 'Accepting…' : !chosen ? 'Choose an option first' : 'Accept estimate'}
              </button>
            </div>
          </form>
        )}
      </ClientDialog>

      {/* Not going ahead */}
      <ClientDialog open={declineOpen} onClose={() => { if (declinedNow) window.location.reload(); else setDeclineOpen(false); }} labelledBy="decline-title" locked={busy}>
        {declinedNow ? (
          <div className="pdDone">
            <span className="pdCheck pdCheckQuiet" aria-hidden>✓</span>
            <h2 id="decline-title" className="pdTitle">Thanks for letting us know</h2>
            <p className="pdLead">Lauren has your note. If anything changes, just reply to the email this estimate came in.</p>
            <div className="pdActions"><button type="button" className="pdBtn" onClick={() => window.location.reload()}>Close</button></div>
          </div>
        ) : (
          <form onSubmit={decline} noValidate>
            <h2 id="decline-title" className="pdTitle">Not going ahead?</h2>
            <p className="pdLead">That’s okay. A quick reason helps us — it goes straight to Lauren.</p>
            <fieldset className="pdGroup">
              <legend className="pdLabel">What’s the main reason? <span className="pdReq">Required</span></legend>
              <div className="pdChips">
                {REASONS.map((r) => (
                  <button key={r} type="button" className={`pdChip${chip === r ? ' pdOn' : ''}`} aria-pressed={chip === r}
                    onClick={() => setChip(chip === r ? null : r)}>{r}</button>
                ))}
              </div>
            </fieldset>
            <label className="pdField">
              <span>{chip === 'Something else' || !chip ? 'Tell us why' : 'Anything to add?'} {chip && chip !== 'Something else' ? <em>optional</em> : null}</span>
              <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </label>
            <label className="pdField">
              <span>Your name <em>optional</em></span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            {error && <p className="pdError" role="alert">{error}</p>}
            <div className="pdActions">
              <button type="button" className="pdBtn pdBtnGhost" onClick={() => setDeclineOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="pdBtn pdBtnDark" disabled={busy || !reason}>{busy ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        )}
      </ClientDialog>
    </>
  );
}
