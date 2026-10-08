'use client';

// Logging a phone call: who called whom, how it went, how long, when, which
// deal, notes, and an optional follow-up. Used in the contact panel's
// Activity tab and the Calls page's "Log a call" dialog.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiSend } from '../proposals/adminApi';
import {
  CALL_DIRECTIONS,
  CALL_DIRECTION_LABEL,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABEL,
  type CallDirection,
  type CallOutcome,
  type CrmDeal,
} from '@/types/crm';

/** Now, as a datetime-local value in the browser's time. */
function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

export function LogCallForm({ contactId, contactName, deals = [], defaultDealId, onLogged, onCancel, autoFocus }: {
  contactId: string;
  contactName?: string;
  /** Their deals, to file the call under one. */
  deals?: Pick<CrmDeal, 'id' | 'title' | 'stage'>[];
  defaultDealId?: string | null;
  onLogged: () => void | Promise<unknown>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const [direction, setDirection] = useState<CallDirection>('outbound');
  const [outcome, setOutcome] = useState<CallOutcome>('connected');
  const [at, setAt] = useState(localNow);
  const [minutes, setMinutes] = useState('');
  const [dealId, setDealId] = useState(defaultDealId ?? (open.length === 1 ? open[0].id : ''));
  const [body, setBody] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [followTitle, setFollowTitle] = useState('');
  const [followDue, setFollowDue] = useState(() => inDays(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const first = contactName?.trim().split(/\s+/)[0];
  const followPlaceholder = outcome === 'connected' ? `Follow up with ${first || 'them'}` : `Call ${first || 'them'} back`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mins = minutes.trim() ? Number(minutes) : null;
    if (mins !== null && (!Number.isInteger(mins) || mins < 0 || mins > 600)) { setError('Minutes: a whole number'); return; }
    const when = at ? new Date(at) : new Date();
    if (Number.isNaN(when.getTime())) { setError('Check the date and time'); return; }
    setSaving(true); setError('');
    try {
      await apiSend(`/api/crm/contacts/${contactId}/activities`, 'POST', {
        kind: 'call',
        body,
        at: when.toISOString(),
        deal_id: dealId || null,
        call: { direction, outcome, minutes: outcome === 'connected' ? mins : null },
        follow_up: followUp ? { title: followTitle.trim() || followPlaceholder, due_date: followDue || null } : null,
      });
      setBody(''); setMinutes(''); setAt(localNow()); setFollowUp(false); setFollowTitle('');
      await onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the call');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit}>
      <div className={s.kindPicker} role="radiogroup" aria-label="Who called?">
        {CALL_DIRECTIONS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={direction === d} className={`${p.filterChip} ${direction === d ? p.filterChipOn : ''}`} onClick={() => setDirection(d)}>
            {CALL_DIRECTION_LABEL[d]}
          </button>
        ))}
      </div>
      <div className={s.kindPicker} role="radiogroup" aria-label="How did it go?">
        {CALL_OUTCOMES.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={outcome === o} className={`${p.filterChip} ${outcome === o ? p.filterChipOn : ''}`} onClick={() => setOutcome(o)}>
            {CALL_OUTCOME_LABEL[o]}
          </button>
        ))}
      </div>

      <div className={s.formGrid}>
        <label>
          <span className={s.miniLabel}>When</span>
          <input className={p.input} type="datetime-local" value={at} max={localNow()} onChange={(e) => setAt(e.target.value)} />
        </label>
        {outcome === 'connected' && (
          <label>
            <span className={s.miniLabel}>Minutes</span>
            <input className={p.input} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="15" />
          </label>
        )}
        {deals.length > 0 && (
          <label className={s.full}>
            <span className={s.miniLabel}>About</span>
            <select className={p.select} value={dealId} onChange={(e) => setDealId(e.target.value)}>
              <option value="">No particular deal</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}{open.includes(d) ? '' : ` (${d.stage})`}</option>)}
            </select>
          </label>
        )}
        <label className={s.full}>
          <span className={s.miniLabel}>Notes{outcome === 'connected' ? '' : ' (optional)'}</span>
          <textarea
            className={p.textarea}
            style={{ minHeight: 70 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={outcome === 'connected' ? 'What did you talk about? Next steps?' : 'Anything to remember'}
            autoFocus={autoFocus}
          />
        </label>
        <label className={s.full} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
          <span>Add a follow-up task</span>
        </label>
        {followUp && (
          <>
            <label>
              <span className={s.miniLabel}>Task</span>
              <input className={p.input} value={followTitle} onChange={(e) => setFollowTitle(e.target.value)} placeholder={followPlaceholder} />
            </label>
            <label>
              <span className={s.miniLabel}>Due</span>
              <input className={p.input} type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {outcome === 'connected' && (dealId ? deals.find((d) => d.id === dealId)?.stage === 'lead' : open.some((d) => d.stage === 'lead')) && (
        <p className={s.eventMeta} style={{ marginTop: 6 }}>Logging a call where you talked moves {dealId ? 'this deal' : 'their New lead deals'} to Contacted.</p>
      )}
      {error && <p className={s.error}>{error}</p>}
      <div className={s.modalActions} style={{ marginTop: 8 }}>
        {onCancel && <button type="button" className={p.btn} onClick={onCancel}>Cancel</button>}
        <button type="submit" className={`${p.btn} ${onCancel ? p.btnPrimary : p.btnSmall}`} disabled={saving}>
          {saving ? 'Saving…' : 'Log call'}
        </button>
      </div>
    </form>
  );
}
