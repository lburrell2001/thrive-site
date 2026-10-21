'use client';

// Prospects: people Lauren wants to work with who haven't shown interest
// yet. Add them (one, or a pasted list), email them one at a time or as a
// group or DM them on Instagram/Facebook, and when one replies they leave
// this list for the pipeline.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiGet, apiSend } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import { EmailDialog } from '../EmailDialog';
import { LogDmForm } from '../LogDmForm';
import { DM_PLATFORM_LABEL, facebookLabel, facebookUrl, instagramUrl } from '@/lib/social';
import { runContactAction, type ContactAction } from '../contactActions';
import { NewPrintCampaign } from '../campaigns/NewPrintCampaign';
import { PIECE_LABEL } from '../campaigns/shared';
import type { CampaignRow } from '@/lib/marketing';
import { avatarColor, initials, timeAgo } from '../shared';
import type { ProspectRow } from '@/types/crm';

type Filter = 'all' | 'new' | 'contacted';

const reachedOut = (r: ProspectRow) => r.emails_sent + r.dms_sent > 0;
const displayName = (r: ProspectRow) => r.name || r.company || r.email || (r.instagram ? `@${r.instagram}` : r.facebook ? facebookLabel(r.facebook) : 'Unnamed');

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
  const [dming, setDming] = useState<ProspectRow | null>(null);
  const [toPrint, setToPrint] = useState(false);

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
    if (filter === 'new' && reachedOut(r)) return false;
    if (filter === 'contacted' && !reachedOut(r)) return false;
    if (tag && !r.tags.includes(tag)) return false;
    return !query || [r.name, r.company, r.email, r.website, r.instagram, r.facebook, ...r.tags].some((v) => v?.toLowerCase().includes(query.replace(/^@/, '')));
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

  async function bulk(act: ContactAction) {
    const ids = [...picked];
    if (await runContactAction(act, ids, ids.length === 1 ? 'this person' : `${ids.length} people`, notify)) {
      setPicked(new Set());
      refresh();
    }
  }

  const notContacted = (rows ?? []).filter((r) => !reachedOut(r)).length;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Prospects</h1>
          <p className={w.sub}>
            People you’d like to work with. Email them here, or DM them on Instagram or Facebook and log it. When someone replies they move to the pipeline as a New lead — email replies on their own, DMs when you log the reply.
          </p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setAdding(true)}>Add prospects</button>
        </div>
      </div>

      {rows && (
        <div className={w.statRow}>
          <div className={w.stat}><p className={w.statLabel}>On the list</p><p className={w.statValue}>{rows.length}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Not contacted yet</p><p className={w.statValue}>{notContacted}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Contacted, no reply yet</p><p className={w.statValue}>{rows.length - notContacted}</p></div>
        </div>
      )}

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, @handle, tag…" aria-label="Search prospects" />
        <div className={w.chips} role="group" aria-label="Filter">
          {([['all', 'All'], ['new', 'Not contacted'], ['contacted', 'Contacted']] as const).map(([v, label]) => (
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
        <div className={`${w.row} ${w.rowHead}`} style={{ gridTemplateColumns: '24px minmax(0,1.4fr) minmax(0,1fr) 160px 150px' }}>
          <input type="checkbox" className={w.check} checked={allPicked} aria-label="Select all shown"
            onChange={() => setPicked((s) => { const n = new Set(s); visible.forEach((r) => (allPicked ? n.delete(r.id) : n.add(r.id))); return n; })} />
          <span>Person</span>
          <span className={w.hideSmall}>Tags</span>
          <span className={w.hideSmall}>Last reached out</span>
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
          <div key={r.id} className={`${w.row} ${w.rowClick} ${picked.has(r.id) ? w.rowOn : ''}`} style={{ gridTemplateColumns: '24px minmax(0,1.4fr) minmax(0,1fr) 160px 150px' }} onClick={() => openContact(r.id)}>
            <input type="checkbox" className={w.check} checked={picked.has(r.id)} aria-label={`Select ${displayName(r)}`} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
            <span className={w.who}>
              <span className={w.avatar} style={{ background: avatarColor(r.id) }}>{initials(r.name, r.email)}</span>
              <span className={w.whoText}>
                <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{displayName(r)}{r.company && r.company !== displayName(r) ? <span className={w.muted} style={{ fontWeight: 500 }}> · {r.company}</span> : null}</span>
                <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>
                  {[
                    r.email && <span key="e">{r.email}{r.newsletter_status === 'unsubscribed' ? ' (unsubscribed)' : ''}</span>,
                    r.instagram && <a key="i" href={instagramUrl(r.instagram)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>@{r.instagram}</a>,
                    r.facebook && <a key="f" href={facebookUrl(r.facebook)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Facebook</a>,
                  ].filter(Boolean).flatMap((el, i) => (i ? [' · ', el] : [el]))}
                </span>
              </span>
            </span>
            <span className={`${w.chips} ${w.hideSmall}`}>{r.tags.slice(0, 3).map((t) => <span key={t} className={`${w.pill} ${w.pillMuted}`}>{t}</span>)}</span>
            <span className={`${w.hideSmall} ${w.muted}`} title={r.last_subject ?? undefined}>
              <LastReachedOut r={r} />
            </span>
            <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {r.email && <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={r.newsletter_status === 'unsubscribed'} onClick={(e) => { e.stopPropagation(); setEmailing(r.id); }}>✉ Email</button>}
              {(r.instagram || r.facebook) && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={(e) => { e.stopPropagation(); setDming(r); }}>💬 DM</button>}
            </span>
          </div>
        ))}
      </div>

      {picked.size > 0 && (
        <div className={w.selectBar} role="region" aria-label="Selected prospects">
          <span>{picked.size} selected</span>
          <button type="button" className={w.selectPrimary} onClick={() => router.push(`/admin/crm/emails?new=1&contacts=${[...picked].join(',')}`)}>Email them</button>
          <button type="button" onClick={() => setToPrint(true)}>Add to print campaign</button>
          <button type="button" onClick={() => bulk({ action: 'move', to: 'lead' })}>Move to Leads</button>
          <button type="button" onClick={() => removeFromList([...picked])}>Take off list</button>
          <button type="button" onClick={() => bulk({ action: 'delete' })}>Delete</button>
          <button type="button" onClick={() => setPicked(new Set())} aria-label="Clear selection">✕</button>
        </div>
      )}

      {adding && <AddProspects onClose={() => setAdding(false)} onAdded={() => { setAdding(false); refresh(); }} existingTags={tags} />}
      {toPrint && (
        <AddToPrint
          contactIds={[...picked]}
          onClose={() => setToPrint(false)}
          onDone={(campaignId) => { setToPrint(false); setPicked(new Set()); refresh(); router.push(`/admin/crm/campaigns/${campaignId}`); }}
        />
      )}
      {dming && (
        <>
          <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => setDming(null)} />
          <div className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="dm-title">
            <h2 id="dm-title" className={w.dialogTitle}>DM {displayName(dming)}</h2>
            <p className={w.muted} style={{ fontSize: 13, margin: '4px 0 12px' }}>Open their profile, send your message in the app, then log it here.</p>
            <LogDmForm
              contactId={dming.id}
              contactName={dming.name}
              instagram={dming.instagram}
              facebook={dming.facebook}
              prospect
              autoFocus
              onCancel={() => setDming(null)}
              onLogged={() => { setDming(null); notify('DM logged.'); refresh(); }}
            />
          </div>
        </>
      )}
      {emailing && (
        <EmailDialog contactId={emailing} onClose={() => setEmailing(null)} onDone={(message) => { setEmailing(null); notify(message); refresh(); }} />
      )}
    </div>
  );
}

