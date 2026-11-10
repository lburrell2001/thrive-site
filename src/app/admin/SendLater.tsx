'use client';

// "Send later" for the Send dialogs (proposals, estimates, invoices): off, a
// quiet button; on, a date and time (the viewer's own time zone). The cron
// sends within five minutes of it (src/lib/scheduledSends.ts).

import p from './proposals/proposals.module.css';
import { CRON_MINUTES, defaultSendTime, formatWhen, scheduleProblem } from '@/lib/scheduleTime';

/** The chosen time as ISO, or why it can't be used. */
export function laterAt(when: string | null): { iso: string; problem: string | null } | null {
  if (when === null) return null;
  const at = new Date(when);
  return { iso: Number.isNaN(at.getTime()) ? '' : at.toISOString(), problem: scheduleProblem(at) };
}

export const scheduledFor = (iso: string) => `Scheduled for ${formatWhen(iso)}.`;

export default function SendLater({ when, onChange, disabled }: { when: string | null; onChange: (when: string | null) => void; disabled?: boolean }) {
  if (when === null) {
    return (
      <button type="button" className={p.btn} style={{ justifySelf: 'start' }} disabled={disabled} onClick={() => onChange(defaultSendTime())}>
        Send later…
      </button>
    );
  }
  const problem = scheduleProblem(new Date(when));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label>
        <span className={p.label}>Send at (your time)</span>
        <input type="datetime-local" className={p.input} value={when} step={CRON_MINUTES * 60} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      </label>
      <span style={{ fontSize: 12.5, color: problem ? '#e50586' : '#6b6b6b' }}>
        {problem ?? `Goes out within ${CRON_MINUTES} minutes of this time. You can cancel it until then.`}{' '}
        <button type="button" onClick={() => onChange(null)} disabled={disabled}
          style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: '#141414', textDecoration: 'underline', cursor: 'pointer' }}>
          Send now instead
        </button>
      </span>
    </div>
  );
}
