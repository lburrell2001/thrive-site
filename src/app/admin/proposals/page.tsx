'use client';

// Sales → Proposals: stats, tabs by where each proposal stands, search, and
// one row per proposal. A signed proposal can be invoiced from its row (the
// deposit, the balance, or in full), which opens the invoice builder with
// the lines filled in.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import s from './proposals.module.css';
import w from '../crm/workspace.module.css';
import b from '../invoices/billing.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from './adminApi';
import { Toast, useToast } from './Toast';
import type { ProposalStatus } from '@/types/proposal';
import type { ReminderPreview, ReminderResult } from '@/lib/reminders';
import { ReminderDialog } from '../ReminderDialog';

interface ProposalRow {
  id: string;
  slug: string;
  title: string;
  status: ProposalStatus;
  proposal_date: string;
  valid_until: string | null;
  currency: string;
  total_cents: number;
  deposit_percent: number;
  sent_at: string | null;
  first_viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  last_reminded_at: string | null;
  updated_at: string;
  proposal_clients: { id: string; name: string; company: string | null } | null;
}

type Tab = 'open' | 'signed' | 'closed' | 'all';

const TABS: { value: Tab; label: string; match: (st: ProposalStatus) => boolean }[] = [
  { value: 'open', label: 'Open', match: (st) => st === 'draft' || st === 'sent' || st === 'viewed' },
  { value: 'signed', label: 'Signed', match: (st) => st === 'signed' },
  { value: 'closed', label: 'Closed', match: (st) => st === 'declined' || st === 'expired' },
  { value: 'all', label: 'All', match: () => true },
];

const STATUS: Record<ProposalStatus, { cls: string; label: string }> = {
  draft:    { cls: b.stDraft,    label: 'Draft' },
  sent:     { cls: b.stSent,     label: 'Sent' },
  viewed:   { cls: s.stViewed,   label: 'Opened' },
  signed:   { cls: b.stAccepted, label: 'Signed' },
  declined: { cls: b.stDeclined, label: 'Declined' },
  expired:  { cls: b.stInvoiced, label: 'Expired' },
};

/** "Sent Nov 3 · opened Nov 4", "Signed Nov 5"… the line that says where it stands. */
function progress(row: ProposalRow): string {
  if (row.status === 'signed' && row.signed_at) return `Signed ${formatDate(row.signed_at)}`;
  if (row.status === 'declined' && row.declined_at) return `Declined ${formatDate(row.declined_at)}`;
  if (row.status === 'expired') return row.valid_until ? `Expired ${formatDate(row.valid_until)}` : 'Expired';
  if (row.status === 'draft') return `Edited ${formatDate(row.updated_at)}`;
  return [
    row.sent_at ? `Sent ${formatDate(row.sent_at)}` : '',
    row.first_viewed_at ? `opened ${formatDate(row.first_viewed_at)}` : 'not opened yet',
    row.last_reminded_at ? `reminded ${formatDate(row.last_reminded_at)}` : '',
  ].filter(Boolean).join(' · ');
}

