"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DeclineResult {
  declinedAt: string;
  acknowledged: boolean;
}

/**
 * "Not going ahead" and the modal behind it.
 *
 * Set deliberately quieter than "Approve and sign" — it is the secondary
 * action — but not hidden. A client who has decided against something should
 * be able to say so on the page rather than having to compose an email, and
 * the reason they give is worth more than the silence.
 */
export function DeclineAction({
  slug,
  token,
  onDeclined,
}: {
  slug: string;
  token: string;
  onDeclined?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DeclineResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [reason, setReason] = useState("");
  const [declinedBy, setDeclinedBy] = useState("");
  const [declinerEmail, setDeclinerEmail] = useState("");

  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    opener.current?.focus();
  }, []);

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
      const res = await fetch(`/p/${encodeURIComponent(slug)}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          declinedBy: declinedBy || undefined,
          declinerEmail: declinerEmail || undefined,
          token,
        }),
      });
      const body = (await res.json()) as {
        data?: DeclineResult;
        error?: string;
      };
      if (!res.ok || body.error) {
        setError(body.error ?? "Something went wrong. Please try again.");
      } else if (body.data) {
        setResult(body.data);
        onDeclined?.();
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
        className="proposalFooterDecline"
        onClick={() => setOpen(true)}
      >
        Not going ahead
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
              className="signDialog signDialogDecline"
              role="dialog"
              aria-modal="true"
              aria-labelledby="decline-heading"
            >
              {result ? (
                <div>
                  <h2 id="decline-heading" className="signHeading">
                    Thanks for telling us.
                  </h2>
                  <p className="signIntro">
                    We have recorded that you are not going ahead, and why.
                    {result.acknowledged
                      ? " A copy is on its way to your inbox."
                      : " Nothing else is needed from you."}
                  </p>
                  <p className="signIntro">
                    If anything changes, or you would like a revised version,
                    reply to the email this proposal came in.
                  </p>
                  <div className="signActions">
                    <button
                      type="button"
                      className="signButtonGhost"
                      onClick={close}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <h2 id="decline-heading" className="signHeading">
                    Not going ahead?
                  </h2>
                  <p className="signIntro">
                    That is completely fine. Telling us why helps more than you
                    might think — and it is the fastest way to get a version
                    that does work, if you want one.
                  </p>

                  <div className="signField">
                    <label htmlFor="decline-reason">Why not?</label>
                    <textarea
                      ref={firstField}
                      id="decline-reason"
                      rows={4}
                      value={reason}
                      required
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Budget, timing, went another direction — whatever it is."
                    />
                  </div>

                  <div className="signField">
                    <label htmlFor="decline-name">Your name</label>
                    <input
                      id="decline-name"
                      value={declinedBy}
                      autoComplete="name"
                      onChange={(e) => setDeclinedBy(e.target.value)}
                    />
                    <span className="signHint">Optional.</span>
                  </div>

                  <div className="signField">
                    <label htmlFor="decline-email">Email</label>
                    <input
                      id="decline-email"
                      type="email"
                      value={declinerEmail}
                      autoComplete="email"
                      onChange={(e) => setDeclinerEmail(e.target.value)}
                    />
                    <span className="signHint">
                      Optional — only used to confirm we got this.
                    </span>
                  </div>

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
                      className="signButtonDecline"
                      disabled={submitting || !reason.trim()}
                    >
                      {submitting ? "Sending…" : "Send"}
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