/** The latest email or logged DM, whichever came last. */
function LastReachedOut({ r }: { r: ProspectRow }) {
  if (!reachedOut(r)) return <span className={`${w.pill} ${w.pillProspect}`}>Not yet</span>;
  const dmLast = r.last_dm_at && (!r.last_emailed_at || r.last_dm_at > r.last_emailed_at);
  const at = dmLast ? r.last_dm_at : r.last_emailed_at;
  const via = dmLast && r.last_dm_platform ? DM_PLATFORM_LABEL[r.last_dm_platform] : 'Email';
  const total = r.emails_sent + r.dms_sent;
  return <>{timeAgo(at)} · {via}{total > 1 ? ` · ${total}×` : ''}</>;
}

interface Person { name: string; email: string; company?: string; website?: string; instagram?: string; facebook?: string }

const EMAIL = /[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}/i;
const IG = /instagram\.com\/|^@[\w.]+$/i;
const FB = /(?:facebook|fb)\.com\//i;

/**
 * Rows pasted from a spreadsheet or typed one per line. The email, an
 * @handle or Instagram link, and a Facebook link are found wherever they
 * are; the rest are name, company and website in that order (anything that
 * looks like a domain is the website). A row needs at least one way to
 * reach them.
 */
function parsePeople(text: string): { people: Person[]; skipped: number } {
  const people: Person[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const email = EMAIL.exec(line)?.[0];
    let instagram: string | undefined;
    let facebook: string | undefined;
    let website: string | undefined;
    const rest: string[] = [];
    for (const raw of line.split(/\t|,|;/)) {
      const c = raw.trim().replace(/^"|"$/g, '');
      if (!c || (email && c.includes(email))) continue;
      if (IG.test(c)) { instagram ??= c; continue; }
      if (FB.test(c)) { facebook ??= c; continue; }
      if (!website && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(c)) { website = c; continue; }
      if (!c.includes('@')) rest.push(c);
    }
    if (!email && !instagram && !facebook) { skipped += 1; continue; }
    people.push({ email: email?.toLowerCase() ?? '', name: rest[0] ?? '', company: rest[1], website, instagram, facebook });
  }
  return { people, skipped };
}

