'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { CRM_STAGES, STAGE_LABEL, type CrmContactCard, type CrmStage } from '@/types/crm';
import { ContactDrawer } from './ContactDrawer';
import { NewContactDialog } from './NewContactDialog';
import { STAGE_COLOR, todayIso } from './shared';

/** Won and lost pile up forever; show the recent ones until asked. */
const CLOSED_LIMIT = 15;

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function setContactParam(id: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('portal');
  if (id) url.searchParams.set('contact', id);
  else url.searchParams.delete('contact');
  window.history.replaceState(null, '', url);
}

export default function CrmPage() {
  const [rows, setRows] = useState<CrmContactCard[] | null>(null);
  const [search, setSearch] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<CrmStage, boolean>>>({});
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await apiGet<CrmContactCard[]>('/api/crm/contacts');
      setRows(data);
      return data;
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not load contacts', 'error');
      setRows((prev) => prev ?? []);
      return null;
    }
  }, [show]);

  // First load, and open the contact named in the URL: ?contact=<id> from a
  // shared link, or ?portal=<id> from a client's page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await load();
      if (cancelled || !data) return;
      const params = new URLSearchParams(window.location.search);
      const portal = params.get('portal');
      const wanted = params.get('contact') ?? (portal && data.find((c) => c.portal_client_id === portal)?.id);
      if (wanted && data.some((c) => c.id === wanted)) setOpenId(wanted);
      else if (portal) show('That client has no CRM contact yet', 'error');
    })();
    return () => { cancelled = true; };
  }, [load, show]);

  const open = useCallback((id: string | null) => {
    setOpenId(id);
    setContactParam(id);
  }, []);

  async function moveTo(id: string, stage: CrmStage) {
    const current = rows?.find((c) => c.id === id);
    if (!current || current.stage === stage) return;
    // Optimistic: the card moves now, and moves back if the save fails.
    setRows((prev) => prev?.map((c) => (c.id === id ? { ...c, stage, stage_changed_at: new Date().toISOString() } : c)) ?? prev);
    try {
      await apiSend(`/api/crm/contacts/${id}`, 'PATCH', { stage });
      show(`${current.name || 'Contact'} → ${STAGE_LABEL[stage]}`);
    } catch (error) {
      setRows((prev) => prev?.map((c) => (c.id === id ? current : c)) ?? prev);
      show(error instanceof Error ? error.message : 'Could not move contact', 'error');
    }
  }

  const today = todayIso();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((c) => {
      if (dueOnly && !(c.next_task_due && c.next_task_due <= today)) return false;
      if (!q) return true;
      return [c.name, c.company, c.email, c.phone, c.source, ...c.tags]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, dueOnly, today]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    const openStages: CrmStage[] = ['lead', 'contacted', 'proposal'];
    const pipeline = all.filter((c) => openStages.includes(c.stage)).reduce((sum, c) => sum + (c.value_cents ?? 0), 0);
    const monthStart = today.slice(0, 7);
    const wonThisMonth = all
      .filter((c) => c.stage === 'won' && c.stage_changed_at.slice(0, 7) === monthStart)
      .reduce((sum, c) => sum + (c.value_cents ?? 0), 0);
    const due = all.filter((c) => c.next_task_due && c.next_task_due <= today).length;
    const newLeads = all.filter((c) => c.new_inquiries > 0).length;
    return { pipeline, wonThisMonth, due, newLeads };
  }, [rows, today]);

  return (
    <div className={s.screen}>
      <div className={s.top}>
        <div className={p.pageHead} style={{ marginBottom: 0 }}>
          <div>
            <h1 className={p.pageTitle}>CRM</h1>
            <p className={p.pageSub}>
              Everyone who has filled in the contact form, been sent a proposal or has a portal login.
              Drag a card to change its stage.
            </p>
          </div>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setCreating(true)}>
            New contact
          </button>
        </div>

        <div className={s.toolbar}>
          <input
            className={`${p.input} ${s.search}`}
            type="search"
            placeholder="Search name, company, email, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search contacts"
          />
          <div className={s.stats}>
            <span className={s.stat}>Open pipeline <strong>{formatMoneyCents(stats.pipeline)}</strong></span>
            <span className={s.stat}>Won this month <strong>{formatMoneyCents(stats.wonThisMonth)}</strong></span>
            {stats.newLeads > 0 && (
              <span className={`${s.stat} ${s.statAlert}`}><strong>{stats.newLeads}</strong> with unread inquiries</span>
            )}
            <button
              type="button"
              className={`${s.stat} ${s.statButton} ${dueOnly ? s.statButtonOn : stats.due > 0 ? s.statAlert : ''}`}
              aria-pressed={dueOnly}
              onClick={() => setDueOnly((v) => !v)}
            >
              <strong>{stats.due}</strong> follow-up{stats.due === 1 ? '' : 's'} due
            </button>
          </div>
        </div>
      </div>

      {rows === null ? (
        <p className={p.empty}>Loading…</p>
      ) : (
        <div className={s.board}>
          {CRM_STAGES.map((stage) => {
            const cards = visible.filter((c) => c.stage === stage);
            const closed = stage === 'won' || stage === 'lost';
            const shown = closed && !expanded[stage] ? cards.slice(0, CLOSED_LIMIT) : cards;
            const total = cards.reduce((sum, c) => sum + (c.value_cents ?? 0), 0);
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
                  {shown.map((c) => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      today={today}
                      dragging={dragId === c.id}
                      onOpen={() => open(c.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', c.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(c.id);
                      }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    />
                  ))}
                  {cards.length === 0 && (
                    <p className={s.columnMeta} style={{ padding: '8px 4px', margin: 0 }}>
                      {search || dueOnly ? 'No matches' : 'Nobody here'}
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

      {openId && (
        <ContactDrawer
          key={openId}
          id={openId}
          onClose={() => open(null)}
          onChanged={load}
          onDeleted={() => { open(null); void load(); }}
          notify={show}
        />
      )}

      {creating && (
        <NewContactDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); void load(); open(id); }}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

function ContactCard({ contact: c, today, dragging, onOpen, onDragStart, onDragEnd }: {
  contact: CrmContactCard;
  today: string;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const late = c.next_task_due && c.next_task_due < today;
  const dueToday = c.next_task_due === today;
  const subtitle = [c.company, !c.company && c.email].filter(Boolean).join('');
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
        {c.new_inquiries > 0 && <span className={s.newDot} title="Unread inquiry" aria-label="Unread inquiry" />}
        {c.name || c.email || 'Unnamed'}
      </p>
      {subtitle && <p className={s.cardSub}>{subtitle}</p>}
      <div className={s.cardRow}>
        {c.value_cents != null && c.value_cents > 0 && (
          <span className={s.cardValue}>{formatMoneyCents(c.value_cents)}</span>
        )}
        {c.latest_proposal && c.stage === 'proposal' && (
          <span className={s.chip}>{c.latest_proposal.status}</span>
        )}
        {c.next_task_due ? (
          <span className={`${s.chip} ${late ? s.chipLate : dueToday ? s.chipDue : ''}`} title={c.next_task_title ?? undefined}>
            {late ? 'Overdue' : dueToday ? 'Due today' : `Due ${formatDate(c.next_task_due)}`}
          </span>
        ) : c.open_tasks > 0 ? (
          <span className={s.chip}>{c.open_tasks} task{c.open_tasks === 1 ? '' : 's'}</span>
        ) : null}
        {c.tags.slice(0, 2).map((t) => <span key={t} className={s.chip}>{t}</span>)}
      </div>
      <p className={s.cardSub} style={{ marginTop: 6 }}>
        {c.source !== 'manual' && <span style={{ textTransform: 'capitalize' }}>{c.source} · </span>}
        {daysAgo(c.last_touch_at)}
      </p>
    </button>
  );
}
