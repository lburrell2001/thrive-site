'use client';

import { useState } from 'react';
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
        {googleReviewUrl && (
          <>
            <p className={s.lede}>
              One more favor, if you have a minute: the same words on Google help other Dallas businesses find us.
            </p>
            <a href={googleReviewUrl} className={s.google} target="_blank" rel="noreferrer">Leave a Google review →</a>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={s.form}>
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
        <span className={s.label}>What was it like working together?</span>
        <textarea
          className={s.input}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What you needed, how it went, and what changed after."
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
      <button type="submit" className={s.submit} disabled={sending}>{sending ? 'SENDING…' : 'SEND REVIEW →'}</button>
    </form>
  );
}
