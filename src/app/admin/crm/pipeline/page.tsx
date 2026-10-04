'use client';

// The pipeline: every open piece of work as a card, dragged from stage to
// stage. Prospects aren't here — they join as a New lead when they reply.

import { useCallback, useEffect, useMemo, useState } from 'react';
import p from '../../proposals/proposals.module.css';
import s from '../crm.module.css';
import w from '../workspace.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from '../../proposals/adminApi';
import { CRM_STAGES, STAGE_LABEL, type CrmDealCard, type CrmStage } from '@/types/crm';
import { useCrm } from '../CrmContext';
import { NewDealDialog } from '../NewDealDialog';
import { STAGE_COLOR, avatarColor, initials, todayIso } from '../shared';

/** Won and lost pile up forever; show the recent ones until asked. */
const CLOSED_LIMIT = 15;

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export default function PipelinePage() {
  const { openContact, version, refresh, contacts, notify: show } = useCrm();
  const [deals, setDeals] = useState<CrmDealCard[] | null>(null);
  const [search, setSearch] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  // ⌘K "New deal" lands here with ?new=1.
  const [creating, setCreating] = useState(() => urlParam('new') === '1');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<CrmStage, boolean>>>({});

  const load = useCallback(async () => {
    try {
      setDeals(await apiGet<CrmDealCard[]>('/api/crm/deals'));
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not load the pipeline', 'error');
      setDeals((prev) => prev ?? []);
    }
  }, [show]);

  useEffect(() => {
    let cancelled = false;
    apiGet<CrmDealCard[]>('/api/crm/deals')
      .then((d) => { if (!cancelled) setDeals(d); })
      .catch((error) => { if (!cancelled) { show(error instanceof Error ? error.message : 'Could not load the pipeline', 'error'); setDeals((prev) => prev ?? []); } });
    return () => { cancelled = true; };
  }, [version, show]);

  async function moveTo(id: string, stage: CrmStage) {
    const current = deals?.find((d) => d.id === id);
    if (!current || current.stage === stage) return;
    // Optimistic: the card moves now, and moves back if the save fails.
    setDeals((prev) => prev?.map((d) => (d.id === id ? { ...d, stage, stage_changed_at: new Date().toISOString() } : d)) ?? prev);
    try {
      await apiSend(`/api/crm/deals/${id}`, 'PATCH', { stage });
      show(`${current.title} → ${STAGE_LABEL[stage]}`);
      refresh();
    } catch (error) {
      setDeals((prev) => prev?.map((d) => (d.id === id ? current : d)) ?? prev);
      show(error instanceof Error ? error.message : 'Could not move deal', 'error');
    }
  }

  const today = todayIso();
  const q = search.trim().toLowerCase();

  const visibleDeals = useMemo(() => (deals ?? []).filter((d) => {
    if (dueOnly && !(d.next_task_due && d.next_task_due <= today)) return false;
    if (!q) return true;
    return [d.title, d.contact.name, d.contact.company, d.contact.email, d.source, ...d.contact.tags]
      .some((v) => v?.toLowerCase().includes(q));
  }), [deals, q, dueOnly, today]);

  const stats = useMemo(() => {
    const all = deals ?? [];
    const openStages: CrmStage[] = ['lead', 'contacted', 'proposal'];
    const pipeline = all.filter((d) => openStages.includes(d.stage)).reduce((sum, d) => sum + (d.value_cents ?? 0), 0);
    const month = today.slice(0, 7);
    const wonThisMonth = all
      .filter((d) => d.stage === 'won' && d.stage_changed_at.slice(0, 7) === month)
      .reduce((sum, d) => sum + (d.value_cents ?? 0), 0);
    // Tasks are per contact; count contacts, not every deal they have.
    const due = new Set(all.filter((d) => d.next_task_due && d.next_task_due <= today).map((d) => d.contact_id)).size;
    const unread = all.filter((d) => d.new_inquiries > 0).length;
    return { pipeline, wonThisMonth, due, unread };
  }, [deals, today]);

  const loaded = deals !== null;

  return (
    <div className={`${w.page} ${w.pageWide}`} style={{ paddingBottom: 24 }}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Pipeline</h1>
          <p className={w.sub}>Each card is a piece of work. Drag it to change its stage; click it to open the person.</p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setCreating(true)}>New deal</button>
        </div>
      </div>

      <div className={w.statRow}>
        <div className={w.stat}><p className={w.statLabel}>Open pipeline</p><p className={w.statValue}>{formatMoneyCents(stats.pipeline)}</p></div>
        <div className={w.stat}><p className={w.statLabel}>Won this month</p><p className={w.statValue}>{formatMoneyCents(stats.wonThisMonth)}</p></div>
        <button type="button" className={w.stat} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: dueOnly ? '#141414' : undefined }} aria-pressed={dueOnly} onClick={() => setDueOnly((v) => !v)}>
          <p className={w.statLabel}>Follow-ups due</p>
          <p className={w.statValue} style={{ color: stats.due ? '#b0045f' : undefined }}>{stats.due}</p>
          <p className={w.statNote}>{dueOnly ? 'Showing only these — click to show all' : 'Click to show only these'}</p>
        </button>
        <div className={w.stat}><p className={w.statLabel}>Unread inquiries</p><p className={w.statValue}>{stats.unread}</p></div>
      </div>

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" placeholder="Search deals, names, companies, tags…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search deals" />
      </div>

      {!loaded ? (
        <p className={p.empty}>Loading…</p>
      ) : (
        <div className={s.board}>
          {CRM_STAGES.map((stage) => {
            const cards = visibleDeals.filter((d) => d.stage === stage);
            const closed = stage === 'won' || stage === 'lost';
            const shown = closed && !expanded[stage] ? cards.slice(0, CLOSED_LIMIT) : cards;
            const total = cards.reduce((sum, d) => sum + (d.value_cents ?? 0), 0);
            return (
              <section
                key={stage}
                className={`${s.column} ${overStage === stage ? s.columnOver : ''}`}
                aria-label={STAGE_LABEL[stage]}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overStage !== stage) setOverStage(stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  setOverStage(null);
                  setDragId(null);
                  if (id) void moveTo(id, stage);
                }}
              >
                <div className={s.columnHead}>
                  <h2 className={s.columnTitle}>
                    <span className={s.dot} style={{ background: STAGE_COLOR[stage] }} />
                    {STAGE_LABEL[stage]}
                    <span className={s.columnMeta}>{cards.length}</span>
                  </h2>
                  {total > 0 && <span className={s.columnMeta}>{formatMoneyCents(total)}</span>}
                </div>

                <div className={s.cards}>
                  {shown.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      today={today}
                      dragging={dragId === d.id}
                      onOpen={() => openContact(d.contact_id, d.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', d.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(d.id);
                      }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    />
                  ))}
                  {cards.length === 0 && (
                    <p className={s.columnMeta} style={{ padding: '8px 4px', margin: 0 }}>
                      {search || dueOnly ? 'No matches' : 'Nothing here'}
                    </p>
                  )}
                  {shown.length < cards.length && (
                    <button type="button" className={s.moreButton} onClick={() => setExpanded((x) => ({ ...x, [stage]: true }))}>
                      Show all {cards.length}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {creating && (
        <NewDealDialog
          contacts={contacts ?? []}
          onClose={() => setCreating(false)}
          onCreated={(contactId, dealId) => { setCreating(false); void load(); refresh(); openContact(contactId, dealId); }}
        />
      )}
    </div>
  );
}

function DealCard({ deal: d, today, dragging, onOpen, onDragStart, onDragEnd }: {
  deal: CrmDealCard;
  today: string;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const late = d.next_task_due && d.next_task_due < today;
  const dueToday = d.next_task_due === today;
  const who = [d.contact.name || d.contact.email, d.contact.company].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      className={`${s.card} ${dragging ? s.cardDragging : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
    >
      <p className={s.cardName}>
        {d.new_inquiries > 0 && <span className={s.newDot} title="Unread inquiry" aria-label="Unread inquiry" />}
        {d.title}
      </p>
      <div className={s.cardWho}>
        <span className={s.cardAvatar} style={{ background: avatarColor(d.contact.id) }} aria-hidden="true">{initials(d.contact.name, d.contact.email)}</span>
        <span className={s.cardSub} style={{ margin: 0 }}>{who || 'Unnamed'}</span>
      </div>
      <div className={s.cardRow}>
        {d.value_cents != null && d.value_cents > 0 && (
          <span className={s.cardValue}>{formatMoneyCents(d.value_cents)}</span>
        )}
        {d.latest_proposal && d.stage === 'proposal' && (
          <span className={s.chip}>{d.latest_proposal.status}</span>
        )}
        {d.next_task_due ? (
          <span className={`${s.chip} ${late ? s.chipLate : dueToday ? s.chipDue : ''}`} title={d.next_task_title ?? undefined}>
            {late ? 'Overdue' : dueToday ? 'Due today' : `Due ${formatDate(d.next_task_due)}`}
          </span>
        ) : d.open_tasks > 0 ? (
          <span className={s.chip}>{d.open_tasks} task{d.open_tasks === 1 ? '' : 's'}</span>
        ) : null}
        {d.contact.portal_client_id && d.stage !== 'won' && <span className={s.chip}>Client</span>}
        {d.contact.tags.slice(0, 2).map((t) => <span key={t} className={s.chip}>{t}</span>)}
      </div>
      <p className={s.cardSub} style={{ marginTop: 6 }}>
        {d.source !== 'manual' && <span style={{ textTransform: 'capitalize' }}>{d.source} · </span>}
        {daysAgo(d.last_touch_at)}
      </p>
    </button>
  );
}
