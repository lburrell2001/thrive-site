'use client';

// Write an email, choose who gets it, see exactly what they'll receive,
// send a test to yourself, then send. Subscribers, prospects or a
// hand-picked group: the same email either way, with the footer line and
// reply handling suited to who it's going to.

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../../proposals/proposals.module.css';
import w from '../../workspace.module.css';
import s2 from './editor.module.css';
import { apiGet, apiSend, formatDate } from '../../../proposals/adminApi';
import { useCrm } from '../../CrmContext';
import { MERGE_FIELDS, OUTREACH, REASON, renderEmail, type Audience, type EmailStyle } from '@/lib/emailContent';
import { SERVICE_SEO } from '@/lib/serviceSeo';
import type { Newsletter } from '@/lib/newsletter';
import { normalizeBlocks, resolveDesign, starterBlocks, type NewsletterBlock, type NewsletterDesign } from '@/lib/newsletterBlocks';
import { EmailDesigner } from '../../../email-designer/EmailDesigner';
import { ImportPanel } from './ImportPanel';

type Draft = Pick<Newsletter, 'subject' | 'preheader' | 'body' | 'audience' | 'audience_tag' | 'audience_contact_ids'> & {
  style: EmailStyle | null;
  blocks: NewsletterBlock[];
  design: NewsletterDesign;
};

const draftOf = (n: Newsletter): Draft => ({
  style: n.style ?? (n.blocks?.length ? 'designed' : null),
  subject: n.subject, preheader: n.preheader, body: n.body,
  audience: n.audience, audience_tag: n.audience_tag, audience_contact_ids: n.audience_contact_ids ?? [],
  blocks: normalizeBlocks(n.blocks), design: resolveDesign(n.design),
});

const AUDIENCES: { group: string; options: { value: Audience; label: string }[] }[] = [
  { group: 'Subscribers', options: [
    { value: 'subscribers', label: 'Everyone subscribed' },
    { value: 'clients', label: 'Subscribed clients' },
    { value: 'leads', label: 'Subscribed leads (not clients yet)' },
    { value: 'tag', label: 'Subscribers with a tag' },
  ] },
  { group: 'Outreach', options: [
    { value: 'prospects', label: 'All prospects' },
    { value: 'prospect_tag', label: 'Prospects with a tag' },
    { value: 'contacts', label: 'Hand-picked people' },
  ] },
];

const LINKS = [
  ...Object.values(SERVICE_SEO).map((svc) => ({ label: svc.name, path: svc.path })),
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Journal', path: '/journal' },
  { label: 'Book a call', path: '/book' },
  { label: 'Contact', path: '/contact' },
];

interface Reach { count: number; sample: { id: string; name: string; company: string | null }[] }

