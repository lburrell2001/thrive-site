'use client';

// Edit an email template. Personal templates are a message in the
// journal's markdown; designed ones use the newsletter block builder. The
// preview is addressed to a sample person.

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../../../proposals/proposals.module.css';
import w from '../../../workspace.module.css';
import { apiGet, apiSend } from '../../../../proposals/adminApi';
import { useCrm } from '../../../CrmContext';
import s2 from '../../[id]/editor.module.css';
import { EmailDesigner } from '../../../../email-designer/EmailDesigner';
import { normalizeBlocks, resolveDesign, type NewsletterBlock, type NewsletterDesign } from '@/lib/newsletterBlocks';
import { MERGE_FIELDS, REASON, SAMPLE_CONTACT, renderEmail, type EmailTemplate } from '@/lib/emailContent';
import { SERVICE_SEO } from '@/lib/serviceSeo';

type Draft = Pick<EmailTemplate, 'name' | 'subject' | 'preheader' | 'body'> & {
  blocks: NewsletterBlock[];
  design: NewsletterDesign;
};

const draftOf = (t: EmailTemplate): Draft => ({
  name: t.name, subject: t.subject, preheader: t.preheader, body: t.body,
  blocks: normalizeBlocks(t.blocks), design: resolveDesign(t.design),
});

const LINKS = [
  ...Object.values(SERVICE_SEO).map((svc) => ({ label: svc.name, path: svc.path })),
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Book a call', path: '/book' },
  { label: 'Contact', path: '/contact' },
];

