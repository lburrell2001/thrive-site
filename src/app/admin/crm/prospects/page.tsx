'use client';

// Prospects: people Lauren wants to work with who haven't shown interest
// yet. Add them (one, or a pasted list), email them one at a time or as a
// group, and when one replies they leave this list for the pipeline.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiGet, apiSend } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import { EmailDialog } from '../EmailDialog';
import { avatarColor, initials, timeAgo } from '../shared';
import type { ProspectRow } from '@/types/crm';

type Filter = 'all' | 'new' | 'emailed';

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));


export default function ProspectsPage() {
  const router = useRouter();
  const { openContact, version, refresh, notify } = useCrm();
  const [rows, setRows] = useState<ProspectRow[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // ⌘K / Today "Add prospects" arrive with ?add=1.
  const [adding, setAdding] = useState(() => urlParam('add') === '1');
  const [emailing, setEmailing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<ProspectRow[]>('/api/prospects')
      .then((r) => { if (!cancelled) { setRows(r); setPicked((s) => new Set([...s].filter((id) => r.some((x) => x.id === id)))); } })
      .catch((e) => { if (!cancelled) { notify(e instanceof Error ? e.message : 'Could not load prospects', 'error'); setRows([]); } });
    return () => { cancelled = true; };
  }, [version, notify]);

  const tags = useMemo(() => [...new Set((rows ?? []).flatMap((r) => r.tags))].sort(), [rows]);
  const query = q.trim().toLowerCase();
  const visible = useMemo(() => (rows ?? []).filter((r) => {
    if (filter === 'new' && r.emails_sent > 0) return false;
    if (filter === 'emailed' && r.emails_sent === 0) return false;
    if (tag && !r.tags.includes(tag)) return false;
    return !query || [r.name, r.company, r.email, r.website, ...r.tags].some((v) => v?.toLowerCase().includes(query));
  }), [rows, filter, tag, query]);

  const allPicked = visible.length > 0 && visible.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function removeFromList(ids: string[]) {
    if (!window.confirm(`Take ${ids.length} ${ids.length === 1 ? 'person' : 'people'} off Prospects? They stay in Contacts.`)) return;
    try {
      for (const id of ids) await apiSend(`/api/crm/contacts/${id}`, 'PATCH', { prospect_status: null });
      notify('Taken off Prospects.');
      setPicked(new Set());
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  const neverEmailed = (rows ?? []).filter((r) => r.emails_sent === 0).length;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Prospects</h1>
          <p className={w.sub}>
            People you’d like to work with. Email them here; when someone replies they move to the pipeline as a New lead, and their reply lands in your inbox.
          </p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setAdding(true)}>Add prospects</button>
        </div>
      </div>

      {rows && (
        <div className={w.statRow}>
          <div className={w.stat}><p className={w.statLabel}>On the list</p><p className={w.statValue}>{rows.length}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Not emailed yet</p><p className={w.statValue}>{neverEmailed}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Emailed, no reply yet</p><p className={w.statValue}>{rows.length - neverEmailed}</p></div>
        </div>
      )}

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, tag…" aria-label="Search prospects" />
        <div className={w.chips} role="group" aria-label="Filter">
          {([['all', 'All'], ['new', 'Not emailed'], ['emailed', 'Emailed']] as const).map(([v, label]) => (
            <button key={v} type="button" className={`${w.chip} ${filter === v ? w.chipOn : ''}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>{label}</button>
          ))}
        </div>
        {tags.length > 0 && (
          <select className={p.select} style={{ width: 'auto' }} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      <div className={w.table}>
        <div className={`${w.row} ${w.rowHead}`} style={{ gridTemplateColumns: '24px minmax(0,1.4fr) minmax(0,1fr) 150px 110px' }}>
          <input type="checkbox" className={w.check} checked={allPicked} aria-label="Select all shown"
            onChange={() => setPicked((s) => { const n = new Set(s); visible.forEach((r) => (allPicked ? n.delete(r.id) : n.add(r.id))); return n; })} />
          <span>Person</span>
          <span className={w.hideSmall}>Tags</span>
          <span className={w.hideSmall}>Last emailed</span>
          <span />
        </div>
        {rows === null && <p className={w.empty}>Loading…</p>}
        {rows?.length === 0 && (
          <div className={w.empty}>
            No prospects yet. Add people you’d love to work with — businesses whose brand or website you know you could improve.
          </div>
        )}
        {rows && rows.length > 0 && visible.length === 0 && <p className={w.empty}>No matches.</p>}
        {visible.map((r) => (
          <div key={r.id} className={`${w.row} ${w.rowClick} ${picked.has(r.id) ? w.rowOn : ''}`} style={{ gridTemplateColumns: '24px minmax(0,1.4fr) minmax(0,1fr) 150px 110px' }} onClick={() => openContact(r.id)}>
            <input type="checkbox" className={w.check} checked={picked.has(r.id)} aria-label={`Select ${r.name || r.email}`} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
            <span className={w.who}>
              <span className={w.avatar} style={{ background: avatarColor(r.id) }}>{initials(r.name, r.email)}</span>
              <span className={w.whoText}>
                <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{r.name || r.email}{r.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {r.company}</span> : null}</span>
                <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>
                  {r.email}{r.newsletter_status === 'unsubscribed' ? ' · unsubscribed' : ''}
                </span>
              </span>
            </span>
            <span className={`${w.chips} ${w.hideSmall}`}>{r.tags.slice(0, 3).map((t) => <span key={t} className={`${w.pill} ${w.pillMuted}`}>{t}</span>)}</span>
            <span className={`${w.hideSmall} ${w.muted}`} title={r.last_subject ?? undefined}>
              {r.emails_sent ? <>{timeAgo(r.last_emailed_at)}{r.emails_sent > 1 ? ` · ${r.emails_sent}×` : ''}</> : <span className={`${w.pill} ${w.pillProspect}`}>Not yet</span>}
            </span>
            <span style={{ textAlign: 'right' }}>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={r.newsletter_status === 'unsubscribed'} onClick={(e) => { e.stopPropagation(); setEmailing(r.id); }}>✉ Email</button>
            </span>
          </div>
        ))}
      </div>

      {picked.size > 0 && (
        <div className={w.selectBar} role="region" aria-label="Selected prospects">
          <span>{picked.size} selected</span>
          <button type="button" className={w.selectPrimary} onClick={() => router.push(`/admin/crm/emails?new=1&contacts=${[...picked].join(',')}`)}>Email them</button>
          <button type="button" onClick={() => removeFromList([...picked])}>Take off list</button>
          <button type="button" onClick={() => setPicked(new Set())} aria-label="Clear selection">✕</button>
        </div>
      )}

      {adding && <AddProspects onClose={() => setAdding(false)} onAdded={() => { setAdding(false); refresh(); }} existingTags={tags} />}
      {emailing && (
        <EmailDialog contactId={emailing} onClose={() => setEmailing(null)} onSent={(to) => { setEmailing(null); notify(`Sent to ${to}.`); refresh(); }} />
      )}
    </div>
  );
}

interface Person { name: string; email: string; company?: string; website?: string }

const EMAIL = /[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}/i;

/**
 * Rows pasted from a spreadsheet or typed one per line: the email is found
 * wherever it is; the rest are name, company and website in that order
 * (anything that looks like a domain is the website).
 */
function parsePeople(text: string): { people: Person[]; skipped: number } {
  const people: Person[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const email = EMAIL.exec(line)?.[0];
    if (!email) { skipped += 1; continue; }
    const cells = line.split(/\t|,|;/).map((c) => c.trim().replace(/^"|"$/g, '')).filter((c) => c && !c.includes('@'));
    const website = cells.find((c) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(c) && !/\s/.test(c));
    const rest = cells.filter((c) => c !== website);
    people.push({ email: email.toLowerCase(), name: rest[0] ?? '', company: rest[1], website });
  }
  return { people, skipped };
}

function AddProspects({ onClose, onAdded, existingTags }: { onClose: () => void; onAdded: () => void; existingTags: string[] }) {
  const { notify } = useCrm();
  const [mode, setMode] = useState<'one' | 'paste'>('one');
  const [one, setOne] = useState<Person>({ name: '', email: '', company: '', website: '' });
  const [paste, setPaste] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ added: number; existing: { email: string; name: string; why: string }[] } | null>(null);

  const parsed = useMemo(() => parsePeople(paste), [paste]);
  const people = mode === 'one' ? (one.email.trim() ? [one] : []) : parsed.people;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await apiSend<{ added: number; existing: { email: string; name: string; why: string }[] }>('/api/prospects', 'POST', {
        people: people.map((x) => ({ name: x.name, email: x.email.trim(), company: x.company || undefined, website: x.website || undefined })),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      if (r.existing.length) { setResult(r); setBusy(false); notify(`${r.added} added.`); }
      else { notify(`${r.added} ${r.added === 1 ? 'prospect' : 'prospects'} added.`); onAdded(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add');
      setBusy(false);
    }
  }

  return (
    <>
      <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => !busy && (result ? onAdded() : onClose())} />
      <form className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="add-prospects-title" onSubmit={submit}>
        <h2 id="add-prospects-title" className={w.dialogTitle}>Add prospects</h2>
        {result ? (
          <>
            <p style={{ fontSize: 14 }}>{result.added} added. {result.existing.length} already in the CRM:</p>
            <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, maxHeight: 240, overflowY: 'auto' }}>
              {result.existing.map((x) => <li key={x.email}><strong>{x.name}</strong> — {x.why}</li>)}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={onAdded}>Done</button></div>
          </>
        ) : (
          <>
            <div className={w.tabs} role="tablist" style={{ marginTop: 12 }}>
              <button type="button" role="tab" aria-selected={mode === 'one'} className={`${w.tab} ${mode === 'one' ? w.tabOn : ''}`} onClick={() => setMode('one')}>One person</button>
              <button type="button" role="tab" aria-selected={mode === 'paste'} className={`${w.tab} ${mode === 'paste' ? w.tabOn : ''}`} onClick={() => setMode('paste')}>Paste a list</button>
            </div>
            {mode === 'one' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label><span className={p.label}>Name</span><input className={p.input} value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} placeholder="Maya Lin" autoFocus /></label>
                <label><span className={p.label}>Email</span><input className={p.input} type="email" required value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} placeholder="maya@bloombakery.com" /></label>
                <label><span className={p.label}>Company</span><input className={p.input} value={one.company} onChange={(e) => setOne({ ...one, company: e.target.value })} placeholder="Bloom Bakery" /></label>
                <label><span className={p.label}>Website</span><input className={p.input} value={one.website} onChange={(e) => setOne({ ...one, website: e.target.value })} placeholder="bloombakery.com" /></label>
              </div>
            ) : (
              <>
                <textarea className={p.textarea} style={{ minHeight: 170, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }} value={paste} onChange={(e) => setPaste(e.target.value)}
                  placeholder={'Paste rows from a spreadsheet, or one per line:\nMaya Lin, maya@bloombakery.com, Bloom Bakery, bloombakery.com\nSam Ortiz\tsam@ortizroofing.com\tOrtiz Roofing'} autoFocus />
                <p className={w.muted} style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  {paste.trim() ? `${parsed.people.length} ${parsed.people.length === 1 ? 'person' : 'people'} found${parsed.skipped ? ` · ${parsed.skipped} line${parsed.skipped === 1 ? '' : 's'} without an email skipped` : ''}.` : 'Each row needs an email; name, company and website are picked up around it.'}
                </p>
              </>
            )}
            <label style={{ display: 'block', marginTop: 12 }}>
              <span className={p.label}>Tags (optional, comma separated)</span>
              <input className={p.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={existingTags.slice(0, 2).join(', ') || 'restaurants, dallas'} />
            </label>
            <p className={w.muted} style={{ fontSize: 12, lineHeight: 1.5, margin: '10px 0 0' }}>
              Add people at businesses you’ve a real reason to contact. Every email includes an unsubscribe link, and anyone who uses it is never emailed again.
            </p>
            {error && <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className={p.btn} onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={busy || people.length === 0}>
                {busy ? 'Adding…' : people.length > 1 ? `Add ${people.length}` : 'Add'}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  );
}
