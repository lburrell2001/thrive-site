'use client';

// Texting someone from Lauren's Google Voice number. Google Voice can't be
// sent from by other software, so the CRM does the rest: type the message
// here, and one click copies it, opens Google Voice on their number (paste
// and send there) and logs it as a sent text — which counts as reaching
// out, like an email or DM. Texts they send come in by themselves through
// the Google Voice email alerts (outlookSync.ts); "They texted" logs one by
// hand. Used in the contact panel's Activity tab and the Prospects page.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { WhenField, isPast, localNow, whenToIso } from './WhenField';
import { apiSend } from '../proposals/adminApi';
import { googleVoiceUrl } from '@/lib/googleVoice';
import { formatPhone } from '@/lib/phone';

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

export function LogTextForm({ contactId, contactName, phone, onLogged, onCancel, autoFocus }: {
  contactId: string;
  contactName?: string;
  phone: string | null;
  onLogged: () => void | Promise<unknown>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [direction, setDirection] = useState<'sent' | 'received'>('sent');
  const [body, setBody] = useState('');
  const [followUp, setFollowUp] = useState(true);
  const [followDue, setFollowDue] = useState(() => inDays(3));
  const [at, setAt] = useState(localNow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const first = contactName?.trim().split(/\s+/)[0] || 'them';
  const followTitle = direction === 'sent' ? `Check for a text back from ${first}` : `Text ${first} back`;

  // Logging a text from earlier: just record it, don't open Google Voice.
  const earlier = isPast(at);

  async function log() {
    const when = whenToIso(at);
    if ('error' in when) { setError(when.error); return; }
    setSaving(true); setError('');
    try {
      await apiSend(`/api/crm/contacts/${contactId}/activities`, 'POST', {
        kind: 'text',
        body,
        at: when.iso,
        text: { direction },
        follow_up: followUp ? { title: followTitle, due_date: followDue || null } : null,
      });
      setBody(''); setAt(localNow());
      await onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the text');
    }
    setSaving(false);
  }

  function sendInVoice(e: React.FormEvent) {
    e.preventDefault();
    // Both inside the click, so the browser allows the new tab and the copy.
    window.open(googleVoiceUrl(phone), '_blank', 'noopener');
    if (body.trim()) void navigator.clipboard?.writeText(body.trim()).catch(() => undefined);
    void log();
  }

  return (
    <form onSubmit={direction === 'sent' && !earlier ? sendInVoice : (e) => { e.preventDefault(); void log(); }}>
      <div className={s.kindPicker} role="radiogroup" aria-label="Sent or received?">
        {(['sent', 'received'] as const).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={direction === d} className={`${p.filterChip} ${direction === d ? p.filterChipOn : ''}`}
            onClick={() => { setDirection(d); setFollowDue(inDays(d === 'sent' ? 3 : 1)); }}>
            {d === 'sent' ? 'I’m texting them' : 'They texted me'}
          </button>
        ))}
        {phone && (
          <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginLeft: 'auto' }} title="Copy the number"
            onClick={() => void navigator.clipboard?.writeText(formatPhone(phone)).catch(() => undefined)}>
            {formatPhone(phone)} ⧉
          </button>
        )}
      </div>

      <div className={s.formGrid}>
        <label className={s.full}>
          <span className={s.miniLabel}>{direction === 'sent' ? (earlier ? 'What you sent (optional)' : 'Your message (copied for you to paste in Google Voice)') : 'What they said (optional)'}</span>
          <textarea
            className={p.textarea}
            style={{ minHeight: 80 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={direction === 'sent' ? `Hi ${first}, it was great meeting you at…` : 'Paste their text, or a line to remember it by'}
            autoFocus={autoFocus}
          />
        </label>
        <WhenField value={at} onChange={setAt} />
        <label className={s.full} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
          <span>Add a task: {followTitle}</span>
        </label>
        {followUp && (
          <label>
            <span className={s.miniLabel}>Due</span>
            <input className={p.input} type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} />
          </label>
        )}
      </div>

      {!phone && <p className={s.eventMeta} style={{ marginTop: 6 }}>No phone number saved for them yet. Add it under Details.</p>}
      {direction === 'sent' && phone && !earlier && (
        <p className={s.eventMeta} style={{ marginTop: 6 }}>
          Opens Google Voice in a new tab. Paste the message (⌘V) and send it there. It’s logged here as sent.
        </p>
      )}
      {error && <p style={{ color: 'var(--a-danger)', fontSize: 13 }}>{error}</p>}

      <div className={s.modalActions} style={{ marginTop: 10 }}>
        {onCancel && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={onCancel} disabled={saving}>Cancel</button>}
        <button type="submit" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={saving || (direction === 'sent' && !phone && !earlier)}>
          {saving ? 'Saving…' : direction === 'sent' ? (earlier ? 'Log text' : body.trim() ? 'Copy & open Google Voice' : 'Open Google Voice') : 'Log their text'}
        </button>
      </div>
    </form>
  );
}
