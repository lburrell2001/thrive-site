'use client';

// The estimate page's footer: the total, "Export PDF", and "Accept estimate"
// with a short confirm (their name and a tick). Accepting turns it into an
// invoice in their portal.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InvoiceForPDF } from '@/lib/invoicePDF';

export function EstimateActions({ id, token, pdf, clientName, totalLabel, accepted, canAccept }: {
  id: string; token: string; pdf: InvoiceForPDF; clientName: string | null; totalLabel: string; accepted: boolean; canAccept: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ invoiceReady: boolean } | null>(null);
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
        body: JSON.stringify({ token, name: name.trim(), agreed }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; invoiceReady?: boolean };
      if (!res.ok) { setError(body.error ?? 'Something went wrong. Please try again.'); setBusy(false); return; }
      setDone({ invoiceReady: !!body.invoiceReady });
      setOpen(false);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  const isAccepted = accepted || !!done;

  return (
    <>
      <div className="proposalFooter">
        <div style={{ minWidth: 0 }}>
          <div className="proposalFooterLabel">{isAccepted ? 'Accepted' : 'Estimate total'}</div>
          <div className="proposalFooterTotal">{totalLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="proposalFooterAction" onClick={exportPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Making the PDF…' : 'Export PDF'}
          </button>
          {isAccepted ? (
            <a className="proposalFooterAction proposalFooterActionPrimary" href="/portal/invoices">Go to your invoice</a>
          ) : canAccept ? (
            <button type="button" className="proposalFooterAction proposalFooterActionPrimary" onClick={() => setOpen(true)}>Accept estimate</button>
          ) : null}
        </div>
      </div>

      {done && (
        <p className="proposalNotice proposalNoticeGood" role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 96, zIndex: 40, margin: 0 }}>
          Thank you! {done.invoiceReady ? 'Your invoice is ready in your client portal — we’ve emailed you the link.' : 'We’ve got it and will send your invoice shortly.'}
        </p>
      )}

      {open && createPortal(
        <div className="signOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className="signDialog" role="dialog" aria-modal="true" aria-labelledby="accept-heading">
            <h2 id="accept-heading" className="signHeading">Accept this estimate</h2>
            <p className="signIntro">Your invoice will be ready in your client portal straight away.</p>
            <div className="signField">
              <label htmlFor="accept-name">Your name</label>
              <input id="accept-name" ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <label className="signCheck">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I accept this estimate for {totalLabel} and agree to be invoiced for it.</span>
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
