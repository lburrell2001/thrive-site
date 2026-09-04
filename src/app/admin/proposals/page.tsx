'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import s from './proposals.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from './adminApi';
import { Toast, useToast } from './Toast';
import type { ProposalStatus } from '@/types/proposal';

interface ProposalRow {
  id: string;
  slug: string;
  title: string;
  status: ProposalStatus;
  proposal_date: string;
  currency: string;
  total_cents: number;
  updated_at: string;
  proposal_clients: { id: string; name: string; company: string | null } | null;
}

const FILTERS: { value: ProposalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'signed', label: 'Signed' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

const BADGE: Record<ProposalStatus, string> = {
  draft: s.badgeDraft,
  sent: s.badgeSent,
  viewed: s.badgeViewed,
  signed: s.badgeSigned,
  declined: s.badgeDeclined,
  expired: s.badgeExpired,
};

export default function ProposalsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast, show } = useToast();

  // Bumped to re-fetch after a delete.
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
    return () => {
      cancelled = true;
    };
  }, [reloadKey, show]);

  async function duplicate(id: string) {
    setBusyId(id);
    try {
      const created = await apiSend<{ id: string }>(`/api/proposals/${id}/duplicate`, 'POST');
      show('Duplicated.');
      router.push(`/admin/proposals/${created.id}/edit`);
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

  const visible = rows?.filter((row) => filter === 'all' || row.status === filter) ?? [];

  return (
    <div className={s.screen}>
      <div className={s.wrap}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.pageTitle}>Proposals</h1>
            <p className={s.pageSub}>
              Duplicate an existing proposal to start a new one — it is faster than building from
              scratch.
            </p>
          </div>
          <span style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin/proposals/templates" className={s.btn}>
              Templates
            </Link>
            <Link href="/admin/proposals/new" className={`${s.btn} ${s.btnPrimary}`}>
              New proposal
            </Link>
          </span>
        </div>

        <div className={s.filters}>
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${s.filterChip} ${filter === option.value ? s.filterChipOn : ''}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              {rows && option.value !== 'all'
                ? ` (${rows.filter((r) => r.status === option.value).length})`
                : ''}
            </button>
          ))}
        </div>

        <div className={s.list}>
          {rows === null && <p className={s.empty}>Loading…</p>}

          {rows !== null && visible.length === 0 && (
            <p className={s.empty}>
              {rows.length === 0
                ? 'No proposals yet. Create one to get started.'
                : 'Nothing with that status.'}
            </p>
          )}

          {visible.map((row) => (
            <div key={row.id} className={s.row}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/proposals/${row.id}/edit`} className={s.rowTitle}>
                  {row.title}
                </Link>
                <p className={s.rowMeta}>
                  {row.proposal_clients?.company ?? row.proposal_clients?.name ?? 'No client'} ·{' '}
                  {formatDate(row.proposal_date)}
                </p>
              </div>

              <span className={`${s.badge} ${BADGE[row.status]}`}>{row.status}</span>

              <span className={`${s.rowNumber} ${s.rowHideSmall}`}>
                {formatMoneyCents(row.total_cents, row.currency)}
              </span>

              <span className={`${s.rowMeta} ${s.rowHideSmall}`}>
                {formatDate(row.updated_at)}
              </span>

              <div className={s.rowActions}>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnSmall}`}
                  disabled={busyId === row.id}
                  onClick={() => duplicate(row.id)}
                >
                  Duplicate
                </button>
                <Link
                  href={`/admin/proposals/${row.id}/edit`}
                  className={`${s.btn} ${s.btnSmall}`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnSmall} ${s.btnDanger}`}
                  disabled={busyId === row.id}
                  onClick={() => remove(row)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
