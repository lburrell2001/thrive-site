'use client';

// Who's been on the site: everyone browsing in the last 30 days, grouped by
// the id their browser keeps, so a return visit shows as the same person.
// Names appear once one of their visits sent an inquiry or booked a call;
// everyone else is shown by where they are, how they found the site and
// what they read.

import { Fragment, useEffect, useMemo, useState } from 'react';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiGet } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import { avatarColor, initials, timeAgo } from '../shared';
import type { SiteVisitor, VisitorReport } from '@/types/visitors';

type Filter = 'all' | 'now' | 'returning' | 'interested' | 'known';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'now', label: 'On the site now' },
  { value: 'returning', label: 'Came back' },
  { value: 'interested', label: 'Read a service page' },
  { value: 'known', label: 'Known' },
];

const COLUMNS = 'minmax(0,1.5fr) 150px minmax(0,1.2fr) 110px';
const NOW_MS = 5 * 60_000;
const REFRESH_MS = 60_000;

function duration(ms: number) {
  const mins = Math.round(ms / 60_000);
  if (mins >= 1) return `${mins} min`;
  return ms >= 1000 ? `${Math.round(ms / 1000)} sec` : '—';
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function nameOf(v: SiteVisitor) {
  if (v.contact) return v.contact.name;
  return v.place ? `Visitor in ${v.place}` : 'Visitor';
}

export default function VisitorsPage() {
  const { openContact, notify } = useCrm();
  const [report, setReport] = useState<VisitorReport | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Load now, then every minute while the tab is visible.
  useEffect(() => {
    let cancelled = false;
    const load = () => apiGet<VisitorReport>('/api/crm/visitors')
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((error) => { if (!cancelled) notify(error instanceof Error ? error.message : 'Could not load visitors', 'error'); });
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [notify]);

  const generated = report ? Date.parse(report.generated_at) : 0;
  const isNow = (v: SiteVisitor) => generated - Date.parse(v.last_seen) < NOW_MS;

  const stats = useMemo(() => {
    const list = report?.visitors ?? [];
    const today = report ? new Date(report.generated_at).toLocaleDateString('en-CA') : '';
    return {
      now: list.filter((v) => generated - Date.parse(v.last_seen) < NOW_MS).length,
      today: list.filter((v) => new Date(v.last_seen).toLocaleDateString('en-CA') === today).length,
      returning: list.filter((v) => v.visits > 1).length,
      known: list.filter((v) => v.contact).length,
      total: list.length,
    };
  }, [report, generated]);

  const matches = (v: SiteVisitor, f: Filter) =>
    f === 'all' ? true
      : f === 'now' ? isNow(v)
        : f === 'returning' ? v.visits > 1
          : f === 'interested' ? v.interests.length > 0
            : Boolean(v.contact);

  const query = q.trim().toLowerCase();
  const visible = (report?.visitors ?? []).filter((v) =>
    matches(v, filter)
    && (!query || [nameOf(v), v.contact?.company, v.first_source, v.place, ...v.interests].some((x) => x?.toLowerCase().includes(query))),
  );

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Visitors</h1>
          <p className={w.sub}>
            Everyone who browsed the site in the last 30 days. A browser that comes back counts as the same visitor. Names appear once a visitor
            sends an inquiry or books a call, and their earlier visits come with them. Everyone else is shown by where they are and what they read.
          </p>
        </div>
      </div>

      <div className={w.statRow}>
        <div className={w.stat}><p className={w.statLabel}>On the site now</p><p className={w.statValue} style={{ color: stats.now ? '#0a8f4f' : undefined }}>{stats.now}</p><p className={w.statNote}>Active in the last 5 minutes</p></div>
        <div className={w.stat}><p className={w.statLabel}>Visitors today</p><p className={w.statValue}>{stats.today}</p></div>
        <div className={w.stat}><p className={w.statLabel}>Came back</p><p className={w.statValue}>{stats.returning}</p><p className={w.statNote}>{stats.total ? `of ${stats.total} in 30 days` : 'No visitors yet'}</p></div>
        <div className={w.stat}><p className={w.statLabel}>Known by name</p><p className={w.statValue}>{stats.known}</p></div>
      </div>

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city, source, service, name…" aria-label="Search visitors" />
        <div className={w.chips} role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" className={`${w.chip} ${filter === f.value ? w.chipOn : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} <span style={{ opacity: 0.6 }}>{(report?.visitors ?? []).filter((v) => matches(v, f.value)).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={w.table}>
        <div className={`${w.row} ${w.rowHead}`} style={{ gridTemplateColumns: COLUMNS }}>
          <span>Visitor</span><span>Activity</span><span className={w.hideSmall}>Interested in</span><span className={w.hideSmall}>Last seen</span>
        </div>
        {report === null && <p className={w.empty}>Loading…</p>}
        {report && visible.length === 0 && <p className={w.empty}>{query || filter !== 'all' ? 'No matches.' : 'No visits recorded in the last 30 days.'}</p>}
        {visible.map((v) => {
          const expanded = openKey === v.key;
          return (
            <Fragment key={v.key}>
              <div role="button" tabIndex={0} aria-expanded={expanded} className={`${w.row} ${w.rowClick} ${expanded ? w.rowOn : ''}`} style={{ gridTemplateColumns: COLUMNS }}
                onClick={() => setOpenKey(expanded ? null : v.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setOpenKey(expanded ? null : v.key); }}>
                <span className={w.who}>
                  <span className={w.avatar} style={{ background: v.contact ? avatarColor(v.contact.id) : '#c9c4bb' }}>{v.contact ? initials(v.contact.name) : '?'}</span>
                  <span className={w.whoText}>
                    <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>
                      {nameOf(v)}{v.contact?.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {v.contact.company}</span> : null}
                    </span>
                    <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>
                      {[v.device && v.device[0].toUpperCase() + v.device.slice(1), v.first_source && `found you via ${v.first_source}`].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                </span>
                <span className={w.muted}>
                  {isNow(v) && <span className={`${w.pill} ${w.pillClient}`} style={{ marginRight: 6 }}><span className={w.pillDot} />Now</span>}
                  {v.visits} visit{v.visits === 1 ? '' : 's'} · {v.pages} pg · {duration(v.ms)}
                </span>
                <span className={`${w.muted} ${w.truncate} ${w.hideSmall}`}>{v.interests.join(', ') || '—'}</span>
                <span className={`${w.muted} ${w.hideSmall}`}>{timeAgo(v.last_seen)}</span>
              </div>
              {expanded && <VisitorDetail visitor={v} onOpenContact={(id) => openContact(id)} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function VisitorDetail({ visitor: v, onOpenContact }: { visitor: SiteVisitor; onOpenContact: (id: string) => void }) {
  return (
    <div style={{ padding: '14px 18px 18px 58px', borderBottom: '1px solid #f4f2ef', background: '#faf9f7' }}>
      <p className={w.muted} style={{ margin: '0 0 10px', fontSize: 13 }}>
        First seen {when(v.first_seen)}{v.first_source ? ` via ${v.first_source}` : ''}{v.place ? ` · ${v.place}` : ''}
        {v.visits > v.sessions.length ? ` · showing the latest ${v.sessions.length} of ${v.visits} visits` : ''}
      </p>
      {v.contact && (
        <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginBottom: 12 }} onClick={() => onOpenContact(v.contact!.id)}>
          Open {v.contact.name}
        </button>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {v.sessions.map((s) => (
          <li key={s.session_id}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
              {when(s.at)}<span className={w.muted} style={{ fontWeight: 500 }}>{s.source ? ` · from ${s.source}` : ''} · {duration(s.ms)}</span>
            </p>
            <p className={w.muted} style={{ margin: '3px 0 0', fontSize: 13 }}>
              {s.pages.map((pg, i) => (
                <span key={`${pg.at}-${i}`}>{i > 0 && ' → '}{pg.label}{pg.ms && pg.ms >= 60_000 ? ` (${duration(pg.ms)})` : ''}</span>
              ))}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
