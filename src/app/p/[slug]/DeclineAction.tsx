"use client";

// "Not going ahead" on a proposal (Nov 2026 redesign): the same light dialog
// as Approve. A reason is required — quick chips (price, timing, scope, went
// another way) fill it in and a box adds detail — name and email are optional
// (an email gets them a short acknowledgement). Posts to ./decline as before.

import { useState } from "react";
import { ProposalDialog } from "./ProposalDialog";

interface DeclineResult {
  declinedAt: string;
  acknowledged: boolean;
}

const REASONS = ["The price", "The timing", "The scope isn’t right", "We’re going another way", "Something else"];

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
  const [chip, setChip] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeclineResult | null>(null);

  const reason = [chip && chip !== "Something else" ? chip : null, detail.trim() || null].filter(Boolean).join(" — ");
  const ready = !!reason && (!email.trim() || /\S+@\S+\.\S+/.test(email));

  async function decline(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/p/${encodeURIComponent(slug)}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, declinedBy: name.trim() || undefined, declinerEmail: email.trim() || undefined, token }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: DeclineResult; error?: string };
      if (!res.ok || body.error || !body.data) setError(body.error ?? "Something went wrong. Please try again.");
      else { setResult(body.data); onDeclined?.(); }
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="proposalFooterAction" onClick={() => setOpen(true)}>
        Not going ahead
      </button>

      <ProposalDialog open={open} onClose={() => { if (result) window.location.reload(); else setOpen(false); }} labelledBy="decline-title" locked={busy}>
        {result ? (
          <div className="pdDone">
            <span className="pdCheck pdCheckQuiet" aria-hidden>✓</span>
            <h2 id="decline-title" className="pdTitle">Thanks for letting us know</h2>
            <p className="pdLead">
              Lauren has your note{result.acknowledged ? ", and a short confirmation is on its way to your inbox" : ""}.
              If anything changes, just reply to the email this proposal came in.
            </p>
            <div className="pdActions">
              <button type="button" className="pdBtn" onClick={() => window.location.reload()}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={decline} noValidate>
            <h2 id="decline-title" className="pdTitle">Not going ahead?</h2>
            <p className="pdLead">That’s okay. A quick reason helps us — it goes straight to Lauren.</p>

            <fieldset className="pdGroup">
              <legend className="pdLabel">What’s the main reason? <span className="pdReq">Required</span></legend>
              <div className="pdChips">
                {REASONS.map((r) => (
                  <button key={r} type="button" className={`pdChip${chip === r ? " pdOn" : ""}`} aria-pressed={chip === r}
                    onClick={() => setChip(chip === r ? null : r)}>{r}</button>
                ))}
              </div>
            </fieldset>

            <label className="pdField">
              <span>{chip === "Something else" || !chip ? "Tell us why" : "Anything to add?"} {chip && chip !== "Something else" ? <em>optional</em> : null}</span>
              <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </label>

            <div className="pdFields">
              <label className="pdField">
                <span>Your name <em>optional</em></span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="pdField">
                <span>Email <em>optional, for a confirmation</em></span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>
            </div>

            {error && <p className="pdError" role="alert">{error}</p>}

            <div className="pdActions">
              <button type="button" className="pdBtn pdBtnGhost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="pdBtn pdBtnDark" disabled={busy || !ready}>{busy ? "Sending…" : "Send"}</button>
            </div>
          </form>
        )}
      </ProposalDialog>
    </>
  );
}