export default function ProposalsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reminding, setReminding] = useState<ProposalRow | null>(null);
  const { toast, show } = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<ProposalRow[]>('/api/proposals');
        if (!cancelled) setRows(data);
      } catch (error) {
        if (cancelled) return;
        show(error instanceof Error ? error.message : 'Could not load proposals', 'error');
        setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey, show]);

  async function duplicate(id: string) {
    setBusyId(id);
    try {
      const created = await apiSend<{ id: string }>(`/api/proposals/${id}/duplicate`, 'POST');
      show('Duplicated.');
      router.push(`/admin/crm/proposals/${created.id}/edit`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not duplicate', 'error');
      setBusyId(null);
    }
  }

  async function remove(row: ProposalRow) {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    try {
      await apiSend(`/api/proposals/${row.id}`, 'DELETE');
      show('Deleted.');
      reload();
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
    setBusyId(null);
  }

  const loadReminderPreview = useCallback(
    () => apiGet<ReminderPreview>(`/api/proposals/${reminding?.id}/remind`),
    [reminding],
  );

  const all = rows ?? [];
  const q = query.trim().toLowerCase();
  const current = TABS.find((t) => t.value === tab)!;
  const visible = all
    .filter((row) => current.match(row.status))
    .filter((row) => !q || `${row.title} ${row.proposal_clients?.name ?? ''} ${row.proposal_clients?.company ?? ''}`.toLowerCase().includes(q));

  const waiting = all.filter((r) => r.status === 'sent' || r.status === 'viewed');
  const opened = waiting.filter((r) => r.first_viewed_at);
  const signed = all.filter((r) => r.status === 'signed');
  const decided = all.filter((r) => r.status === 'signed' || r.status === 'declined' || r.status === 'expired');
  const sum = (xs: ProposalRow[]) => xs.reduce((n, r) => n + r.total_cents, 0);
  const winRate = decided.length ? Math.round((signed.length / decided.length) * 100) : null;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Proposals</h1>
          <p className={w.sub}>Start from the Thrive layout, a template, a past proposal or an estimate. Pricing comes from your price list.</p>
        </div>
        <div className={w.headActions}>
          <Link href="/admin/crm/proposals/templates" className={s.btn}>Templates</Link>
          <Link href="/admin/crm/proposals/new" className={`${s.btn} ${s.btnPrimary}`}>New proposal</Link>
        </div>
      </div>

      <div className={`${w.statRow} ${b.stats}`}>
        <div className={w.stat}>
          <p className={w.statLabel}>Waiting on clients</p>
          <p className={w.statValue}>{formatMoneyCents(sum(waiting))}</p>
          <p className={w.statNote}>{waiting.length ? `${waiting.length} out · ${opened.length} opened` : 'Nothing out'}</p>
        </div>
        <div className={w.stat}>
          <p className={w.statLabel}>Signed</p>
          <p className={w.statValue}>{formatMoneyCents(sum(signed))}</p>
          <p className={w.statNote}>{signed.length} proposal{signed.length === 1 ? '' : 's'}</p>
        </div>
        <div className={w.stat}>
          <p className={w.statLabel}>Win rate</p>
          <p className={w.statValue}>{winRate === null ? '—' : `${winRate}%`}</p>
          <p className={w.statNote}>{decided.length ? `of ${decided.length} decided` : 'None decided yet'}</p>
        </div>
      </div>

      <div className={b.listBar}>
        <div className={w.tabs} role="tablist" aria-label="Show" style={{ margin: 0 }}>
          {TABS.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value}
              className={`${w.tab} ${tab === t.value ? w.tabOn : ''}`} onClick={() => setTab(t.value)}>
              {t.label} <span className={b.count}>{all.filter((r) => t.match(r.status)).length}</span>
            </button>
          ))}
        </div>
        <input type="search" className={w.searchInput} placeholder="Search by name or client" value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label="Search proposals" />
      </div>

      {rows === null ? (
        <p className={w.muted}>Loading…</p>
      ) : visible.length === 0 ? (
        <div className={b.emptyCard}>
          <p>{q ? 'No proposals match.' : all.length === 0 ? 'No proposals yet.' : 'Nothing here.'}</p>
          {all.length === 0 && <Link href="/admin/crm/proposals/new" className={`${s.btn} ${s.btnPrimary}`}>Make your first proposal</Link>}
        </div>
      ) : (
        <ul className={b.docList}>
          {visible.map((row) => {
            const st = STATUS[row.status];
            const pct = row.deposit_percent;
            return (
              <li key={row.id} className={b.doc}>
                <Link href={`/admin/crm/proposals/${row.id}/edit`} className={b.docMain}>
                  <span className={b.docTop}>
                    <span className={`${b.status} ${st.cls}`}>{st.label}</span>
                    <span className={b.docNumber}>{progress(row)}</span>
                  </span>
                  <span className={b.docWho}>{row.title}</span>
                  <span className={b.docMeta}>{row.proposal_clients?.company || row.proposal_clients?.name || 'No client'}</span>
                  {row.status === 'declined' && row.decline_reason && <span className={s.rowReason}>“{row.decline_reason}”</span>}
                </Link>
                <span className={b.docAmount}>{formatMoneyCents(row.total_cents, row.currency)}</span>
                <div className={b.docActions}>
                  {(row.status === 'sent' || row.status === 'viewed') && (
                    <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => setReminding(row)}>Remind</button>
                  )}
                  {row.status === 'signed' && (
                    <Link href={`/admin/invoices?proposal=${row.id}&part=full`} className={`${s.btn} ${s.btnSmall} ${s.btnPrimary}`}
                      title={pct > 0 && pct < 100 ? `One invoice: the ${pct}% deposit first, the rest when you open it` : undefined}>Invoice</Link>
                  )}
                  <button type="button" className={`${s.btn} ${s.btnSmall}`} disabled={busyId === row.id} onClick={() => duplicate(row.id)}>Duplicate</button>
                  {row.status !== 'signed' && (
                    <button type="button" className={b.iconBtn} aria-label={`Delete ${row.title}`} title="Delete" disabled={busyId === row.id} onClick={() => remove(row)}>×</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {reminding && (
        <ReminderDialog
          key={reminding.id}
          title="Remind about proposal"
          loadPreview={loadReminderPreview}
          send={(input) =>
            apiSend<ReminderResult>(`/api/proposals/${reminding.id}/remind`, 'POST', {
              channels: input.channels,
              note: input.note,
            })
          }
          saveContact={async (clientId, phone, smsOptIn) => {
            await apiSend(`/api/proposal-clients/${clientId}`, 'PATCH', { phone, sms_opt_in: smsOptIn });
          }}
          onClose={() => setReminding(null)}
          onSent={reload}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
