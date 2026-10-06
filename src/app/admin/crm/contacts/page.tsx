'use client';

// Everyone in the CRM — clients, leads, prospects and everyone else — in
// one searchable list. Click a row to open them; tick rows to move them
// between Leads and Prospects, or delete them.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { formatMoneyCents } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import { runContactAction, type ContactAction } from '../contactActions';
import { LIFECYCLE_LABEL, avatarColor, initials, lifecycleOf, timeAgo, type Lifecycle } from '../shared';

const FILTERS: { value: Lifecycle | 'all'; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'client', label: 'Clients' },
  { value: 'lead', label: 'Leads' },
  { value: 'prospect', label: 'Prospects' },
  { value: 'contact', label: 'Other' },
];

const COLUMNS = '24px minmax(0,1.6fr) 100px minmax(0,1fr) 110px 100px';

const PILL: Record<Lifecycle, string> = { client: w.pillClient, lead: w.pillLead, prospect: w.pillProspect, contact: w.pillContact };

export default function ContactsPage() {
  const { contacts, openContact, notify, refresh } = useCrm();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Lifecycle | 'all'>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const withStage = useMemo(() => (contacts ?? []).map((c) => ({ ...c, stage: lifecycleOf(c) })), [contacts]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: withStage.length };
    for (const c of withStage) m[c.stage] = (m[c.stage] ?? 0) + 1;
    return m;
  }, [withStage]);

  const query = q.trim().toLowerCase();
  const visible = withStage.filter((c) =>
    (filter === 'all' || c.stage === filter)
    && (!query || [c.name, c.company, c.email, c.phone, c.source, c.website, ...c.tags].some((v) => v?.toLowerCase().includes(query))),
  );

  // Only what's on screen can be acted on, so a hidden tick never surprises.
  const pickedShown = visible.filter((c) => picked.has(c.id));
  const allPicked = visible.length > 0 && pickedShown.length === visible.length;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulk(act: ContactAction) {
    const ids = pickedShown.map((c) => c.id);
    const who = ids.length === 1 ? (pickedShown[0].name || pickedShown[0].email || 'this contact') : `${ids.length} people`;
    setBusy(true);
    if (await runContactAction(act, ids, who, notify)) {
      setPicked(new Set());
      refresh();
    }
    setBusy(false);
  }

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Contacts</h1>
          <p className={w.sub}>Everyone you’ve dealt with or reached out to. One record per person, however they arrived.</p>
        </div>
        <div className={w.headActions}>
          <Link href="/admin/crm/prospects?add=1" className={p.btn}>Add prospects</Link>
          <Link href="/admin/crm/pipeline?new=1" className={`${p.btn} ${p.btnPrimary}`}>New deal</Link>
        </div>
      </div>

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, tag…" aria-label="Search contacts" />
        <div className={w.chips} role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" className={`${w.chip} ${filter === f.value ? w.chipOn : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} <span style={{ opacity: 0.6 }}>{counts[f.value] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={w.table}>
        <div className={`${w.row} ${w.rowHead}`} style={{ gridTemplateColumns: COLUMNS }}>
          <input type="checkbox" className={w.check} checked={allPicked} aria-label="Select all shown"
            onChange={() => setPicked((s) => { const n = new Set(s); visible.forEach((c) => (allPicked ? n.delete(c.id) : n.add(c.id))); return n; })} />
          <span>Person</span><span>Status</span><span className={w.hideSmall}>Deals</span><span className={w.hideSmall}>Newsletter</span><span className={w.hideSmall}>Last touch</span>
        </div>
        {contacts === null && <p className={w.empty}>Loading…</p>}
        {contacts && visible.length === 0 && <p className={w.empty}>{query || filter !== 'all' ? 'No matches.' : 'No contacts yet.'}</p>}
        {visible.map((c) => (
          <div key={c.id} role="button" tabIndex={0} className={`${w.row} ${w.rowClick} ${picked.has(c.id) ? w.rowOn : ''}`} style={{ gridTemplateColumns: COLUMNS }}
            onClick={() => openContact(c.id)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openContact(c.id); }}>
            <input type="checkbox" className={w.check} checked={picked.has(c.id)} aria-label={`Select ${c.name || c.email || 'contact'}`} onClick={(e) => e.stopPropagation()} onChange={() => toggle(c.id)} />
            <span className={w.who}>
              <span className={w.avatar} style={{ background: avatarColor(c.id) }}>{initials(c.name, c.email)}</span>
              <span className={w.whoText}>
                <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{c.name || c.email || 'Unnamed'}{c.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {c.company}</span> : null}</span>
                <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>{c.email || 'No email'}</span>
              </span>
            </span>
            <span><span className={`${w.pill} ${PILL[c.stage]}`}><span className={w.pillDot} />{LIFECYCLE_LABEL[c.stage]}</span></span>
            <span className={`${w.muted} ${w.hideSmall}`}>
              {c.open_deals ? `${c.open_deals} open` : c.deals ? `${c.deals} deal${c.deals === 1 ? '' : 's'}` : '—'}
              {c.won_value_cents ? ` · ${formatMoneyCents(c.won_value_cents)} won` : ''}
            </span>
            <span className={`${w.muted} ${w.hideSmall}`}>
              {c.newsletter_status === 'subscribed' ? 'Subscribed' : c.newsletter_status === 'pending' ? 'Unconfirmed' : c.newsletter_status === 'unsubscribed' ? 'Unsubscribed' : '—'}
            </span>
            <span className={`${w.muted} ${w.hideSmall}`}>{timeAgo(c.last_touch_at)}</span>
          </div>
        ))}
      </div>

      {pickedShown.length > 0 && (
        <div className={w.selectBar} role="region" aria-label="Selected contacts">
          <span>{pickedShown.length} selected</span>
          <button type="button" onClick={() => bulk({ action: 'move', to: 'lead' })} disabled={busy}>Move to Leads</button>
          <button type="button" onClick={() => bulk({ action: 'move', to: 'prospect' })} disabled={busy}>Move to Prospects</button>
          <button type="button" onClick={() => bulk({ action: 'delete' })} disabled={busy}>Delete</button>
          <button type="button" onClick={() => setPicked(new Set())} aria-label="Clear selection">✕</button>
        </div>
      )}
    </div>
  );
}
