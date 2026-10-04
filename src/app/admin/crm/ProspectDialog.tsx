'use client';

// "Prospect email" on a contact: pick a template, make it about this
// person, see exactly what they'll get, and send. Edits here change only
// this email, never the template.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { placeholdersIn, renderProspect, type ProspectTemplate } from '@/lib/prospectEmail';
import type { ProspectContact, ProspectSendRow } from '@/lib/prospects';

interface Loaded {
  contact: ProspectContact;
  history: ProspectSendRow[];
  address: string | null;
}

export function ProspectDialog({ contactId, onClose, onSent }: {
  contactId: string;
  onClose: () => void;
  onSent: (to: string) => void;
}) {
  const [info, setInfo] = useState<Loaded | null>(null);
  const [templates, setTemplates] = useState<ProspectTemplate[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [testedTo, setTestedTo] = useState('');

  const template = templates?.find((t) => t.id === templateId) ?? null;

  function choose(t: ProspectTemplate | undefined) {
    if (!t) return;
    setTemplateId(t.id);
    setSubject(t.subject);
    setPreheader(t.preheader);
    setBody(t.body);
    setNote('');
    setError('');
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<Loaded>(`/api/prospects/contacts/${contactId}`), apiGet<ProspectTemplate[]>('/api/prospects/templates')])
      .then(([loaded, list]) => {
        if (cancelled) return;
        setInfo(loaded);
        setTemplates(list);
        // First email: the first personal intro; after that, a follow-up if there is one.
        const sent = loaded.history.some((h) => h.status === 'sent');
        const pick = (sent && list.find((t) => /follow/i.test(t.name))) || list.find((t) => t.style === 'personal') || list[0];
        choose(pick);
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load'); });
    return () => { cancelled = true; };
  }, [contactId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

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
    return renderProspect(content, {
      site: window.location.origin,
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
      const r = await apiSend<{ to: string }>('/api/prospects/send', 'POST', {
        contact_id: contactId, template_id: template.id, subject, preheader, body, note, test,
      });
      if (test) { setTestedTo(r.to); setBusy(''); }
      else onSent(r.to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
      setBusy('');
    }
  }

  const missing = info && !info.contact.company && /\{\{\s*company\s*\}\}/i.test(`${subject} ${body} ${JSON.stringify(template?.blocks ?? [])}`);

  return (
    <>
      <div className={s.backdrop} style={{ zIndex: 60 }} onClick={() => !busy && onClose()} />
      <div className={s.modal} style={{ zIndex: 61, width: 'min(1120px, calc(100vw - 32px))' }} role="dialog" aria-modal="true" aria-labelledby="prospect-title">
        <h2 id="prospect-title" className={s.modalTitle}>
          Prospect email{info ? ` to ${info.contact.name || info.contact.email}` : ''}
        </h2>
        {!info || !templates ? (
          <p className={s.eventMeta}>{loadError || 'Loading…'}</p>
        ) : templates.length === 0 ? (
          <p className={s.eventMeta}>
            No templates yet. <Link href="/admin/crm/prospecting">Set some up</Link> — there are starters to begin from.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
              {blocked && <p className={s.error} style={{ margin: 0 }}>{blocked}</p>}
              {!info.address && (
                <p className={s.error} style={{ margin: 0 }}>
                  Add your mailing address on the <Link href="/admin/crm/newsletters">Newsletters page</Link> first — it’s required in marketing email.
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
                <select className={p.select} value={templateId} onChange={(e) => choose(templates.find((t) => t.id === e.target.value))} disabled={busy !== ''}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name || 'Untitled'} · {t.style === 'personal' ? 'Personal' : 'Designed'}</option>)}
                </select>
              </label>
              <label>
                <span className={s.miniLabel}>Subject</span>
                <input className={p.input} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy !== ''} />
              </label>
              {template?.style === 'personal' ? (
                <label>
                  <span className={s.miniLabel}>Message — make it about them</span>
                  <textarea className={p.textarea} style={{ minHeight: 280, fontSize: 14, lineHeight: 1.6 }} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy !== ''} />
                </label>
              ) : (
                <label>
                  <span className={s.miniLabel}>Personal note above the design (optional, recommended)</span>
                  <textarea className={p.textarea} style={{ minHeight: 110, fontSize: 14, lineHeight: 1.6 }} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy !== ''} placeholder="Loved the new patio at your Deep Ellum location — …" />
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
                Goes to {info.contact.email ?? '—'}; replies come to your inbox. Includes an unsubscribe link and your mailing address.
                {template && <> <Link href={`/admin/crm/prospecting/${template.id}`}>Edit the template</Link> to change it for everyone.</>}
              </p>
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
          <button type="button" className={p.btn} onClick={onClose} disabled={busy === 'send'}>Cancel</button>
          {templates && templates.length > 0 && (
            <>
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
