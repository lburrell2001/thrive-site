'use client';

// Google first (the review that helps most: local search, Maps, the stars in
// results), then the same words pasted here so they can appear on the site.
// Clients who skip Google can still review here, and are offered Google after.

import { useEffect, useRef, useState } from 'react';
import s from '../review.module.css';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function ReviewForm({ token, defaultName, googleReviewUrl }: {
  token: string;
  defaultName: string;
  googleReviewUrl: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState('');
  const [consent, setConsent] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  // 'google' (the first step), 'paste' (they went to Google), 'here' (skipped Google).
  const [step, setStep] = useState<'google' | 'paste' | 'here'>(googleReviewUrl ? 'google' : 'here');
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Back from Google: straight to the paste box.
  useEffect(() => {
    if (step !== 'paste') return;
    const onBack = () => { if (document.visibilityState === 'visible') textarea.current?.focus(); };
    document.addEventListener('visibilitychange', onBack);
    return () => document.removeEventListener('visibilitychange', onBack);
  }, [step]);

  function openGoogle() {
    window.open(googleReviewUrl!, '_blank', 'noopener,noreferrer');
    setStep('paste');
  }

  /** Copies their review, then opens Google's review page for them to paste it. */
  async function toGoogle() {
    try { await navigator.clipboard.writeText(body.trim()); setCopied(true); } catch { setCopied(false); }
    window.open(googleReviewUrl!, '_blank', 'noopener,noreferrer');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { setError('Choose a rating'); return; }
    setSending(true); setError('');
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, body, display_name: name, display_role: role, consent_publish: consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong — please try again');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again');
    }
    setSending(false);
  }

  if (done) {
    return (
      <div className={s.thanks} role="status">
        <p className={s.thanksTitle}>Thank you, {name.split(' ')[0] || 'friend'}!</p>
        <p className={s.lede}>Your review is in. It genuinely helps a small studio grow.</p>
        {googleReviewUrl && step === 'here' && (
          <>
            <p className={s.lede}>
              One more favor, if you have a minute: posting the same words on Google helps other businesses find us. We’ll copy your review so you can paste it in.
            </p>
            <button type="button" className={s.google} onClick={toGoogle}>Copy my review &amp; open Google →</button>
            {copied && (
              <ol className={s.googleSteps}>
                <li>Your review is copied.</li>
                <li>On Google, tap the stars, then paste it into the box (press and hold, then Paste).</li>
                <li>Tap Post. That’s it — thank you!</li>
              </ol>
            )}
            <p className={s.googleAlt}>Or <a href={googleReviewUrl} target="_blank" rel="noreferrer">open Google</a> and write it fresh.</p>
          </>
        )}
      </div>
    );
  }

  if (step === 'google') {
    return (
      <div className={s.steps}>
        <ol className={s.stepList}>
          <li><strong>Leave your review on Google.</strong> It’s the one that helps other businesses find us.</li>
          <li><strong>Before you tap Post, copy what you wrote</strong> (press and hold, Select All, Copy).</li>
          <li><strong>Come back here and paste it</strong> so it can appear on our website too.</li>
        </ol>
        <button type="button" className={s.google} onClick={openGoogle}>Leave my review on Google →</button>
        <button type="button" className={s.textButton} onClick={() => setStep('here')}>No Google account? Just leave it here</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={s.form}>
      {step === 'paste' && (
        <p className={s.pasteNote}>
          Thank you for reviewing us on Google! Now paste the same review below, with your rating, so it can appear on our site too.
          {' '}<button type="button" className={s.textButton} onClick={openGoogle}>Open Google again</button>
        </p>
      )}
      <fieldset className={s.stars}>
        <legend className={s.label}>Your rating</legend>
        <div className={s.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`${s.star} ${n <= rating ? s.starOn : ''}`}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className={s.srOnly} />
              <span aria-hidden="true">★</span>
              <span className={s.srOnly}>{n} star{n === 1 ? '' : 's'} — {LABELS[n]}</span>
            </label>
          ))}
          {rating > 0 && <span className={s.ratingLabel}>{LABELS[rating]}</span>}
        </div>
      </fieldset>

      <label className={s.field}>
        <span className={s.label}>{step === 'paste' ? 'Paste your Google review' : 'What was it like working together?'}</span>
        <textarea
          ref={textarea}
          className={s.input}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={step === 'paste' ? 'Paste your Google review here' : 'What you needed, how it went, and what changed after.'}
          required
          minLength={10}
          maxLength={2000}
        />
      </label>

      <div className={s.row}>
        <label className={s.field}>
          <span className={s.label}>Your name, as it should appear</span>
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </label>
        <label className={s.field}>
          <span className={s.label}>Role and company (optional)</span>
          <input className={s.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Owner, Bloom Co." maxLength={120} />
        </label>
      </div>

      <label className={s.consent}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Thrive Creative Studios may share this review, with my name, on its website.</span>
      </label>

      {error && <p className={s.error} role="alert">{error}</p>}
      <button type="submit" className={s.submit} disabled={sending}>{sending ? 'Sending…' : 'Send review'}</button>
    </form>
  );
}
