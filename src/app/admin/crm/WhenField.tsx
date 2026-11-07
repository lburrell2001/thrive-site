'use client';

// "When did this happen?" for logging activity after the fact — a call last
// Tuesday, a text from this morning. Defaults to now; can't be in the future.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';

/** Now, as a datetime-local value in the browser's time. */
export function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** The datetime-local value as an ISO time, or an error message. */
export function whenToIso(value: string): { iso: string } | { error: string } {
  const when = value ? new Date(value) : new Date();
  if (Number.isNaN(when.getTime())) return { error: 'Check the date and time' };
  // A minute's grace for the clock ticking while the form is open.
  if (when.getTime() > Date.now() + 60_000) return { error: futureMessage() };
  return { iso: when.toISOString() };
}

/** More than a few minutes ago: logging something that already happened. */
export function isPast(value: string) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) && t < Date.now() - 10 * 60_000;
}

/** Says what time it is now, since the usual slip is AM/PM or the wrong day. */
function futureMessage() {
  const now = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `That’s later than now (${now}). Check AM/PM and the date.`;
}

// No `max` on the input: the browser's own message ("must be less than or
// equal to 2026-11-07T00:21") is cryptic, and it went stale while the form
// sat open. The hint below and whenToIso() do the checking instead.
export function WhenField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Worked out when the value changes (the clock can't be read during render).
  const [hint, setHint] = useState('');
  function change(v: string) {
    const t = v ? new Date(v).getTime() : NaN;
    setHint(Number.isFinite(t) && t > Date.now() + 60_000 ? futureMessage() : '');
    onChange(v);
  }
  return (
    <label>
      <span className={s.miniLabel}>When</span>
      <input className={p.input} type="datetime-local" value={value} onChange={(e) => change(e.target.value)}
        aria-invalid={hint ? true : undefined} style={hint ? { borderColor: 'var(--a-danger, #b42318)' } : undefined} />
      {hint && <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--a-danger, #b42318)' }}>{hint}</span>}
    </label>
  );
}
