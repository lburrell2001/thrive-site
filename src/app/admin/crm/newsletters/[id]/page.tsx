'use client';

// Write a newsletter, see exactly the email subscribers will get, send a
// test to yourself, then send it to an audience from the CRM.

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../../../proposals/adminApi';
import { Toast, useToast } from '../../../proposals/Toast';
import s2 from './editor.module.css';
import { renderNewsletter } from '@/lib/newsletterEmail';
import { SERVICE_SEO } from '@/lib/serviceSeo';
import type { Audience, Newsletter } from '@/lib/newsletter';
import { newBlock, resolveDesign, type NewsletterBlock, type NewsletterDesign } from '@/lib/newsletterBlocks';
import { BlockEditor } from './BlockEditor';

type Draft = Pick<Newsletter, 'subject' | 'preheader' | 'body' | 'audience' | 'audience_tag'> & {
  blocks: NewsletterBlock[];
  design: NewsletterDesign;
};

const draftOf = (n: Newsletter): Draft => ({
  subject: n.subject, preheader: n.preheader, body: n.body, audience: n.audience, audience_tag: n.audience_tag,
  blocks: n.blocks ?? [], design: resolveDesign(n.design),
});

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: 'subscribers', label: 'Everyone subscribed' },
  { value: 'clients', label: 'Clients (won work or a portal login)' },
  { value: 'leads', label: 'Leads (not clients yet)' },
  { value: 'tag', label: 'Contacts with a tag' },
];

const LINKS = [
  ...Object.values(SERVICE_SEO).map((svc) => ({ label: svc.name, path: svc.path })),
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Journal', path: '/journal' },
  { label: 'Book a call', path: '/book' },
  { label: 'Contact', path: '/contact' },
];