export default function EmailTemplateEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [t, setT] = useState<EmailTemplate | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const body = useRef<HTMLTextAreaElement>(null);
  const { notify: show } = useCrm();

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<EmailTemplate>(`/api/emails/templates/${id}`), apiGet<{ address: string | null }>('/api/newsletters/settings')])
      .then(([data, st]) => { if (!cancelled) { setT(data); setDraft(draftOf(data)); setAddress(st.address); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the template'); });
    return () => { cancelled = true; };
  }, [id]);

  const dirty = useMemo(() => Boolean(t && draft && JSON.stringify(draftOf(t)) !== JSON.stringify(draft)), [t, draft]);

  const save = useCallback(async (quiet = false) => {
    if (!draft) return false;
    try {
      const updated = await apiSend<EmailTemplate>(`/api/emails/templates/${id}`, 'PATCH', draft);
      setT(updated);
      setDraft(draftOf(updated));
      if (!quiet) show('Saved.');
      return true;
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
      return false;
    }
  }, [draft, id, show]);

  const preview = useMemo(() => {
    if (!t || !draft || typeof window === 'undefined') return '';
    return renderEmail({ style: t.style, ...draft }, {
      reason: REASON.prospect,
      site: window.location.origin,
      unsubscribeUrl: '#',
      postalAddress: address ?? '[Your mailing address — add it on the Newsletters page]',
      ...SAMPLE_CONTACT,
    }).html;
  }, [t, draft, address]);

  if (error) return <div className={w.page}><p className={w.empty}>{error}</p></div>;
  if (!t || !draft) return <div className={w.page}><p className={w.empty}>Loading…</p></div>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const designed = t.style === 'designed';

  function insert(before: string, after = '', placeholder = '') {
    const el = body.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const chosen = value.slice(a, b) || placeholder;
    set('body', value.slice(0, a) + before + chosen + after + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + chosen.length); });
  }

  async function sendTest() {
    setBusy('test');
    if (dirty && !(await save(true))) { setBusy(''); return; }
    try {
      const r = await apiSend<{ to: string }>('/api/emails/send', 'POST', {
        template_id: id, subject: draft!.subject || '(no subject)', preheader: draft!.preheader, body: draft!.body, test: true,
      });
      show(`Test sent to ${r.to}.`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not send the test', 'error');
    }
    setBusy('');
  }

  async function duplicate() {
    try {
      if (dirty && !(await save(true))) return;
      const created = await apiSend<{ id: string }>(`/api/emails/templates/${id}`, 'POST');
      router.push(`/admin/crm/emails/templates/${created.id}`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not duplicate', 'error');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this template? Emails already sent from it stay on each contact’s timeline.')) return;
    try {
      await apiSend(`/api/emails/templates/${id}`, 'DELETE');
      router.push('/admin/crm/emails?tab=templates');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const frame = <iframe title="Email preview" srcDoc={preview} sandbox="" className={s2.previewFrame} style={{ background: '#fff' }} />;

  return (
    <div className={`${w.page} ${w.pageWide}`} style={{ maxWidth: designed ? 1560 : 1320 }}>
      <div>
        <div className={p.pageHead}>
          <div>
            <p className={p.rowMeta} style={{ margin: 0 }}><Link href="/admin/crm/emails?tab=templates">← Templates</Link></p>
            <h1 className={p.pageTitle}>{draft.name || 'Untitled template'}</h1>
            <p className={p.pageSub}>{designed ? 'Designed' : 'Personal'} template · {dirty ? 'Unsaved changes' : 'Saved'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={p.btn} onClick={duplicate}>Duplicate</button>
            <button type="button" className={p.btn} onClick={sendTest} disabled={busy !== ''}>{busy === 'test' ? 'Sending…' : 'Send me a test'}</button>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => save()} disabled={!dirty}>Save</button>
          </div>
        </div>

        <div className={p.card} style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <label>
              <span className={p.label}>Template name (only you see this)</span>
              <input className={p.input} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Intro — restaurants" />
            </label>
            <label>
              <span className={p.label}>Subject ({draft.subject.length}/50 recommended)</span>
              <input className={p.input} value={draft.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Quick idea for {{company}}" />
            </label>
            <label>
              <span className={p.label}>Preview text (optional)</span>
              <input className={p.input} value={draft.preheader} onChange={(e) => set('preheader', e.target.value)} placeholder={designed ? 'Recent work, and a 15-minute call if it helps' : 'Leave blank — the first line shows instead'} />
            </label>
          </div>
          <p className={p.rowMeta} style={{ marginTop: 10 }}>
            {MERGE_FIELDS.map((f) => <code key={f.token} style={{ marginRight: 8 }}>{f.token}</code>)}
            fill in from the contact (blank ones become “{MERGE_FIELDS[0].fallback}” and “{MERGE_FIELDS[1].fallback}”). <code>{'[[…]]'}</code> marks a line to write for each person — you can’t send until it’s replaced.
            {designed && ' Type them straight into the design; the send dialog shows each person’s version.'}
          </p>
        </div>

        {!designed && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {MERGE_FIELDS.map((f) => (
                <button key={f.token} type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert(f.token)}>+ {f.label}</button>
              ))}
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('[[', ']]', 'Write something specific to them')}>+ Personal line</button>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('**', '**', 'bold')}><strong>B</strong></button>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n- ', '', 'List item')}>• List</button>
              <select className={p.select} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }} value="" aria-label="Link to a page" onChange={(e) => { if (e.target.value) insert('[', `](${e.target.value})`, 'link text'); }}>
                <option value="">Link to a page…</option>
                {LINKS.map((l) => <option key={l.path} value={l.path}>{l.label}</option>)}
              </select>
            </span>
          <span className={s2.previewToggle}>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setTab(tab === 'preview' ? 'write' : 'preview')}>
              {tab === 'preview' ? 'Edit' : 'Preview'}
            </button>
          </span>
        </div>
        )}

        {designed ? (
          <EmailDesigner
            blocks={draft.blocks}
            design={draft.design}
            onBlocks={(b) => set('blocks', b)}
            onDesign={(dz) => set('design', dz)}
            notify={show}
            subject={draft.subject}
            preheader={draft.preheader}
            postalAddress={address ?? '[Your mailing address — add it on the Newsletters page]'}
            firstName={SAMPLE_CONTACT.firstName}
            reason={REASON.prospect}
          />
        ) : (
        <div className={s2.builder}>
          <div className={`${s2.builderEdit} ${tab === 'preview' ? s2.hideSmall : ''}`}>
            <textarea
              ref={body}
              className={p.textarea}
              style={{ minHeight: '55vh', fontSize: 15, lineHeight: 1.6 }}
              value={draft.body}
              onChange={(e) => set('body', e.target.value)}
              aria-label="Message"
            />
            <p className={p.rowMeta} style={{ marginTop: 8 }}>
              Keep it short — four or five sentences, one ask. Your signature (name, Thrive, website and a small logo) is added below “Thanks,” automatically.
            </p>
          </div>
          <div className={`${s2.builderPreview} ${tab === 'write' ? s2.hideSmall : ''}`}>
            {frame}
            <p className={p.rowMeta} style={{ marginTop: 6 }}>Preview addressed to {SAMPLE_CONTACT.firstName} at {SAMPLE_CONTACT.company}.</p>
          </div>
        </div>
        )}

        <button type="button" className={`${p.btn} ${p.btnDanger}`} style={{ marginTop: 18 }} onClick={remove}>Delete template</button>
      </div>
    </div>
  );
}
