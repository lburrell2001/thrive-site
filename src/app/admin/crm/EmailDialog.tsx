'use client';

// "Email" on a contact: pick a template, make it about this
// person, see exactly what they'll get, and send — now or at a set time.
// Edits here change only this email, never the template. What's written is
// kept as their draft (one per person) when the dialog closes, so it picks
// up where it left off next time.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { REASON, placeholdersIn, renderEmail, type EmailTemplate } from '@/lib/emailContent';
import type { ProspectContact, ProspectDraft, ProspectSendRow } from '@/lib/prospects';
import { CRON_MINUTES, defaultSendTime, formatWhen, scheduleProblem } from '@/lib/scheduleTime';

interface Loaded {
  contact: ProspectContact;
  history: ProspectSendRow[];
  address: string | null;
  draft: ProspectDraft | null;
}

export function EmailDialog({ contactId, onClose, onDone }: {
  contactId: string;
  onClose: () => void;
  /** Sent, scheduled or saved: the dialog is finished; show this message. */
  onDone: (message: string) => void;
}) {
  const [info, setInfo] = useState<Loaded | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [testedTo, setTestedTo] = useState('');
  const [draft, setDraft] = useState<ProspectDraft | null>(null);
  // Edited since it opened (or since the draft was saved).
  const [touched, setTouched] = useState(false);
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState(defaultSendTime);

  const template = templates?.find((t) => t.id === templateId) ?? null;

  function choose(t: EmailTemplate | undefined) {
    if (!t) return;
    setTemplateId(t.id);
    setSubject(t.subject);
    setPreheader(t.preheader);
    setBody(t.body);
    setNote('');
    setError('');
  }

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setTouched(true); };
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<Loaded>(`/api/emails/contacts/${contactId}`), apiGet<EmailTemplate[]>('/api/emails/templates')])
      .then(([loaded, list]) => {
        if (cancelled) return;
        setInfo(loaded);
        setTemplates(list);
        const d = loaded.draft;
        const fromDraft = d && list.find((t) => t.id === d.template_id);
        if (d && fromDraft) {
          // Pick up where they left off.
          setDraft(d);
          setTemplateId(fromDraft.id);
          setSubject(d.subject); setPreheader(d.preheader); setBody(d.body); setNote(d.note);
          return;
        }
        // First email: the first personal intro; after that, a follow-up if there is one.
        const sent = loaded.history.some((h) => h.status === 'sent');
        const pick = (sent && list.find((t) => /follow/i.test(t.name))) || list.find((t) => t.style === 'personal') || list[0];
        choose(pick);
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load'); });
    return () => { cancelled = true; };
  }, [contactId]);

  /** Save it as their draft. `at` schedules it; null keeps it a plain draft. */
  async function saveDraft(at: string | null) {
    if (!template) return null;
    return apiSend<ProspectDraft>('/api/emails/drafts', 'POST', {
      contact_id: contactId, template_id: template.id, subject, preheader, body, note, scheduled_at: at,
    });
  }

  // Closing keeps what was written. A scheduled email stays scheduled.
  async function close() {
    if (busy) return;
    if (!touched || !template) { onClose(); return; }
    setBusy('save'); setError('');
    try {
      const keepTime = draft?.status === 'scheduled' ? draft.scheduled_at : null;
      await saveDraft(keepTime);
      onDone(keepTime ? `Changes saved — still going out ${formatWhen(keepTime)}.` : 'Draft saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the draft');
      setBusy('');
    }
  }

  async function schedule() {
    const at = new Date(when);
    const problem = scheduleProblem(at);
    if (problem) { setError(problem); return; }
    setBusy('schedule'); setError('');
    try {
      const saved = await saveDraft(at.toISOString());
      onDone(`Scheduled for ${formatWhen(saved?.scheduled_at ?? at.toISOString())}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule');
      setBusy('');
    }
  }

  async function discard() {
    if (!draft || !window.confirm(draft.status === 'scheduled' ? 'Cancel this scheduled email and delete the draft?' : 'Delete this draft?')) return;
    setBusy('discard'); setError('');
    try {
      await apiSend(`/api/emails/drafts/${draft.id}`, 'DELETE');
      onDone(draft.status === 'scheduled' ? 'Scheduled email cancelled.' : 'Draft deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the draft');
      setBusy('');
    }
  }

  // close() reads the latest state each render; re-subscribing is cheap.
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const content = template && {
    style: template.style,
    subject,
    preheader,
    body,
    blocks: template.blocks ?? [],
    design: template.design ?? {},
    note,
  };

  const preview = useMemo(() => {
    if (!content || !info || typeof window === 'undefined') return null;
    return renderEmail(content, {
      site: window.location.origin,
      reason: info.contact.subscribed ? REASON.subscriber : REASON.prospect,
      unsubscribeUrl: '#',
      postalAddress: info.address ?? '[Your mailing address]',
      firstName: info.contact.firstName,
      company: info.contact.company,
    });
    // content is rebuilt each render from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, subject, preheader, body, note, info]);

  const left = content ? placeholdersIn(content) : [];
  const blocked = info?.contact.blocked ?? null;
  const canSend = Boolean(template && subject.trim() && info?.address && !blocked && !left.length && (template.style === 'designed' || body.trim()));

  async function send(test: boolean) {
    if (!template) return;
    setBusy(test ? 'test' : 'send'); setError('');
    try {
      const r = await apiSend<{ to: string }>('/api/emails/send', 'POST', {
        contact_id: contactId, template_id: template.id, subject, preheader, body, note, test,
      });
      if (test) { setTestedTo(r.to); setBusy(''); }
      else onDone(`Sent to ${r.to}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
      setBusy('');
    }
  }

  const missing = info && !info.contact.company && /\{\{\s*company\s*\}\}/i.test(`${subject} ${body} ${JSON.stringify(template?.blocks ?? [])}`);

  return (
    <>
      <div className={s.backdrop} style={{ zIndex: 60 }} onClick={() => void close()} />
      <div className={s.modal} style={{ zIndex: 61, width: 'min(1120px, calc(100vw - 32px))' }} role="dialog" aria-modal="true" aria-labelledby="prospect-title">
        <h2 id="prospect-title" className={s.modalTitle}>
          Email {info ? info.contact.name || info.contact.email : ''}
        </h2>
        {!info || !templates ? (
          <p className={s.eventMeta}>{loadError || 'Loading…'}</p>
        ) : templates.length === 0 ? (
          <p className={s.eventMeta}>
            No templates yet. <Link href="/admin/crm/emails?tab=templates">Set some up</Link> — there are starters to begin from.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
              {blocked && <p className={s.error} style={{ margin: 0 }}>{blocked}</p>}
              {draft?.status === 'scheduled' && (
                <p className={s.eventMeta} style={{ margin: 0, color: '#1e3a8a', fontSize: 13 }}>
                  Scheduled for <strong>{formatWhen(draft.scheduled_at)}</strong>. Changes you make are kept when you close; to change the time, use Send later again.
                </p>
              )}
              {draft?.status === 'failed' && (
                <p className={s.error} style={{ margin: 0 }}>The scheduled send didn’t go: {draft.error}. Fix it, then send or schedule it again.</p>
              )}
              {draft?.status === 'draft' && (
                <p className={s.eventMeta} style={{ margin: 0 }}>Your saved draft, last edited {formatDate(draft.updated_at)}.</p>
              )}
              {!info.address && (
                <p className={s.error} style={{ margin: 0 }}>
                  Add your mailing address on the <Link href="/admin/crm/emails">Emails page</Link> first — it’s required in marketing email.
                </p>
              )}
              {info.history.length > 0 && (
                <div className={s.eventMeta} style={{ margin: 0 }}>
                  Already sent:{' '}
                  {info.history.slice(0, 3).map((h) => `“${h.subject}” ${formatDate(h.sent_at)}${h.status === 'failed' ? ' (failed)' : ''}`).join(' · ')}
                </div>
              )}
              <label>
                <span className={s.miniLabel}>Template</span>
                <select className={p.select} value={templateId} onChange={(e) => { choose(templates.find((t) => t.id === e.target.value)); setTouched(true); }} disabled={busy !== ''}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name || 'Untitled'} · {t.style === 'personal' ? 'Personal' : 'Designed'}</option>)}
                </select>
              </label>
              <label>
                <span className={s.miniLabel}>Subject</span>
                <input className={p.input} value={subject} onChange={(e) => edit(setSubject)(e.target.value)} disabled={busy !== ''} />
              </label>
              {template?.style === 'personal' ? (
                <label>
                  <span className={s.miniLabel}>Message — make it about them</span>
                  <textarea className={p.textarea} style={{ minHeight: 280, fontSize: 14, lineHeight: 1.6 }} value={body} onChange={(e) => edit(setBody)(e.target.value)} disabled={busy !== ''} />
                </label>
              ) : (
                <label>
                  <span className={s.miniLabel}>Personal note above the design (optional, recommended)</span>
                  <textarea className={p.textarea} style={{ minHeight: 110, fontSize: 14, lineHeight: 1.6 }} value={note} onChange={(e) => edit(setNote)(e.target.value)} disabled={busy !== ''} placeholder="Loved the new patio at your Deep Ellum location — …" />
                </label>
              )}
              {left.length > 0 && (
                <p className={s.eventMeta} style={{ margin: 0, color: '#b45309' }}>
                  Replace {left.length === 1 ? 'the' : `all ${left.length}`} <code>[[…]]</code> {left.length === 1 ? 'note' : 'notes'} before sending: {left[0]}
                </p>
              )}
              {missing && (
                <p className={s.eventMeta} style={{ margin: 0, color: '#b45309' }}>
                  No company on this contact, so {'{{company}}'} reads “your business”. Add it in Details, or reword.
                </p>
              )}
              <p className={s.eventMeta} style={{ margin: 0 }}>
                Goes to {info.contact.email ?? '—'}. Their reply is logged here and forwarded to your inbox. Includes an unsubscribe link and your mailing address.
                {template && <> <Link href={`/admin/crm/emails/templates/${template.id}`}>Edit the template</Link> to change it for everyone.</>}
              </p>
              {later && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                  <label style={{ flex: '1 1 200px' }}>
                    <span className={s.miniLabel}>Send at (your time)</span>
                    <input type="datetime-local" className={p.input} value={when} step={CRON_MINUTES * 60} onChange={(e) => setWhen(e.target.value)} disabled={busy !== ''} />
                  </label>
                  <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={schedule} disabled={busy !== '' || !canSend}>
                    {busy === 'schedule' ? 'Scheduling…' : 'Schedule'}
                  </button>
                  <span className={s.eventMeta} style={{ margin: 0, flexBasis: '100%' }}>Goes out within {CRON_MINUTES} minutes of this time. If they unsubscribe before then, it won’t send.</span>
                </div>
              )}
              {testedTo && <p className={s.eventMeta} style={{ margin: 0, color: '#1a8a4a' }}>Test sent to {testedTo}.</p>}
              {error && <p className={s.error} style={{ margin: 0 }}>{error}</p>}
            </div>
            <div style={{ minWidth: 0 }}>
              <p className={s.miniLabel} style={{ margin: '0 0 4px' }}>
                {preview ? <>Subject: <strong>{preview.subject}</strong></> : 'Preview'}
              </p>
              <iframe
                title="Email preview"
                srcDoc={preview?.html ?? ''}
                sandbox=""
                style={{ width: '100%', height: 'min(560px, 60vh)', border: '1px solid #e4e1de', borderRadius: 10, background: '#fff' }}
              />
            </div>
          </div>
        )}
        <div className={s.modalActions}>
          {draft && draft.status !== 'sending' && (
            <button type="button" className={`${p.btn} ${p.btnDanger}`} style={{ marginRight: 'auto' }} onClick={discard} disabled={busy !== ''}>
              {draft.status === 'scheduled' ? 'Cancel scheduled email' : 'Delete draft'}
            </button>
          )}
          <button type="button" className={p.btn} onClick={() => void close()} disabled={busy !== ''}>
            {busy === 'save' ? 'Saving…' : touched ? 'Save and close' : 'Close'}
          </button>
          {templates && templates.length > 0 && (
            <>
              <button type="button" className={p.btn} onClick={() => setLater(!later)} disabled={busy !== '' || !template}>
                {later ? 'Not later' : 'Send later…'}
              </button>
              <button type="button" className={p.btn} onClick={() => send(true)} disabled={busy !== '' || !template}>
                {busy === 'test' ? 'Sending…' : 'Send me a test'}
              </button>
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => send(false)} disabled={busy !== '' || !canSend}>
                {busy === 'send' ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
