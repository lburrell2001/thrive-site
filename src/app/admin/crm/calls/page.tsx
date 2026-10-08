'use client';

// Every phone call: ones logged by hand from a contact's panel or here, and
// ones booked through /book. Booked calls coming up are listed first.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import p from '../../proposals/proposals.module.css';
import s from '../crm.module.css';
import w from '../workspace.module.css';
import { apiGet, apiSend } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import { LogCallForm } from '../LogCallForm';
import { avatarColor, initials } from '../shared';
import { callSummary } from '@/lib/calls';
import { formatPhone } from '@/lib/phone';
import type { CallOutcome, CrmCallLog, CrmCallRow } from '@/types/crm';

type Filter = 'all' | CallOutcome | 'booked';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All calls' },
  { value: 'connected', label: 'Talked' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'booked', label: 'Booked' },
];

const COLUMNS = 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.6fr) 130px';

const DAY = 86_400_000;

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function matches(c: CrmCallRow, f: Filter) {
  if (f === 'all') return true;
  if (f === 'booked') return Boolean(c.booking_id);
  return c.call?.outcome === f;
}

export default function CallsPage() {
  const { contacts, openContact, notify, refresh, version } = useCrm();
  // Stamped when it loads, so the week/month counts have a fixed "now".
  const [log, setLog] = useState<(CrmCallLog & { loadedAt: number }) | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<CrmCallLog>('/api/crm/calls')
      .then((data) => { if (!cancelled) setLog({ ...data, loadedAt: Date.now() }); })
      .catch((error) => notify(error instanceof Error ? error.message : 'Could not load calls', 'error'));
    return () => { cancelled = true; };
  }, [version, notify]);

  const stats = useMemo(() => {
    const now = log?.loadedAt ?? 0;
    const week = (log?.calls ?? []).filter((c) => now - Date.parse(c.at) < 7 * DAY);
    const month = (log?.calls ?? []).filter((c) => now - Date.parse(c.at) < 30 * DAY);
    return {
      week: week.length,
      talked: week.filter((c) => c.booking_id || c.call?.outcome === 'connected').length,
      minutes: month.reduce((sum, c) => sum + (c.call?.minutes ?? 0), 0),
      upcoming: log?.upcoming.length ?? 0,
    };
  }, [log]);

  const query = q.trim().toLowerCase();
  const visible = (log?.calls ?? []).filter((c) =>
    matches(c, filter)
    && (!query || [c.contact_name, c.company, c.deal_title, c.body].some((v) => v?.toLowerCase().includes(query))),
  );

  async function remove(c: CrmCallRow) {
    if (!c.activity_id || !window.confirm(`Delete this call with ${c.contact_name}?`)) return;
    try {
      await apiSend(`/api/crm/activities/${c.activity_id}`, 'DELETE');
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
  }

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Calls</h1>
          <p className={w.sub}>Calls you’ve made and taken, and calls booked through the website. Log one here or from anyone’s panel.</p>
        </div>
        <div className={w.headActions}>
          <Link href="/admin/calls" className={p.btn}>Booking hours</Link>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setLogging(true)} disabled={!contacts?.length}>☏ Log a call</button>
        </div>
      </div>

      <div className={w.statRow}>
        <div className={w.stat}><p className={w.statLabel}>Calls this week</p><p className={w.statValue}>{stats.week}</p></div>
        <div className={w.stat}>
          <p className={w.statLabel}>Talked this week</p>
          <p className={w.statValue}>{stats.talked}</p>
          <p className={w.statNote}>{stats.week ? `${Math.round((stats.talked / stats.week) * 100)}% of calls` : 'No calls yet'}</p>
        </div>
        <div className={w.stat}><p className={w.statLabel}>Minutes, last 30 days</p><p className={w.statValue}>{stats.minutes}</p><p className={w.statNote}>Logged calls only</p></div>
        <div className={w.stat}><p className={w.statLabel}>Booked, coming up</p><p className={w.statValue}>{stats.upcoming}</p></div>
      </div>

      {log && log.upcoming.length > 0 && (
        <section className={w.card} style={{ marginBottom: 20 }}>
          <div className={w.cardHead}><h2 className={w.cardTitle}>Coming up</h2><span className={w.cardCount}>{log.upcoming.length}</span></div>
          {log.upcoming.map((c) => (
            <div key={c.key} className={w.item} role="button" tabIndex={0} style={{ cursor: c.contact_id ? 'pointer' : undefined }}
              onClick={() => c.contact_id && openContact(c.contact_id, c.deal_id)}
              onKeyDown={(e) => { if (e.key === 'Enter' && c.contact_id) openContact(c.contact_id, c.deal_id); }}>
              <span className={w.avatar} style={{ background: avatarColor(c.contact_id ?? c.key) }}>{initials(c.contact_name)}</span>
              <div className={w.itemMain}>
                <p className={w.itemTitle}>{c.contact_name}{c.company ? <span className={w.muted}> · {c.company}</span> : null}</p>
                <p className={w.itemSub}>{[c.phone && formatPhone(c.phone), c.deal_title].filter(Boolean).join(' · ') || 'Booked through the website'}</p>
                {c.body && <p className={w.itemQuote}>{c.body}</p>}
              </div>
              <span className={w.itemWhen}>{when(c.at)}</span>
            </div>
          ))}
        </section>
      )}

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person, deal, notes…" aria-label="Search calls" />
        <div className={w.chips} role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" className={`${w.chip} ${filter === f.value ? w.chipOn : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} <span style={{ opacity: 0.6 }}>{(log?.calls ?? []).filter((c) => matches(c, f.value)).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={w.table}>
        <div className={`${w.row} ${w.rowHead}`} style={{ gridTemplateColumns: COLUMNS }}>
          <span>Person</span><span>Call</span><span className={w.hideSmall}>Notes</span><span className={w.hideSmall}>When</span>
        </div>
        {log === null && <p className={w.empty}>Loading…</p>}
        {log && visible.length === 0 && <p className={w.empty}>{query || filter !== 'all' ? 'No matches.' : 'No calls logged yet. Use “Log a call” after you hang up.'}</p>}
        {visible.map((c) => (
          <div key={c.key} role="button" tabIndex={0} className={`${w.row} ${c.contact_id ? w.rowClick : ''}`} style={{ gridTemplateColumns: COLUMNS }}
            onClick={() => c.contact_id && openContact(c.contact_id, c.deal_id)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget && c.contact_id) openContact(c.contact_id, c.deal_id); }}>
            <span className={w.who}>
              <span className={w.avatar} style={{ background: avatarColor(c.contact_id ?? c.key) }}>{initials(c.contact_name)}</span>
              <span className={w.whoText}>
                <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{c.contact_name}{c.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {c.company}</span> : null}</span>
                <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>{c.deal_title || (c.phone ? formatPhone(c.phone) : '—')}</span>
              </span>
            </span>
            <span>
              <span className={`${w.pill} ${c.booking_id ? w.pillBlue : c.call?.outcome === 'connected' ? w.pillClient : w.pillMuted}`}>
                <span className={w.pillDot} />{c.booking_id ? 'Booked call' : callSummary(c.call)}
              </span>
            </span>
            <span className={`${w.muted} ${w.truncate} ${w.hideSmall}`}>{c.body || '—'}</span>
            <span className={`${w.muted} ${w.hideSmall}`} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
              {when(c.at)}
              {c.activity_id && (
                <button type="button" className={s.iconButton} aria-label="Delete this call" onClick={(e) => { e.stopPropagation(); remove(c); }}>×</button>
              )}
            </span>
          </div>
        ))}
      </div>

      {logging && contacts && (
        <LogCallDialog
          contacts={contacts}
          onClose={() => setLogging(false)}
          onLogged={() => { setLogging(false); notify('Call logged'); refresh(); }}
        />
      )}
    </div>
  );
}

