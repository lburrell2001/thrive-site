"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProposalChoices } from "@/lib/proposalChoices";

interface SignResult {
  signedAt: string;
  totalLabel: string;
  depositLabel: string;
  depositPercent: number;
  portalPath: string;
  /** No portal yet: Lauren sets it up and the deposit invoice waits there. */
  needsSetup?: boolean;
  receiptEmail: string;
}

/**
 * "Approve and sign", the modal behind it, and the confirmation that replaces
 * it. This is the only JavaScript the client view ships.
 */
export function SignAction({
  slug,
  token,
  pdfHref,
  termsUrl,
  choices,
  currency = "USD",
}: {
  slug: string;
  token: string;
  pdfHref: string;
  termsUrl?: string;
  /** Tiers and optional extras (migration 061): the client picks theirs here. */
  choices?: ProposalChoices | null;
  currency?: string;
}) {
  const [tier, setTier] = useState<string | null>(choices?.tiers[0]?.name ?? null);
  const [extras, setExtras] = useState<string[]>([]);
  const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
  const chosenTotal = choices
    ? (choices.tiers.find((t) => t.name === tier)?.total_cents ?? 0) + choices.extras.filter((e) => extras.includes(e.id)).reduce((n, e) => n + e.amount_cents, 0)
    : 0;
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SignResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [typedName, setTypedName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);

  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    opener.current?.focus();
  }, []);

  // Escape closes, and Tab is trapped inside the dialog while it is open.
  useEffect(() => {
    if (!open) return;

    firstField.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !result) {
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;

      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), textarea, select",
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, result, close]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/p/${encodeURIComponent(slug)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          signerEmail,
          signerTitle: signerTitle || undefined,
          typedName,
          agreedTerms,
          token,
          ...(choices ? { selection: { tier, optional: extras } } : {}),
        }),
      });
      const body = (await res.json()) as { data?: SignResult; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? "Something went wrong. Please try again.");
      } else if (body.data) {
        setResult(body.data);
      }
    } catch {
      setError(
        "We could not reach the server. Check your connection and try again.",
      );
    }

    setSubmitting(false);
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="proposalFooterAction proposalFooterActionPrimary"
        onClick={() => setOpen(true)}
      >
        Approve and sign
      </button>

      {/*
        Portalled to the body on purpose. This lives inside the sticky footer,
        and that footer has a backdrop-filter — which makes it the containing
        block for any fixed-position descendant, so the overlay was being
        confined to the footer's own box instead of covering the viewport.
      */}
      {open &&
        createPortal(
          <div className="signOverlay" role="presentation">
            <div
              ref={dialog}
              className="signDialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sign-heading"
            >
              {result ? (
                <Confirmation result={result} pdfHref={pdfHref} />
              ) : (
                <form onSubmit={submit}>
                  <h2 id="sign-heading" className="signHeading">
                    Approve this proposal
                  </h2>
                  <p className="signIntro">
                    Typing your name below counts as your signature. We record
                    the date, time, and a copy of exactly what you are
                    approving.
                  </p>

                  {choices && (
                    <fieldset className="signChoices">
                      {choices.tiers.length > 0 && (
                        <>
                          <legend className="signChoicesHead">Choose your option</legend>
                          {choices.tiers.map((t, i) => (
                            <label key={t.name} className={`signChoice${tier === t.name ? " signChoiceOn" : ""}`}>
                              <input type="radio" name="sign-tier" checked={tier === t.name} onChange={() => setTier(t.name)} />
                              <span>Option {i + 1}: {t.name}</span>
                              <strong>{money(t.total_cents)}</strong>
                            </label>
                          ))}
                        </>
                      )}
                      {choices.extras.length > 0 && (
                        <>
                          <p className="signChoicesHead">Add any extras</p>
                          {choices.extras.map((e) => (
                            <label key={e.id} className="signChoice">
                              <input type="checkbox" checked={extras.includes(e.id)}
                                onChange={(ev) => setExtras((cur) => (ev.target.checked ? [...cur, e.id] : cur.filter((x) => x !== e.id)))} />
                              <span>{e.label}</span>
                              <strong>+ {money(e.amount_cents)}</strong>
                            </label>
                          ))}
                        </>
                      )}
                      <p className="signChoicesTotal"><span>Your total</span><strong>{money(chosenTotal)}</strong></p>
                    </fieldset>
                  )}

                  <SignField
                    ref={firstField}
                    id="sign-name"
                    label="Full name"
                    value={signerName}
                    onChange={setSignerName}
                    autoComplete="name"
                    required
                  />
                  <SignField
                    id="sign-email"
                    label="Email"
                    type="email"
                    value={signerEmail}
                    onChange={setSignerEmail}
                    autoComplete="email"
                    hint="Your receipt goes here."
                    required
                  />
                  <SignField
                    id="sign-title"
                    label="Title"
                    value={signerTitle}
                    onChange={setSignerTitle}
                    autoComplete="organization-title"
                    hint="Optional."
                  />
                  <SignField
                    id="sign-typed"
                    label="Type your name to sign"
                    value={typedName}
                    onChange={setTypedName}
                    className="signSignatureInput"
                    required
                  />

                  <label className="signCheck">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                    />
                    <span>
                      I have read this proposal and agree to
                      {termsUrl ? (
                        <>
                          {" "}
                          the{" "}
                          <a
                            href={termsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            terms of engagement
                          </a>
                          .
                        </>
                      ) : (
                        " the scope and pricing set out in it."
                      )}
                    </span>
                  </label>

                  {error && (
                    <p className="signError" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="signActions">
                    <button
                      type="button"
                      className="signButtonGhost"
                      onClick={close}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="signButton"
                      disabled={submitting || !agreedTerms || !typedName.trim()}
                    >
                      {submitting ? "Recording…" : "Approve and sign"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Confirmation({
  result,
  pdfHref,
}: {
  result: SignResult;
  pdfHref: string;
}) {
  return (
    <div>
      <h2 id="sign-heading" className="signHeading">
        Approved. Thank you.
      </h2>
      <p className="signIntro">
        A receipt is on its way to {result.receiptEmail}. Here is what happens
        next.
      </p>

      <dl className="signSummary">
        <div>
          <dt>Total</dt>
          <dd>{result.totalLabel}</dd>
        </div>
        <div className="signSummaryTotal">
          <dt>Deposit due ({result.depositPercent}%)</dt>
          <dd>{result.depositLabel}</dd>
        </div>
      </dl>

      <p className="signIntro">
        {result.needsSetup
          ? 'Next, we’ll set up your client portal and email you there — your deposit invoice will be waiting. Work begins as soon as it lands.'
          : 'Pay the deposit in your client portal. Work begins as soon as it lands.'}
      </p>

      <div className="signActions">
        <a
          className="signButtonGhost"
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Save a PDF
        </a>
        {!result.needsSetup && (
          <a className="signButton" href={result.portalPath}>
            Pay the deposit
          </a>
        )}
      </div>
    </div>
  );
}

function SignField({
  ref,
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
  required,
  autoComplete,
  className,
}: {
  ref?: React.Ref<HTMLInputElement>;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div className="signField">
      <label htmlFor={id}>
        {label}
        {!required && ""}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className={className}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="signHint">{hint}</span>}
    </div>
  );
}
