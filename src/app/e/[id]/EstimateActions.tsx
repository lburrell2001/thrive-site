'use client';

// The estimate page's footer: the total, "Export PDF", and "Accept estimate"
// with a short confirm (their name and a tick) — no login needed. Accepting
// turns it into an invoice in their portal if they have one; if not, Lauren
// sets their portal up and the invoice waits there (src/lib/acceptedPortal.ts). "Not going ahead" declines it with a reason
// (migration 058), which Lauren is sent.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InvoiceForPDF } from '@/lib/invoicePDF';
import type { LineSelection } from '@/lib/lineItems';

export function EstimateActions({ id, token, pdf, clientName, totalLabel, accepted, canAccept, declined = false, invoiced = false, selection, choiceLabel, pricing = false }: {
  id: string; token: string; pdf: InvoiceForPDF; clientName: string | null; totalLabel: string; accepted: boolean; canAccept: boolean; declined?: boolean; invoiced?: boolean;
  /** Tiers and extras (migration 061): what the client picked, sent with Accept. */
  selection?: LineSelection;
  /** "Custom store + 1 extra", said back in the confirm. */
  choiceLabel?: string;
  /** The total is being worked out for a new choice. */
  pricing?: boolean;
}) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [declinedNow, setDeclinedNow] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ invoiceReady: boolean; needsSetup: boolean } | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  async function exportPdf() {
    setPdfBusy(true);
    try {
      const { generateInvoicePDF } = await import('@/lib/invoicePDF');
      await generateInvoicePDF(pdf, clientName);
    } finally {
      setPdfBusy(false);
    }
  }

  async function accept() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/e/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), agreed, ...(selection ? { selection } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; invoiceReady?: boolean; needsSetup?: boolean };
      if (!res.ok) { setError(body.error ?? 'Something went wrong. Please try again.'); setBusy(false); return; }
      setDone({ invoiceReady: !!body.invoiceReady, needsSetup: !!body.needsSetup });
      setOpen(false);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  async function decline() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/e/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: reason.trim(), name: name.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(body.error ?? 'Something went wrong. Please try again.'); setBusy(false); return; }
      setDeclinedNow(true);
      setDeclining(false);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  const isAccepted = accepted || !!done;
  const isDeclined = declined || declinedNow;

  return (
    <>
      <div className="proposalFooter">
        <div style={{ minWidth: 0 }}>
          <div className="proposalFooterLabel">{isAccepted ? 'Accepted' : isDeclined ? 'Declined' : 'Estimate total'}</div>
          <div className="proposalFooterTotal">{totalLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="proposalFooterAction" onClick={exportPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Making the PDF…' : 'Export PDF'}
          </button>
          {isAccepted ? (
            (invoiced || done?.invoiceReady) ? <a className="proposalFooterAction proposalFooterActionPrimary" href="/portal/invoices">Go to your invoice</a> : null
          ) : canAccept && !isDeclined ? (<>
            <button type="button" className="proposalFooterAction" onClick={() => { setError(''); setDeclining(true); }}>Not going ahead</button>
            <button type="button" className="proposalFooterAction proposalFooterActionPrimary" disabled={pricing} onClick={() => { setError(''); setOpen(true); }}>Accept estimate</button>
          </>) : null}
        </div>
      </div>

      {done && (
        <p className="proposalNotice proposalNoticeGood" role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 96, zIndex: 40, margin: 0 }}>
          Thank you! {done.invoiceReady
            ? 'Your invoice is ready in your client portal — we’ve emailed you the link.'
            : done.needsSetup
              ? 'Next, we’ll set up your client portal and email you there — your invoice will be waiting.'
              : 'We’ve got it and will send your invoice shortly.'}
        </p>
      )}

      {declinedNow && (
        <p className="proposalNotice" role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 96, zIndex: 40, margin: 0 }}>
          Thanks for letting us know. Lauren has your note. If anything changes, just reply to the email this came in.
        </p>
      )}

      {declining && createPortal(
        <div className="signOverlay estimateDialog" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setDeclining(false); }}>
          <div className="signDialog" role="dialog" aria-modal="true" aria-labelledby="decline-heading">
            <h2 id="decline-heading" className="signHeading">Not going ahead?</h2>
            <p className="signIntro">That’s okay. A line on why helps us — price, timing, scope, or something else.</p>
            <div className="signField">
              <label htmlFor="decline-reason">Why not</label>
              <textarea id="decline-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </div>
            <div className="signField">
              <label htmlFor="decline-name">Your name (optional)</label>
              <input id="decline-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            {error && <p className="signError" role="alert">{error}</p>}
            <div className="signActions">
              <button type="button" className="signButtonGhost" onClick={() => setDeclining(false)} disabled={busy}>Cancel</button>
              <button type="button" className="signButton" onClick={decline} disabled={busy || !reason.trim()}>
                {busy ? 'Sending…' : 'Decline estimate'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div className="signOverlay estimateDialog" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className="signDialog" role="dialog" aria-modal="true" aria-labelledby="accept-heading">
            <h2 id="accept-heading" className="signHeading">Accept this estimate</h2>
            <p className="signIntro">Once you accept, we’ll send your invoice to your client portal.</p>
            <div className="signField">
              <label htmlFor="accept-name">Your name</label>
              <input id="accept-name" ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <label className="signCheck">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I accept this estimate{choiceLabel ? ` (${choiceLabel})` : ''} for {totalLabel} and agree to be invoiced for it.</span>
            </label>
            {error && <p className="signError" role="alert">{error}</p>}
            <div className="signActions">
              <button type="button" className="signButtonGhost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="signButton" onClick={accept} disabled={busy || !name.trim() || !agreed}>
                {busy ? 'Accepting…' : 'Accept estimate'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