export default function EmailEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { notify: show, openContact, contacts, refresh } = useCrm();
  const [n, setN] = useState<Newsletter | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [reach, setReach] = useState<Reach | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<Newsletter>(`/api/newsletters/${id}`), apiGet<{ address: string | null }>('/api/newsletters/settings')])
      .then(([data, st]) => { if (!cancelled) { setN(data); setDraft(draftOf(data)); setAddress(st.address); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the email'); });
    return () => { cancelled = true; };
  }, [id]);

  // Live count (and a few names) of who the chosen audience reaches.
  const audienceKey = draft ? `${draft.audience}|${draft.audience_tag ?? ''}|${draft.audience_contact_ids.join(',')}` : '';
  useEffect(() => {
    if (!audienceKey) return;
    let cancelled = false;
    const [audience, tag, ids] = audienceKey.split('|');
    const q = new URLSearchParams({ audience, ...(tag ? { tag } : {}), ...(ids ? { ids } : {}) });
    apiGet<Reach>(`/api/newsletters/${id}/audience?${q}`)
      .then((r) => { if (!cancelled) setReach(r); })
      .catch(() => { if (!cancelled) setReach(null); });
    return () => { cancelled = true; };
  }, [audienceKey, id]);

  const dirty = useMemo(() => Boolean(n && draft && JSON.stringify(draftOf(n)) !== JSON.stringify(draft)), [n, draft]);
  const locked = n?.status === 'sent' || n?.status === 'sending';
  const outreach = draft ? OUTREACH.includes(draft.audience) : false;
  const reason = outreach ? REASON.prospect : REASON.subscriber;

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
    return renderEmail({ ...draft, html: n?.html ?? null }, {
      site: window.location.origin,
      unsubscribeUrl: '#',
      postalAddress: address ?? '[Your mailing address — add it in Emails → Settings]',
      firstName: 'Maya',
      company: 'Bloom Bakery',
      reason,
    }).html;
  }, [draft, address, n?.html, reason]);

  if (error) return <div className={w.page}><p className={w.empty}>{error}</p></div>;
  if (!n || !draft) return <div className={w.page}><p className={w.empty}>Loading…</p></div>;

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
      refresh();
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
      router.push(`/admin/crm/emails/${created.id}`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not duplicate', 'error');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this email?')) return;
    try {
      await apiSend(`/api/newsletters/${id}`, 'DELETE');
      router.push('/admin/crm/emails');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  async function saveTemplate() {
    const name = window.prompt('Name this template (e.g. "Monthly update" or "Intro — restaurants")');
    if (!name?.trim()) return;
    try {
      await apiSend('/api/emails/templates', 'POST', {
        name: name.trim(), style: draft!.style ?? 'personal', subject: draft!.subject, preheader: draft!.preheader,
        body: draft!.body, blocks: draft!.blocks, design: draft!.design,
      });
      show('Template saved — it’s in Emails → Templates and on every contact’s Email button.');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save the template', 'error');
    }
  }

  function switchStyle(next: EmailStyle) {
    if (next === 'designed' && !draft!.blocks.length) set('blocks', starterBlocks());
    set('style', next);
  }

  const designed = draft.style === 'designed';
  const imported = Boolean(n.html);
  const count = reach?.count ?? null;
  const canSend = !locked && draft.subject.trim() && (draft.body.trim() || designed || imported) && address && (count ?? 0) > 0;
  const picked = (contacts ?? []).filter((c) => draft.audience_contact_ids.includes(c.id));

  return (
    <div className={`${w.page} ${w.pageWide}`} style={{ maxWidth: 1560 }}>
      <div className={w.head}>
        <div style={{ minWidth: 0 }}>
          <p className={w.eyebrow}><Link href="/admin/crm/emails" style={{ color: 'inherit' }}>← Emails</Link></p>
          <h1 className={w.title} style={{ fontSize: 24 }}>{draft.subject || 'Untitled email'}</h1>
          <p className={w.sub}>
            {n.status === 'sent' ? `Sent ${formatDate(n.sent_at)} to ${n.recipient_count} ${n.recipient_count === 1 ? 'person' : 'people'}. Sent emails can’t be edited — duplicate it to send a new version.`
              : n.status === 'failed' ? `Sending stopped: ${n.last_error}` : dirty ? 'Unsaved changes' : 'Draft · saved'}
          </p>
        </div>
        <div className={w.headActions}>
          {n.status === 'sent' ? (
            <button type="button" className={p.btn} onClick={duplicate}>Duplicate</button>
          ) : (
            <>
              <button type="button" className={p.btn} onClick={saveTemplate}>Save as template</button>
              <button type="button" className={p.btn} onClick={() => save()} disabled={!dirty || locked}>Save</button>
              <button type="button" className={p.btn} onClick={sendTest} disabled={busy !== '' || locked}>{busy === 'test' ? 'Sending…' : 'Send me a test'}</button>
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setConfirming(true)} disabled={!canSend || busy !== ''}>
                {n.status === 'failed' ? 'Resume sending' : `Send to ${count ?? '…'}`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className={w.grid2} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: 16 }}>
        <section className={w.card}>
          <div className={w.cardHead}><h2 className={w.cardTitle}>Message</h2></div>
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <label>
              <span className={p.label}>Subject ({draft.subject.length}/50 recommended)</span>
              <input className={p.input} value={draft.subject} onChange={(e) => set('subject', e.target.value)} disabled={locked} placeholder={outreach ? 'Quick idea for {{company}}' : 'What’s new at Thrive — October'} />
            </label>
            <label>
              <span className={p.label}>Preview text (the grey line after the subject)</span>
              <input className={p.input} value={draft.preheader} onChange={(e) => set('preheader', e.target.value)} disabled={locked} placeholder={designed ? 'A new brand we launched, and one quick tip' : 'Optional — the first line shows if blank'} />
            </label>
            {!imported && !locked && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={p.label} style={{ margin: 0 }}>Style</span>
                <div className={w.tabs} style={{ margin: 0 }}>
                  {(['personal', 'designed'] as const).map((st) => (
                    <button key={st} type="button" className={`${w.tab} ${draft.style === st || (!draft.style && st === 'personal') ? w.tabOn : ''}`} onClick={() => switchStyle(st)}>
                      {st === 'personal' ? 'Personal note' : 'Designed'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={w.card}>
          <div className={w.cardHead}>
            <h2 className={w.cardTitle}>Who gets it</h2>
            <span className={`${w.pill} ${outreach ? w.pillProspect : w.pillBlue}`}>{outreach ? 'Outreach' : 'Newsletter'}</span>
            <span className={w.cardCount} style={{ marginLeft: 'auto' }}>{count === null ? '…' : `${count} ${count === 1 ? 'person' : 'people'}`}</span>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            <select className={p.select} value={draft.audience} onChange={(e) => set('audience', e.target.value as Audience)} disabled={locked} aria-label="Audience">
              {AUDIENCES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((a) => <option key={a.value} value={a.value} disabled={a.value === 'contacts' && !draft.audience_contact_ids.length}>{a.label}</option>)}
                </optgroup>
              ))}
            </select>
            {(draft.audience === 'tag' || draft.audience === 'prospect_tag') && (
              <input className={p.input} value={draft.audience_tag ?? ''} onChange={(e) => set('audience_tag', e.target.value || null)} disabled={locked} placeholder="Tag, e.g. restaurants" aria-label="Tag" />
            )}
            {draft.audience === 'contacts' && (
              <div className={w.chips}>
                {picked.map((c) => (
                  <span key={c.id} className={w.chip} style={{ cursor: 'default' }}>
                    <button type="button" onClick={() => openContact(c.id)} style={{ all: 'unset', cursor: 'pointer' }}>{c.name || c.email}</button>
                    {!locked && <button type="button" aria-label={`Remove ${c.name || c.email}`} onClick={() => set('audience_contact_ids', draft.audience_contact_ids.filter((x) => x !== c.id))} style={{ all: 'unset', cursor: 'pointer', marginLeft: 6, color: '#a19d97' }}>×</button>}
                  </span>
                ))}
              </div>
            )}
            {reach && reach.sample.length > 0 && draft.audience !== 'contacts' && (
              <p className={w.muted} style={{ margin: 0, fontSize: 12.5 }}>
                {reach.sample.map((x) => x.name).join(', ')}{reach.count > reach.sample.length ? ` and ${reach.count - reach.sample.length} more` : ''}
              </p>
            )}
            <p className={w.muted} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
              {outreach
                ? 'Nobody who unsubscribed is ever included. Each person’s replies are logged on them and forwarded to you; a prospect who replies becomes a New lead.'
                : 'Only people who subscribed are included.'}
            </p>
          </div>
        </section>
      </div>

      {!address && n.status !== 'sent' && (
        <p className={p.card} style={{ color: '#92400e', background: '#fffbeb', marginBottom: 14 }}>
          Add your mailing address in <Link href="/admin/crm/emails?tab=settings">Emails → Settings</Link> before sending — it’s required in every marketing email.
        </p>
      )}

      <ImportPanel newsletter={n} onChange={(updated) => { setN(updated); }} notify={show} locked={locked} />

      {imported || (designed && locked) ? (
        <iframe title="Email preview" srcDoc={preview} sandbox="" style={{ width: '100%', height: '80vh', border: '1px solid #e4e1de', borderRadius: 14, background: '#fff' }} />
      ) : designed ? (
        <EmailDesigner
          blocks={draft.blocks}
          design={draft.design}
          onBlocks={(b) => set('blocks', b)}
          onDesign={(dz) => set('design', dz)}
          notify={show}
          subject={draft.subject}
          preheader={draft.preheader}
          postalAddress={address ?? '[Your mailing address — add it in Emails → Settings]'}
          reason={reason}
        />
      ) : (
        <>
          {!locked && (
            <div className={w.toolbar}>
              {MERGE_FIELDS.map((f) => (
                <button key={f.token} type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert(f.token)}>+ {f.label}</button>
              ))}
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('**', '**', 'bold')}><strong>B</strong></button>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => insert('\n- ', '', 'List item')}>• List</button>
              <select className={p.select} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }} value="" aria-label="Link to a page" onChange={(e) => { if (e.target.value) insert('[', `](${e.target.value})`, 'link text'); }}>
                <option value="">Link to a page…</option>
                {LINKS.map((l) => <option key={l.path} value={l.path}>{l.label}</option>)}
              </select>
              <span className={s2.previewToggle}>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setTab(tab === 'preview' ? 'write' : 'preview')}>{tab === 'preview' ? 'Edit' : 'Preview'}</button>
              </span>
            </div>
          )}
          <div className={s2.builder}>
            <div className={`${s2.builderEdit} ${tab === 'preview' ? s2.hideSmall : ''}`}>
              <textarea
                ref={body}
                className={p.textarea}
                style={{ minHeight: '55vh', fontSize: 15, lineHeight: 1.6 }}
                value={draft.body}
                onChange={(e) => set('body', e.target.value)}
                disabled={locked}
                aria-label="Message"
              />
              <p className={w.muted} style={{ marginTop: 8, fontSize: 12.5 }}>
                {draft.style === 'personal'
                  ? 'Your signature (name, Thrive, website and a small logo) is added below automatically. '
                  : ''}
                <code>{'{{first_name}}'}</code> and <code>{'{{company}}'}</code> fill in for each person.
              </p>
            </div>
            <div className={`${s2.builderPreview} ${tab === 'write' ? s2.hideSmall : ''}`}>
              <iframe title="Email preview" srcDoc={preview} sandbox="" className={s2.previewFrame} style={{ background: '#fff' }} />
              <p className={w.muted} style={{ marginTop: 6, fontSize: 12.5 }}>Preview addressed to Maya at Bloom Bakery; each person sees their own.</p>
            </div>
          </div>
        </>
      )}

      {n.status !== 'sent' && (
        <button type="button" className={`${p.btn} ${p.btnDanger}`} style={{ marginTop: 18 }} onClick={remove}>Delete email</button>
      )}

      {confirming && (
        <>
          <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => busy !== 'send' && setConfirming(false)} />
          <div className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="send-confirm">
            <h2 id="send-confirm" className={w.dialogTitle}>Send “{draft.subject}”?</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              It goes to <strong>{count} {count === 1 ? 'person' : 'people'}</strong> right now and can’t be unsent.
              {n.status === 'failed' ? ' People it already reached won’t get it twice.' : ' Sent yourself a test first?'}
              {outreach && (count ?? 0) > 50 && ' Cold email to a big list can hurt how your email lands — smaller batches of people you’ve chosen do better.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className={p.btn} onClick={() => setConfirming(false)} disabled={busy === 'send'}>Cancel</button>
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={send} disabled={busy === 'send'}>
                {busy === 'send' ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
