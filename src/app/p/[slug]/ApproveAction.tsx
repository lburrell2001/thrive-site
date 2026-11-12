"use client";

// "Approve proposal" (replaces the old typed signature, Nov 2026). The client
// picks an option when there are tiers — required, nothing is preselected —
// ticks any extras, sees their total and deposit, then gives their name and
// email and agrees. Posts to ./sign, which records the approval (who, when,
// IP, a snapshot of what they approved) exactly as a signature was.

import { useState } from "react";
import type { ProposalChoices } from "@/lib/proposalChoices";
import { ClientDialog } from "@/components/ClientDialog";

interface ApproveResult {
  totalLabel: string;
  depositLabel: string;
  depositPercent: number;
  portalPath: string;
  needsSetup?: boolean;
  receiptEmail: string;
}

export function ApproveAction({
  slug,
  token,
  pdfHref,
  termsUrl,
  choices,
  currency = "USD",
  totalCents,
  depositPercent,
}: {
  slug: string;
  token: string;
  pdfHref: string;
  termsUrl?: string;
  choices?: ProposalChoices | null;
  currency?: string;
  /** The total when there's nothing to choose. */
  totalCents: number;
  depositPercent: number;
}) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApproveResult | null>(null);

  const money = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
  const needsTier = !!choices?.tiers.length;
  const base = needsTier ? choices!.tiers.find((t) => t.name === tier)?.total_cents ?? null : totalCents;
  const total = base === null ? null : base + (choices?.extras.filter((e) => extras.includes(e.id)).reduce((n, e) => n + e.amount_cents, 0) ?? 0);
  const deposit = total !== null && depositPercent > 0 && depositPercent < 100 ? Math.round((total * depositPercent) / 100) : null;
  const ready = (!needsTier || !!tier) && name.trim() && /\S+@\S+\.\S+/.test(email) && agreed;

  async function approve(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/p/${encodeURIComponent(slug)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: name.trim(),
          signerEmail: email.trim(),
          typedName: name.trim(),
          agreedTerms: true,
          token,
          ...(choices ? { selection: { tier, optional: extras } } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: ApproveResult; error?: string };
      if (!res.ok || body.error || !body.data) setError(body.error ?? "Something went wrong. Please try again.");
      else setResult(body.data);
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="proposalFooterAction proposalFooterActionPrimary" onClick={() => setOpen(true)}>
        Approve proposal
      </button>

      <ClientDialog open={open} onClose={() => { if (result) window.location.reload(); else setOpen(false); }} labelledBy="approve-title" locked={busy} wide={!!choices}>
        {result ? (
          <div className="pdDone">
            <span className="pdCheck" aria-hidden>✓</span>
            <h2 id="approve-title" className="pdTitle">Approved — thank you!</h2>
            <p className="pdLead">Your receipt is on its way to {result.receiptEmail}.</p>
            <dl className="pdSummary">
              <div><dt>Total</dt><dd>{result.totalLabel}</dd></div>
              {result.depositPercent > 0 && result.depositPercent < 100 && (
                <div><dt>Deposit to start ({result.depositPercent}%)</dt><dd>{result.depositLabel}</dd></div>
              )}
            </dl>
            <p className="pdLead">
              {result.needsSetup
                ? "Next, we’ll set up your client portal and email you there — your deposit invoice will be waiting. Work begins as soon as it lands."
                : "Your deposit invoice is in your client portal. Work begins as soon as it lands."}
            </p>
            <div className="pdActions">
              <a className="pdBtn pdBtnGhost" href={pdfHref} target="_blank" rel="noopener noreferrer">Save a PDF</a>
              {result.needsSetup
                ? <button type="button" className="pdBtn" onClick={() => window.location.reload()}>Done</button>
                : <a className="pdBtn" href={result.portalPath}>Pay the deposit</a>}
            </div>
          </div>
        ) : (
          <form onSubmit={approve} noValidate>
            <h2 id="approve-title" className="pdTitle">Approve proposal</h2>
            <p className="pdLead">
              {needsTier ? "Choose your option, add any extras, and approve. " : ""}
              We’ll record the date and time and keep a copy of exactly what you approved.
            </p>

            {needsTier && (
              <fieldset className="pdGroup">
                <legend className="pdLabel">Choose your option <span className="pdReq">Required</span></legend>
                <div className="pdOptions">
                  {choices!.tiers.map((t, i) => (
                    <label key={t.name} className={`pdOption${tier === t.name ? " pdOn" : ""}`}>
                      <input type="radio" name="approve-tier" checked={tier === t.name} onChange={() => setTier(t.name)} />
                      <span className="pdOptionKicker">Option {i + 1}</span>
                      <span className="pdOptionName">{t.name}</span>
                      <span className="pdOptionPrice">{money(t.total_cents)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {!!choices?.extras.length && (
              <fieldset className="pdGroup">
                <legend className="pdLabel">Add extras <span className="pdHint">optional</span></legend>
                <div className="pdExtras">
                  {choices.extras.map((x) => {
                    const on = extras.includes(x.id);
                    return (
                      <label key={x.id} className={`pdExtra${on ? " pdOn" : ""}`}>
                        <input type="checkbox" checked={on}
                          onChange={(e) => setExtras((cur) => (e.target.checked ? [...cur, x.id] : cur.filter((id) => id !== x.id)))} />
                        <span className="pdExtraText">
                          <span className="pdExtraName">{x.label}</span>
                          {x.description && <span className="pdExtraDesc">{x.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, "")}</span>}
                        </span>
                        <span className="pdExtraPrice">+ {money(x.amount_cents)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="pdTotal" aria-live="polite">
              <div>
                <span>Your total</span>
                <strong>{total === null ? "Choose an option" : money(total)}</strong>
              </div>
              {deposit !== null && (
                <div>
                  <span>Deposit to start ({depositPercent}%)</span>
                  <strong>{money(deposit)}</strong>
                </div>
              )}
            </div>

            <div className="pdFields">
              <label className="pdField">
                <span>Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </label>
              <label className="pdField">
                <span>Email <em>for your receipt</em></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
            </div>

            <label className="pdAgree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I approve this proposal{total !== null ? ` for ${money(total)}` : ""} and agree to
                {termsUrl
                  ? <> the <a href={termsUrl} target="_blank" rel="noopener noreferrer">terms of engagement</a>.</>
                  : " the scope and pricing set out in it."}
              </span>
            </label>

            {error && <p className="pdError" role="alert">{error}</p>}

            <div className="pdActions">
              <button type="button" className="pdBtn pdBtnGhost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="pdBtn" disabled={busy || !ready}>
                {busy ? "Approving…" : needsTier && !tier ? "Choose an option first" : "Approve proposal"}
              </button>
            </div>
          </form>
        )}
      </ClientDialog>
    </>
  );
}