function LogCallDialog({ contacts, onClose, onLogged }: {
  contacts: NonNullable<ReturnType<typeof useCrm>['contacts']>;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [contactId, setContactId] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = filter.trim().toLowerCase();
  const found = contacts
    .filter((c) => !q || [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)))
    .slice(0, 50);
  const picked = contacts.find((c) => c.id === contactId);

  return (
    <>
      <div className={s.backdrop} onClick={onClose} style={{ zIndex: 60 }} />
      <div className={s.modal} style={{ zIndex: 61 }} role="dialog" aria-modal="true" aria-labelledby="log-call-title">
        <h2 id="log-call-title" className={s.modalTitle}>Log a call{picked ? ` with ${picked.name || picked.email}` : ''}</h2>
        {!picked ? (
          <div className={s.formGrid}>
            <label className={s.full}>
              <span className={s.miniLabel}>Who was it with?</span>
              <input className={p.input} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name, company, email or phone" autoFocus />
            </label>
            <label className={s.full}>
              <span className={s.miniLabel}>Contact</span>
              <select className={p.select} value="" onChange={(e) => setContactId(e.target.value)} size={Math.min(8, Math.max(2, found.length))}>
                {found.map((c) => (
                  <option key={c.id} value={c.id}>{[c.name || c.email, c.company, c.phone && formatPhone(c.phone)].filter(Boolean).join(' · ')}</option>
                ))}
              </select>
            </label>
            <p className={`${s.eventMeta} ${s.full}`}>Someone new? Add them with New deal on the Pipeline first, then log the call from their panel.</p>
            <div className={`${s.modalActions} ${s.full}`}>
              <button type="button" className={p.btn} onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : (
          <LogCallForm contactId={picked.id} contactName={picked.name} onLogged={onLogged} onCancel={onClose} autoFocus />
        )}
      </div>
    </>
  );
}
