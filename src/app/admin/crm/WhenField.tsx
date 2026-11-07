'use client';

// "When did this happen?" for logging activity after the fact — a call last
// Tuesday, a text from this morning. Defaults to now; can't be in the future.

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
  if (when.getTime() > Date.now() + 60_000) return { error: 'That time hasn’t happened yet' };
  return { iso: when.toISOString() };
}

/** More than a few minutes ago: logging something that already happened. */
export function isPast(value: string) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) && t < Date.now() - 10 * 60_000;
}

export function WhenField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className={s.miniLabel}>When</span>
      <input className={p.input} type="datetime-local" value={value} max={localNow()} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
