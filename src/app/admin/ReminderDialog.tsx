'use client';

// The reminder dialog, shared by the client admin page (invoices, uploaded
// proposals, onboarding, custom messages) and the proposal builder list.
//
// It opens on a preview from the server — who the reminder goes to and which
// channels are actually possible — so admin never picks "Text" for a client
// who has no number or has not agreed to texts.

import { useCallback, useEffect, useState } from 'react';
import type { ReminderPreview, ReminderResult, ReminderTarget } from '@/lib/reminders';
import { formatPhone } from '@/lib/phone';

const FONT = `var(--font-inter), 'Inter', sans-serif`;
const PINK = '#e40586';
const DARK = '#0a0a0a';

const input: React.CSSProperties = {
  border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '9px 12px', fontFamily: FONT,
  fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff', color: DARK,
};
const label: React.CSSProperties = {
  fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#808080', textTransform: 'uppercase',
  letterSpacing: '0.06em', display: 'block', marginBottom: 5,
};

function button(variant: 'primary' | 'ghost', disabled?: boolean): React.CSSProperties {
  return {
    fontFamily: FONT, fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '9px 18px',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    ...(variant === 'primary'
      ? { background: PINK, color: '#fff', border: 'none' }
      : { background: '#fff', color: DARK, border: '1.5px solid #e5e5e5' }),
  };
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusLine({ channel, status, to, error }: { channel: string; status: string; to: string | null; error: string | null }) {
  const color = status === 'sent' ? '#1a8a4a' : status === 'failed' ? PINK : '#808080';
  const text =
    status === 'sent' ? `sent${to ? ` to ${channel === 'Text' ? formatPhone(to) : to}` : ''}`
    : status === 'failed' ? `failed — ${error ?? 'unknown error'}`
    : error ? `not sent — ${error}` : 'not sent';
  return (
    <div style={{ fontFamily: FONT, fontSize: 13, color }}>
      <strong>{channel}:</strong> {text}
    </div>
  );
}

export interface ReminderDialogProps {
  title: string;
  /** A free-form message: asks for a subject, and the note becomes the body. */
  custom?: boolean;
  loadPreview: () => Promise<ReminderPreview>;
  send: (input: { channels: { email: boolean; sms: boolean }; note?: string; subject?: string }) => Promise<ReminderResult>;
  /** Only proposal recipients can have their number edited from here. */
  saveContact?: (proposalClientId: string, phone: string, smsOptIn: boolean) => Promise<void>;
  onClose: () => void;
  onSent?: () => void;
}

export function ReminderDialog({ title, custom, loadPreview, send, saveContact, onClose, onSent }: ReminderDialogProps) {
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReminderResult | null>(null);

  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // Bumped to re-fetch the preview after a number is saved.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await loadPreview();
        if (cancelled) return;
        setLoadError('');
        setPreview(p);
        setEmail(Boolean(p.email));
        setSms(p.smsAvailable);
        setPhone(p.phone ? formatPhone(p.phone) : '');
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load reminder');
      }
    })();
    return () => { cancelled = true; };
  }, [loadPreview, reloadKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  async function handleSend() {
    setSending(true); setError('');
    try {
      const r = await send({ channels: { email, sms }, note: note.trim() || undefined, subject: custom ? subject.trim() : undefined });
      setResult(r);
      if (r.email.status === 'sent' || r.sms.status === 'sent') onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    }
    setSending(false);
  }

  async function handleSaveContact() {
    if (!preview?.proposalClientId || !saveContact) return;
    setSavingContact(true); setError('');
    try {
      await saveContact(preview.proposalClientId, phone, consent);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save number');
    }
    setSavingContact(false);
  }

  // A proposal recipient without a usable number can get one right here.
  const canEditContact =
    Boolean(saveContact && preview?.proposalClientId) &&
    !preview?.smsAvailable &&
    preview?.smsBlockedReason !== 'Text messages are not set up yet';

  const canSend = !sending && (email || sms) && (!custom || (subject.trim() && note.trim()));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ height: 3, background: PINK, borderRadius: '12px 12px 0 0' }} />
        <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: DARK }}>{title}</div>
            {preview && (
              <div style={{ fontFamily: FONT, fontSize: 13, color: '#808080', marginTop: 2 }}>
                {preview.summary} · to {preview.recipient || 'client'}
              </div>
            )}
          </div>

          {loadError && <div style={{ fontFamily: FONT, fontSize: 13, color: PINK }}>{loadError}</div>}
          {!preview && !loadError && <div style={{ fontFamily: FONT, fontSize: 13, color: '#bfbfbf' }}>Loading…</div>}

          {preview && result && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f9f9f9', borderRadius: 8, padding: '12px 14px' }}>
                <StatusLine channel="Email" {...result.email} />
                <StatusLine channel="Text" {...result.sms} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" style={button('primary')} onClick={onClose}>Done</button>
              </div>
            </>
          )}

          {preview && !result && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={label}>Send by</span>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: FONT, fontSize: 14, color: preview.email ? DARK : '#bfbfbf' }}>
                  <input type="checkbox" checked={email} disabled={!preview.email} onChange={(e) => setEmail(e.target.checked)} />
                  Email {preview.email ? <span style={{ color: '#808080' }}>· {preview.email}</span> : '· no email on file'}
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: FONT, fontSize: 14, color: preview.smsAvailable ? DARK : '#bfbfbf' }}>
                  <input type="checkbox" checked={sms} disabled={!preview.smsAvailable} onChange={(e) => setSms(e.target.checked)} />
                  Text {preview.smsAvailable
                    ? <span style={{ color: '#808080' }}>· {formatPhone(preview.phone)}</span>
                    : `· ${preview.smsBlockedReason?.toLowerCase()}`}
                </label>
              </div>

              {canEditContact && (
                <div style={{ border: '1px dashed #e5e5e5', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={label}>Mobile number</span>
                  <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" />
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontFamily: FONT, fontSize: 13, color: DARK }}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                    They agreed to receive text messages from Thrive Creative Studios
                  </label>
                  <div>
                    <button type="button" style={button('ghost', savingContact || !phone.trim())} disabled={savingContact || !phone.trim()} onClick={handleSaveContact}>
                      {savingContact ? 'Saving…' : 'Save number'}
                    </button>
                  </div>
                </div>
              )}

              {custom && (
                <div>
                  <span style={label}>Subject</span>
                  <input style={input} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="Quick question about your project" />
                </div>
              )}

              <div>
                <span style={label}>{custom ? 'Message' : 'Personal note (optional)'}</span>
                <textarea
                  style={{ ...input, minHeight: 84, resize: 'vertical' }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={600}
                  placeholder={custom ? 'Write your message…' : 'Just checking in — let me know if you have any questions!'}
                />
                {sms && (
                  <div style={{ fontFamily: FONT, fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
                    The note is included in the text, so keep it short.
                  </div>
                )}
              </div>

              {preview.history.length > 0 && (
                <div>
                  <span style={label}>Past reminders</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {preview.history.map((h) => (
                      <div key={h.id} style={{ fontFamily: FONT, fontSize: 12, color: '#808080' }}>
                        {when(h.created_at)} ·{' '}
                        {[
                          h.email_status !== 'skipped' && `email ${h.email_status}`,
                          h.sms_status !== 'skipped' && `text ${h.sms_status}`,
                        ].filter(Boolean).join(', ') || 'nothing sent'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ fontFamily: FONT, fontSize: 13, color: PINK }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" style={button('ghost', sending)} disabled={sending} onClick={onClose}>Cancel</button>
                <button type="button" style={button('primary', !canSend)} disabled={!canSend} onClick={handleSend}>
                  {sending ? 'Sending…' : custom ? 'Send message' : 'Send reminder'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type AdminApi = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

/**
 * For the client admin page: open a reminder for any portal target through
 * the /api/admin passcode route. Render `dialog` once; call `remind` from
 * any button.
 */
export function usePortalReminder(api: AdminApi, onSent?: () => void) {
  const [open, setOpen] = useState<{ target: ReminderTarget; title: string } | null>(null);

  const remind = useCallback((target: ReminderTarget, title: string) => setOpen({ target, title }), []);

  const loadPreview = useCallback(async () => {
    const r = await api({ action: 'reminder_preview', target: open?.target });
    if (r.error) throw new Error(String(r.error));
    return r.data as ReminderPreview;
  }, [api, open]);

  const dialog = open ? (
    <ReminderDialog
      key={JSON.stringify(open.target)}
      title={open.title}
      custom={open.target.kind === 'custom'}
      loadPreview={loadPreview}
      send={async ({ channels, note, subject }) => {
        const target = open.target.kind === 'custom' ? { ...open.target, subject } : open.target;
        const r = await api({ action: 'send_reminder', target, channels, note });
        if (r.error) throw new Error(String(r.error));
        return r.data as ReminderResult;
      }}
      onClose={() => setOpen(null)}
      onSent={onSent}
    />
  ) : null;

  return { remind, dialog };
}

/** "Reminded 3d ago", from the reminder log for one target. */
export function lastRemindedLabel(
  reminders: { target_type: string; target_id: string | null; created_at: string }[] | undefined,
  kind: string,
  id: string | null,
): string | null {
  const hit = reminders?.find((r) => r.target_type === kind && (id === null || r.target_id === id));
  if (!hit) return null;
  const days = Math.floor((Date.now() - new Date(hit.created_at).getTime()) / 86_400_000);
  return days <= 0 ? 'Reminded today' : days === 1 ? 'Reminded yesterday' : `Reminded ${days}d ago`;
}
