'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { CRM_STAGES, STAGE_LABEL, type CrmContactRow, type CrmDealCard, type CrmStage } from '@/types/crm';
import { ContactDrawer } from './ContactDrawer';
import { NewDealDialog } from './NewDealDialog';
import { STAGE_COLOR, todayIso } from './shared';

/** Won and lost pile up forever; show the recent ones until asked. */
const CLOSED_LIMIT = 15;

type View = 'pipeline' | 'contacts';

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function setUrl(contact: string | null, deal: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('portal');
  for (const [key, value] of [['contact', contact], ['deal', deal]] as const) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, '', url);
}

export default function CrmPage() {
  const [view, setView] = useState<View>('pipeline');
  const [deals, setDeals] = useState<CrmDealCard[] | null>(null);
  const [contacts, setContacts] = useState<CrmContactRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [open, setOpen] = useState<{ contact: string; deal: string | null } | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmStage | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<CrmStage, boolean>>>({});
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        apiGet<CrmDealCard[]>('/api/crm/deals'),
        apiGet<CrmContactRow[]>('/api/crm/contacts'),
      ]);
      setDeals(d);
      setContacts(c);
      return c;
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not load the CRM', 'error');
      setDeals((prev) => prev ?? []);
      setContacts((prev) => prev ?? []);
      return null;
    }
  }, [show]);

  // First load, and open what the URL names: ?contact=<id>&deal=<id> from a
  // shared link or the dashboard, or ?portal=<id> from a client's page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await load();
      if (cancelled || !list) return;
      const params = new URLSearchParams(window.location.search);
      const portal = params.get('portal');
      const wanted = params.get('contact') ?? (portal && list.find((c) => c.portal_client_id === portal)?.id);
      if (wanted && list.some((c) => c.id === wanted)) setOpen({ contact: wanted, deal: params.get('deal') });
      else if (portal) show('That client has no CRM contact yet', 'error');
    })();
    return () => { cancelled = true; };
  }, [load, show]);

  const openDrawer = useCallback((contact: string | null, deal: string | null = null) => {
    setOpen(contact ? { contact, deal } : null);
    setUrl(contact, deal);
  }, []);

  async function moveTo(id: string, stage: CrmStage) {
    const current = deals?.find((d) => d.id === id);
    if (!current || current.stage === stage) return;
    // Optimistic: the card moves now, and moves back if the save fails.
    setDeals((prev) => prev?.map((d) => (d.id === id ? { ...d, stage, stage_changed_at: new Date().toISOString() } : d)) ?? prev);
    try {
      await apiSend(`/api/crm/deals/${id}`, 'PATCH', { stage });
      show(`${current.title} → ${STAGE_LABEL[stage]}`);
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

  const visibleContacts = useMemo(() => (contacts ?? []).filter((c) =>
    !q || [c.name, c.company, c.email, c.phone, c.source, ...c.tags].some((v) => v?.toLowerCase().includes(q)),
  ), [contacts, q]);

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

  const loaded = deals !== null && contacts !== null;

  return (
    <div className={s.screen}>
      <div className={s.top}>
        <div className={p.pageHead} style={{ marginBottom: 0 }}>
          <div>
            <h1 className={p.pageTitle}>CRM</h1>
            <p className={p.pageSub}>
              Each card is a piece of work with someone. A returning client&apos;s new project gets its own card.
              Drag a card to change its stage.
            </p>
          </div>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setCreating(true)}>
            New deal
          </button>
        </div>

        <div className={s.toolbar}>
          <div className={p.filters} style={{ marginBottom: 0 }} role="tablist" aria-label="View">
            {(['pipeline', 'contacts'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`${p.filterChip} ${view === v ? p.filterChipOn : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'pipeline' ? 'Pipeline' : `Contacts${contacts ? ` (${contacts.length})` : ''}`}
              </button>
            ))}
          </div>
          <input
            className={`${p.input} ${s.search}`}
            type="search"
            placeholder={view === 'pipeline' ? 'Search deals, names, companies, tags…' : 'Search name, company, email, tag…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search"
          />
          {view === 'pipeline' && (
            <div className={s.stats}>
              <span className={s.stat}>Open pipeline <strong>{formatMoneyCents(stats.pipeline)}</strong></span>
              <span className={s.stat}>Won this month <strong>{formatMoneyCents(stats.wonThisMonth)}</strong></span>
              {stats.unread > 0 && (
                <span className={`${s.stat} ${s.statAlert}`}><strong>{stats.unread}</strong> with unread inquiries</span>
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
          )}
        </div>
      </div>

      {!loaded ? (
        <p className={p.empty}>Loading…</p>
      ) : view === 'contacts' ? (
        <div className={s.contactsWrap}>
          <div className={p.list}>
            {visibleContacts.length === 0 && <p className={p.empty}>{q ? 'No matches.' : 'No contacts yet.'}</p>}
            {visibleContacts.map((c) => (
              <button key={c.id} type="button" className={s.contactRow} onClick={() => openDrawer(c.id)}>
                <span style={{ minWidth: 0 }}>
                  <span className={s.cardName}>{c.name || c.email || 'Unnamed'}</span>
                  <span className={s.cardSub}>{[c.company, c.email].filter(Boolean).join(' · ') || 'No details'}</span>
                </span>
                <span className={s.cardSub}>
                  {c.open_deals > 0 ? `${c.open_deals} open` : c.deals > 0 ? `${c.deals} deal${c.deals === 1 ? '' : 's'}` : 'No deals'}
                </span>
                <span className={`${s.cardValue} ${s.hideSmall}`}>{c.won_value_cents ? formatMoneyCents(c.won_value_cents) : ''}</span>
                <span className={`${s.cardSub} ${s.hideSmall}`}>{c.portal_client_id ? 'Portal client' : c.source}</span>
                <span className={`${s.cardSub} ${s.hideSmall}`}>{daysAgo(c.last_touch_at)}</span>
              </button>
            ))}
          </div>
        </div>
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
                      onOpen={() => openDrawer(d.contact_id, d.id)}
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

      {open && (
        <ContactDrawer
          key={open.contact}
          id={open.contact}
          focusDealId={open.deal}
          onClose={() => openDrawer(null)}
          onChanged={load}
          onDeleted={() => { openDrawer(null); void load(); }}
          notify={show}
        />
      )}

      {creating && (
        <NewDealDialog
          contacts={contacts ?? []}
          onClose={() => setCreating(false)}
          onCreated={(contactId, dealId) => { setCreating(false); void load(); openDrawer(contactId, dealId); }}
        />
      )}

      <Toast toast={toast} />
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
      <p className={s.cardSub}>{who || 'Unnamed'}</p>
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