export default function NewsletterEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [n, setN] = useState<Newsletter | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [count, setCount] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLTextAreaElement>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<Newsletter>(`/api/newsletters/${id}`), apiGet<{ address: string | null }>('/api/newsletters/settings')])
      .then(([data, st]) => { if (!cancelled) { setN(data); setDraft(draftOf(data)); setAddress(st.address); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the newsletter'); });
    return () => { cancelled = true; };
  }, [id]);

  // Live count of who the chosen audience reaches.
  const audienceKey = draft ? `${draft.audience}|${draft.audience_tag ?? ''}` : '';
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    const q = new URLSearchParams({ audience: draft.audience, ...(draft.audience_tag ? { tag: draft.audience_tag } : {}) });
    apiGet<{ count: number }>(`/api/newsletters/${id}/audience?${q}`)
      .then((r) => { if (!cancelled) setCount(r.count); })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
    // Refetch only when the audience itself changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey, id]);

  const dirty = useMemo(() => Boolean(n && draft && JSON.stringify(draftOf(n)) !== JSON.stringify(draft)), [n, draft]);
  const locked = n?.status === 'sent' || n?.status === 'sending';

  const save = useCallback(async (quiet = false) => {
    if (!draft) return false;
    try {
      const updated = await apiSend<Newsletter>(`/api/newsletters/${id}`, 'PATCH', draft);
      setN(updated);
      setDraft(draftOf(updated));
      if (!quiet) show('Saved.');
      return true;
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
      return false;
    }
  }, [draft, id, show]);

  const preview = useMemo(() => {
    if (!draft || typeof window === 'undefined') return '';
    return renderNewsletter(draft, {
      site: window.location.origin,
      unsubscribeUrl: '#',
      postalAddress: address ?? '[Your mailing address — add it on the Newsletters page]',
      firstName: 'Maya',
    }).html;
  }, [draft, address]);

  if (error) return <div className={p.screen}><div className={p.wrap}><p className={p.empty}>{error}</p></div></div>;
  if (!n || !draft) return <div className={p.screen}><div className={p.wrap}><p className={p.empty}>Loading…</p></div></div>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

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
      const r = await apiSend<{ to: string }>(`/api/newsletters/${id}/test`, 'POST', {});
      show(`Test sent to ${r.to}.`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not send the test', 'error');
    }
    setBusy('');
  }

  async function send() {
    setBusy('send');
    if (dirty && !(await save(true))) { setBusy(''); return; }
    try {
      const r = await apiSend<{ sent: number }>(`/api/newsletters/${id}/send`, 'POST');
      show(`Sent to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}.`);
      setConfirming(false);
      const fresh = await apiGet<Newsletter>(`/api/newsletters/${id}`);
      setN(fresh); setDraft(draftOf(fresh));
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not send', 'error');
      const fresh = await apiGet<Newsletter>(`/api/newsletters/${id}`).catch(() => null);
      if (fresh) { setN(fresh); setDraft(draftOf(fresh)); }
    }
    setBusy('');
  }

  async function duplicate() {
    try {
      const created = await apiSend<{ id: string }>(`/api/newsletters/${id}`, 'POST');
      router.push(`/admin/crm/newsletters/${created.id}`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not duplicate', 'error');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this newsletter?')) return;
    try {
      await apiSend(`/api/newsletters/${id}`, 'DELETE');
      router.push('/admin/crm/newsletters');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const designed = draft.blocks.length > 0;
  const canSend = !locked && draft.subject.trim() && (draft.body.trim() || designed) && address && (count ?? 0) > 0;

  /** Turn a plain draft into a designed one, keeping what was written. */
  function toDesigned() {
    const blocks: NewsletterBlock[] = [
      { ...newBlock('image'), alt: 'Banner' } as NewsletterBlock,
      ...(draft!.body.trim() ? [{ ...newBlock('text'), text: draft!.body } as NewsletterBlock] : [newBlock('heading'), newBlock('text')]),
      newBlock('button'),
      newBlock('social'),
    ];
    set('blocks', blocks);
  }

  async function saveTemplate() {
    const name = window.prompt('Name this template (e.g. "Monthly update")');
    if (!name?.trim()) return;
    try {
      await apiSend('/api/newsletters/templates', 'POST', { name: name.trim(), blocks: draft!.blocks, design: draft!.design });
      show('Template saved — pick it when you start the next newsletter.');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save the template', 'error');
    }
  }

  return (
    <div className={p.screen}>
      <div className={p.wrap} style={{ maxWidth: draft.blocks.length ? 1320 : 1000 }}>
        <div className={p.pageHead}>
          <div>
            <p className={p.rowMeta} style={{ margin: 0 }}><Link href="/admin/crm/newsletters">← Newsletters</Link></p>
            <h1 className={p.pageTitle}>{draft.subject || 'Untitled newsletter'}</h1>
            <p className={p.pageSub}>
              {n.status === 'sent' ? `Sent ${formatDate(n.sent_at)} to ${n.recipient_count} ${n.recipient_count === 1 ? 'person' : 'people'}. Sent newsletters can't be edited — duplicate it to send a new version.`
                : n.status === 'failed' ? `Sending stopped: ${n.last_error}` : dirty ? 'Unsaved changes' : 'Draft'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {n.status === 'sent' ? (
              <button type="button" className={p.btn} onClick={duplicate}>Duplicate</button>
            ) : (
              <>
                <button type="button" className={p.btn} onClick={() => save()} disabled={!dirty || locked}>Save</button>
                <button type="button" className={p.btn} onClick={sendTest} disabled={busy !== '' || locked}>{busy === 'test' ? 'Sending…' : 'Send me a test'}</button>
                <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setConfirming(true)} disabled={!canSend || busy !== ''}>
                  {n.status === 'failed' ? 'Resume sending' : `Send to ${count ?? '…'}`}
                </button>
              </>
            )}
          </div>
        </div>

        {!address && n.status !== 'sent' && (
          <p className={p.card} style={{ color: '#92400e', background: '#fffbeb', marginBottom: 14 }}>
            Add your mailing address on the <Link href="/admin/crm/newsletters">Newsletters page</Link> before sending — it’s required in every marketing email.
          </p>
        )}

        <div className={p.card} style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <label>
              <span className={p.label}>Subject ({draft.subject.length}/60 recommended)</span>
              <input className={p.input} value={draft.subject} onChange={(e) => set('subject', e.target.value)} disabled={locked} placeholder="What's new at Thrive — October" />
            </label>
            <label>
              <span className={p.label}>Preview text (the grey line after the subject)</span>
              <input className={p.input} value={draft.preheader} onChange={(e) => set('preheader', e.target.value)} disabled={locked} placeholder="A new brand we launched, and one quick website tip" />
            </label>
            <label>
              <span className={p.label}>Send to</span>
              <select className={p.select} value={draft.audience} onChange={(e) => set('audience', e.target.value as Audience)} disabled={locked}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
            {draft.audience === 'tag' && (
              <label>
                <span className={p.label}>Tag</span>
                <input className={p.input} value={draft.audience_tag ?? ''} onChange={(e) => set('audience_tag', e.target.value || null)} disabled={locked} placeholder="e.g. retainer" />
              </label>
            )}
          </div>
          <p className={p.rowMeta} style={{ marginTop: 10 }}>
            {count === null ? 'Counting…' : `${count} subscribed ${count === 1 ? 'person' : 'people'} in this audience.`} Only people who subscribed are ever included.
          </p>
        </div>

        {designed ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <p className={p.rowMeta} style={{ margin: 0, flex: 1 }}>
                Design images in Canva or Adobe Express, export as JPG or PNG (about 1200px wide), and upload them into image blocks. Keep words that matter in text blocks, so they show even when images don’t.
              </p>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={saveTemplate} disabled={!draft.blocks.length}>Save as template</button>
              <span className={s2.previewToggle}>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setTab(tab === 'preview' ? 'write' : 'preview')}>
                  {tab === 'preview' ? 'Edit blocks' : 'Preview'}
                </button>
              </span>
            </div>
            <div className={s2.builder}>
              <div className={`${s2.builderEdit} ${tab === 'preview' ? s2.hideSmall : ''}`}>
                <BlockEditor
                  blocks={draft.blocks}
                  design={draft.design}
                  onBlocks={(b) => set('blocks', b)}
                  onDesign={(d) => set('design', d)}
                  notify={show}
                  disabled={locked}
                />
              </div>
              <div className={`${s2.builderPreview} ${tab === 'write' ? s2.hideSmall : ''}`}>
                <iframe title="Email preview" srcDoc={preview} sandbox="" className={s2.previewFrame} />
                <p className={p.rowMeta} style={{ marginTop: 6 }}>Live preview. The greeting uses the name “Maya”; each person sees their own.</p>
              </div>
            </div>
          </>
        ) : (
          <>
        <div className={p.filters} role="tablist" aria-label="Editor view" style={{ alignItems: 'center' }}>
          {(['write', 'preview'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${p.filterChip} ${tab === t ? p.filterChipOn : ''}`} onClick={() => setTab(t)}>
              {t === 'write' ? 'Write' : 'Email preview'}
            </button>
          ))}
          {!locked && (
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={toDesigned} style={{ marginLeft: 'auto' }}>
              Switch to designed layout
            </button>
          )}
          {tab === 'write' && !locked && (
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n## ', '\n', 'Heading')}>H2</button>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('**', '**', 'bold')}><strong>B</strong></button>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n- ', '', 'List item')}>• List</button>
              <select className={p.select} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }} value="" aria-label="Link to a page" onChange={(e) => { if (e.target.value) insert('[', `](${e.target.value})`, 'link text'); }}>
                <option value="">Link to a page…</option>
                {LINKS.map((l) => <option key={l.path} value={l.path}>{l.label}</option>)}
              </select>
            </span>
          )}
        </div>

        {tab === 'write' ? (
          <textarea
            ref={body}
            className={p.textarea}
            style={{ minHeight: '50vh', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14 }}
            value={draft.body}
            onChange={(e) => set('body', e.target.value)}
            disabled={locked}
            placeholder={'Each subscriber is greeted by first name automatically.\n\n## What we just launched\n\nA short story about a recent project, with a [link to it](/portfolio).\n\n## One quick tip\n\nSomething useful they can do this week.'}
            aria-label="Newsletter body"
          />
        ) : (
          <iframe
            title="Email preview"
            srcDoc={preview}
            sandbox=""
            style={{ width: '100%', height: '70vh', border: '1px solid #e4e1de', borderRadius: 10, background: '#f6f5f4' }}
          />
        )}
        <p className={p.rowMeta} style={{ marginTop: 8 }}>
          Same formatting as the Journal: <code>## Heading</code>, <code>**bold**</code>, <code>- list</code>, <code>[text](/page)</code>, <code>![description](https://image-url)</code>. The preview uses the name “Maya”; each person sees their own.
        </p>

          </>
        )}

        {n.status !== 'sent' && (
          <button type="button" className={`${p.btn} ${p.btnDanger}`} style={{ marginTop: 18 }} onClick={remove}>Delete newsletter</button>
        )}
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="send-confirm" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={p.card} style={{ maxWidth: 440, width: '100%' }}>
            <h2 id="send-confirm" className={p.cardTitle}>Send “{draft.subject}”?</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              It goes to <strong>{count} {count === 1 ? 'person' : 'people'}</strong> right now and can’t be unsent.
              {n.status === 'failed' ? ' People it already reached won’t get it twice.' : ' Sent yourself a test first?'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className={p.btn} onClick={() => setConfirming(false)} disabled={busy === 'send'}>Cancel</button>
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={send} disabled={busy === 'send'}>
                {busy === 'send' ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
