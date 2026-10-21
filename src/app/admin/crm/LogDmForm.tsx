'use client';

// Logging an Instagram or Facebook DM: which app, sent or a reply, what was
// said, and an optional follow-up. The message itself is sent in the app;
// this opens their profile and records that it happened. Used in the
// contact panel's Activity tab and the Prospects page's DM button.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiSend } from '../proposals/adminApi';
import {
  DM_DIRECTIONS,
  DM_DIRECTION_LABEL,
  DM_PLATFORMS,
  DM_PLATFORM_LABEL,
  socialUrl,
  type DmDirection,
  type DmPlatform,
} from '@/lib/social';

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

export function LogDmForm({ contactId, contactName, instagram, facebook, prospect, onLogged, onCancel, autoFocus }: {
  contactId: string;
  contactName?: string;
  instagram: string | null;
  facebook: string | null;
  /** On the Prospects list: a reply moves them to the pipeline. */
  prospect?: boolean;
  onLogged: () => void | Promise<unknown>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const handles: Record<DmPlatform, string | null> = { instagram, facebook };
  const [platform, setPlatform] = useState<DmPlatform>(instagram || !facebook ? 'instagram' : 'facebook');
  const [direction, setDirection] = useState<DmDirection>('sent');
  const [body, setBody] = useState('');
  const [followUp, setFollowUp] = useState(true);
  const [followDue, setFollowDue] = useState(() => inDays(3));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const first = contactName?.trim().split(/\s+/)[0] || 'them';
  const followTitle = direction === 'sent'
    ? `Check for a reply from ${first} on ${DM_PLATFORM_LABEL[platform]}`
    : `Reply to ${first} on ${DM_PLATFORM_LABEL[platform]}`;
  const handle = handles[platform];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await apiSend(`/api/crm/contacts/${contactId}/activities`, 'POST', {
        kind: 'dm',
        body,
        dm: { platform, direction },
        follow_up: followUp ? { title: followTitle, due_date: followDue || null } : null,
      });
      setBody('');
      await onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the DM');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit}>
      <div className={s.kindPicker} role="radiogroup" aria-label="Which app?">
        {DM_PLATFORMS.map((pl) => (
          <button key={pl} type="button" role="radio" aria-checked={platform === pl} className={`${p.filterChip} ${platform === pl ? p.filterChipOn : ''}`} onClick={() => setPlatform(pl)}>
            {DM_PLATFORM_LABEL[pl]}
          </button>
        ))}
        {handle && (
          <a className={`${p.btn} ${p.btnSmall}`} href={socialUrl(platform, handle)} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto' }}>
            Open {DM_PLATFORM_LABEL[platform]} ↗
          </a>
        )}
      </div>
      <div className={s.kindPicker} role="radiogroup" aria-label="Sent or received?">
        {DM_DIRECTIONS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={direction === d} className={`${p.filterChip} ${direction === d ? p.filterChipOn : ''}`} onClick={() => { setDirection(d); setFollowDue(inDays(d === 'sent' ? 3 : 1)); }}>
            {DM_DIRECTION_LABEL[d]}
          </button>
        ))}
      </div>

      <div className={s.formGrid}>
        <label className={s.full}>
          <span className={s.miniLabel}>{direction === 'sent' ? 'What you sent (optional)' : 'What they said (optional)'}</span>
          <textarea
            className={p.textarea}
            style={{ minHeight: 70 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Paste the message, or a line to remember it by"
            autoFocus={autoFocus}
          />
        </label>
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

      {!handle && (
        <p className={s.eventMeta} style={{ marginTop: 6 }}>No {DM_PLATFORM_LABEL[platform]} saved for them yet — add it under Details.</p>
      )}
      {direction === 'received' && prospect && (
        <p className={s.eventMeta} style={{ marginTop: 6 }}>Logging a reply moves them off Prospects and onto the pipeline as a New lead.</p>
      )}
      {error && <p className={s.error}>{error}</p>}
      <div className={s.modalActions} style={{ marginTop: 8 }}>
        {onCancel && <button type="button" className={p.btn} onClick={onCancel}>Cancel</button>}
        <button type="submit" className={`${p.btn} ${onCancel ? p.btnPrimary : p.btnSmall}`} disabled={saving}>
          {saving ? 'Saving…' : direction === 'sent' ? 'Log DM sent' : 'Log reply'}
        </button>
      </div>
    </form>
  );
}
