'use client';

// "Ask for a review" on a won deal. Opens on the same server preview as
// reminders, so text is only offered when the client can receive one.

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiSend } from '../proposals/adminApi';
import type { ReminderPreview } from '@/lib/reminders';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';

/** Best guess at the service from the deal's name, e.g. "Brand refresh" → brand design. */
function guessService(title: string): ServiceSlug | '' {
  const t = title.toLowerCase();
  if (/brand|logo|identity/.test(t)) return 'brand-design';
  if (/web|site|landing|digital/.test(t)) return 'digital-design';
  if (/ux|app|product|prototype/.test(t)) return 'ux-design';
  if (/social|instagram|content/.test(t)) return 'social-media';
  if (/photo|headshot|shoot/.test(t)) return 'photography';
  return '';
}

export function ReviewRequestDialog({ contactId, deal, onClose, onSent }: {
  contactId: string;
  deal: { id: string; title: string };
  onClose: () => void;
  onSent: () => void;
}) {
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [service, setService] = useState<ServiceSlug | ''>(guessService(deal.title));
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiSend<ReminderPreview>('/api/admin', 'POST', { action: 'reminder_preview', target: { kind: 'crm_contact', id: contactId } })
      .then((pv) => {
        if (cancelled) return;
        setPreview(pv);
        setEmail(Boolean(pv.email));
        setSms(pv.smsAvailable);
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load contact'); });
    return () => { cancelled = true; };
  }, [contactId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setError('');
    try {
      await apiSend('/api/reviews/request', 'POST', {
        contact_id: contactId,
        deal_id: deal.id,
        service_slug: service || null,
        channels: { email, sms },
        note: note.trim() || undefined,
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
      setSending(false);
    }
  }

  return (
    <>
      <div className={s.backdrop} style={{ zIndex: 60 }} onClick={() => !sending && onClose()} />
      <form className={s.modal} style={{ zIndex: 61 }} role="dialog" aria-modal="true" aria-labelledby="review-request-title" onSubmit={send}>
        <h2 id="review-request-title" className={s.modalTitle}>Ask for a review</h2>
        {!preview ? (
          <p className={s.eventMeta}>{loadError || 'Loading…'}</p>
        ) : (
          <>
            <p className={s.eventMeta} style={{ marginTop: 0 }}>
              {preview.recipient} gets a private link to rate the work, write a few words, and say whether you may share it.
            </p>
            <div className={s.formGrid} style={{ marginTop: 12 }}>
              <label className={s.full}>
                <span className={s.miniLabel}>Which service is it about?</span>
                <select className={p.select} value={service} onChange={(e) => setService(e.target.value as ServiceSlug | '')}>
                  <option value="">Not specific</option>
                  {Object.values(SERVICE_SEO).map((svc) => <option key={svc.slug} value={svc.slug}>{svc.name}</option>)}
                </select>
              </label>
              <label className={s.full}>
                <span className={s.miniLabel}>Personal note (optional)</span>
                <textarea className={p.textarea} style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Loved working on this with you…" />
              </label>
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 13 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={email} disabled={!preview.email} onChange={(e) => setEmail(e.target.checked)} />
                Email {preview.email ? `to ${preview.email}` : '— no email on file'}
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={sms} disabled={!preview.smsAvailable} onChange={(e) => setSms(e.target.checked)} />
                Text {preview.smsAvailable ? 'too' : `— ${preview.smsBlockedReason ?? 'not available'}`}
              </label>
            </div>
          </>
        )}
        {error && <p className={s.error}>{error}</p>}
        <div className={s.modalActions}>
          <button type="button" className={p.btn} onClick={onClose} disabled={sending}>Cancel</button>
          <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={sending || !preview || (!email && !sms)}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </>
  );
}