function AddProspects({ onClose, onAdded, existingTags }: { onClose: () => void; onAdded: () => void; existingTags: string[] }) {
  const { notify } = useCrm();
  const [mode, setMode] = useState<'one' | 'paste'>('one');
  const [one, setOne] = useState<Person>({ name: '', email: '', company: '', website: '', instagram: '', facebook: '' });
  const [paste, setPaste] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ added: number; existing: { who: string; name: string; why: string }[] } | null>(null);

  const parsed = useMemo(() => parsePeople(paste), [paste]);
  const people = mode === 'one' ? (one.email.trim() || one.instagram?.trim() || one.facebook?.trim() ? [one] : []) : parsed.people;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await apiSend<{ added: number; existing: { who: string; name: string; why: string }[] }>('/api/prospects', 'POST', {
        people: people.map((x) => ({
          name: x.name,
          email: x.email.trim() || undefined,
          company: x.company || undefined,
          website: x.website || undefined,
          instagram: x.instagram?.trim() || undefined,
          facebook: x.facebook?.trim() || undefined,
        })),
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
              {result.existing.map((x) => <li key={x.who}><strong>{x.name}</strong> — {x.why}</li>)}
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
                <label><span className={p.label}>Company</span><input className={p.input} value={one.company} onChange={(e) => setOne({ ...one, company: e.target.value })} placeholder="Bloom Bakery" /></label>
                <label><span className={p.label}>Email</span><input className={p.input} type="email" value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} placeholder="maya@bloombakery.com" /></label>
                <label><span className={p.label}>Website</span><input className={p.input} value={one.website} onChange={(e) => setOne({ ...one, website: e.target.value })} placeholder="bloombakery.com" /></label>
                <label><span className={p.label}>Instagram</span><input className={p.input} value={one.instagram} onChange={(e) => setOne({ ...one, instagram: e.target.value })} placeholder="@bloombakery" /></label>
                <label><span className={p.label}>Facebook</span><input className={p.input} value={one.facebook} onChange={(e) => setOne({ ...one, facebook: e.target.value })} placeholder="facebook.com/bloombakery" /></label>
                <p className={w.muted} style={{ gridColumn: '1 / -1', fontSize: 12.5, margin: 0 }}>An email, Instagram or Facebook — whichever you’ll reach them on.</p>
              </div>
            ) : (
              <>
                <textarea className={p.textarea} style={{ minHeight: 170, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }} value={paste} onChange={(e) => setPaste(e.target.value)}
                  placeholder={'Paste rows from a spreadsheet, or one per line:\nMaya Lin, maya@bloombakery.com, Bloom Bakery, bloombakery.com\nSam Ortiz\tsam@ortizroofing.com\tOrtiz Roofing\nJo Park, Glow Studio, @glowstudiodallas\nAna Ruiz, Ruiz Tacos, facebook.com/ruiztacos'} autoFocus />
                <p className={w.muted} style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  {paste.trim() ? `${parsed.people.length} ${parsed.people.length === 1 ? 'person' : 'people'} found${parsed.skipped ? ` · ${parsed.skipped} line${parsed.skipped === 1 ? '' : 's'} without an email, @handle or Facebook link skipped` : ''}.` : 'Each row needs an email, an @handle, or an Instagram or Facebook link; name, company and website are picked up around it.'}
                </p>
              </>
            )}
            <label style={{ display: 'block', marginTop: 12 }}>
              <span className={p.label}>Tags (optional, comma separated)</span>
              <input className={p.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={existingTags.slice(0, 2).join(', ') || 'restaurants, dallas'} />
            </label>
            <p className={w.muted} style={{ fontSize: 12, lineHeight: 1.5, margin: '10px 0 0' }}>
              Add people at businesses you’ve a real reason to contact. Every email includes an unsubscribe link, and anyone who uses it is never emailed again. People added with only a handle are skipped by email sends.
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

/** Put the selected prospects on a print campaign: an existing one, or a new one. */
function AddToPrint({ contactIds, onClose, onDone }: { contactIds: string[]; onClose: () => void; onDone: (campaignId: string) => void }) {
  const { notify } = useCrm();
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<CampaignRow[]>('/api/campaigns')
      .then((r) => { if (!cancelled) { const print = r.filter((c) => c.kind === 'print'); setCampaigns(print); if (!print.length) setCreating(true); } })
      .catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, []);

  async function add(id: string) {
    setBusy(true);
    try {
      const r = await apiSend<{ added: number }>(`/api/campaigns/${id}/recipients`, 'POST', { contact_ids: contactIds });
      notify(`${r.added} added.`);
      onDone(id);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not add', 'error');
      setBusy(false);
    }
  }

  if (creating) return <NewPrintCampaign contactIds={contactIds} notify={notify} onClose={onClose} onCreated={onDone} />;

  return (
    <>
      <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => !busy && onClose()} />
      <div className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="to-print-title">
        <h2 id="to-print-title" className={w.dialogTitle}>Add {contactIds.length} to a print campaign</h2>
        <div className={w.table} style={{ margin: '14px 0', maxHeight: 320, overflowY: 'auto' }}>
          {campaigns === null && <p className={w.empty}>Loading…</p>}
          {campaigns?.map((c) => (
            <button key={c.id} type="button" className={w.item} disabled={busy} onClick={() => add(c.id)}>
              <span className={w.itemMain}>
                <span className={w.itemTitle}>{c.name}</span>
                <span className={w.itemSub}>{PIECE_LABEL[c.piece]} · {c.stats.reached} on it{c.sent_on ? ` · ${c.sent_on}` : ''}</span>
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button type="button" className={p.btn} onClick={() => setCreating(true)}>New print campaign</button>
          <button type="button" className={p.btn} onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </>
  );
}
