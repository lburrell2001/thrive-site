'use client';

// Campaigns: every piece of marketing that went out — postcards, flyers,
// newsletters, outreach emails — who it reached and what came of it, side
// by side, so it's clear what's worth doing again.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiGet, formatDate, formatMoneyCents } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import { PIECE_LABEL, pct } from './shared';
import { NewPrintCampaign } from './NewPrintCampaign';
import type { CampaignRow } from '@/lib/marketing';

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));

type Filter = 'all' | 'print' | 'email';

export default function CampaignsPage() {
  const router = useRouter();
  const { version, notify } = useCrm();
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(() => urlParam('new') === '1');

  useEffect(() => {
    let cancelled = false;
    apiGet<CampaignRow[]>('/api/campaigns')
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((e) => { if (!cancelled) { notify(e instanceof Error ? e.message : 'Could not load campaigns', 'error'); setRows([]); } });
    return () => { cancelled = true; };
  }, [version, notify]);

  const visible = (rows ?? []).filter((r) => filter === 'all' || (filter === 'print' ? r.kind === 'print' : r.kind !== 'print'));

  const totals = useMemo(() => {
    const all = rows ?? [];
    const print = all.filter((r) => r.kind === 'print');
    const email = all.filter((r) => r.kind !== 'print');
    const sum = (list: CampaignRow[], k: 'leads' | 'won_cents' | 'reached') => list.reduce((s, r) => s + r.stats[k], 0);
    const spend = print.reduce((s, r) => s + (r.cost_cents ?? 0), 0);
    const printLeads = sum(print, 'leads') + print.reduce((s, r) => s + (r.stats.inquiries ?? 0), 0);
    return {
      spend,
      printLeads,
      emailLeads: sum(email, 'leads'),
      won: sum(all, 'won_cents'),
      cpl: printLeads ? spend / printLeads : null,
    };
  }, [rows]);

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Campaigns</h1>
          <p className={w.sub}>
            Everything you’ve sent — print and email — with who it reached and what came of it. Replies, leads and wins within {60} days of a send count towards it.
          </p>
        </div>
        <div className={w.headActions}>
          <Link href="/admin/crm/emails" className={p.btn}>Write an email</Link>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setCreating(true)}>Log a print campaign</button>
        </div>
      </div>

      {rows && (
        <div className={w.statRow}>
          <div className={w.stat}><p className={w.statLabel}>Print spend</p><p className={w.statValue}>{formatMoneyCents(totals.spend)}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Leads from print</p><p className={w.statValue}>{totals.printLeads}</p><p className={w.statNote}>{totals.cpl !== null ? `${formatMoneyCents(Math.round(totals.cpl))} per lead` : 'incl. QR inquiries'}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Leads from email</p><p className={w.statValue}>{totals.emailLeads}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Won from campaigns</p><p className={w.statValue}>{formatMoneyCents(totals.won)}</p></div>
        </div>
      )}

      <div className={w.toolbar}>
        <div className={w.chips} role="group" aria-label="Filter">
          {([['all', 'All'], ['print', 'Print'], ['email', 'Email']] as const).map(([v, label]) => (
            <button key={v} type="button" className={`${w.chip} ${filter === v ? w.chipOn : ''}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>{label}</button>
          ))}
        </div>
      </div>

      <div className={w.table} style={{ overflowX: 'auto' }}>
        <div className={`${w.row} ${w.rowHead}`} style={{ gridTemplateColumns: 'minmax(220px,1.6fr) repeat(5, minmax(78px, .6fr)) minmax(90px,.7fr)', minWidth: 760 }}>
          <span>Campaign</span><span>Reached</span><span>Responded</span><span>Leads</span><span>Won</span><span>Cost</span><span>Cost / lead</span>
        </div>
        {rows === null && <p className={w.empty}>Loading…</p>}
        {rows && visible.length === 0 && (
          <p className={w.empty}>{filter === 'print' || !rows.length ? 'No print campaigns yet. Log your first postcard or flyer — each one gets a QR code that tracks itself.' : 'Nothing here yet.'}</p>
        )}
        {visible.map((r) => {
          const leads = r.stats.leads + (r.kind === 'print' ? r.stats.inquiries ?? 0 : 0);
          return (
            <Link key={`${r.kind}:${r.id}`} href={r.href} className={`${w.row} ${w.rowClick}`} style={{ gridTemplateColumns: 'minmax(220px,1.6fr) repeat(5, minmax(78px, .6fr)) minmax(90px,.7fr)', minWidth: 760, color: 'inherit', textDecoration: 'none' }}>
              <span className={w.whoText}>
                <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
                <span className={w.muted} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, marginTop: 2 }}>
                  <span className={`${w.pill} ${r.kind === 'print' ? w.pillProspect : w.pillBlue}`}>{PIECE_LABEL[r.piece] ?? r.piece}</span>
                  {r.sent_on ? formatDate(r.sent_on) : r.kind === 'print' ? 'Not sent yet' : ''}
                  {r.kind === 'print' && r.stats.scans ? ` · ${r.stats.scans} scan${r.stats.scans === 1 ? '' : 's'}` : ''}
                </span>
              </span>
              <span className={w.nowrap}>{r.stats.reached}</span>
              <span className={w.nowrap}>{r.stats.responded} <span className={w.muted}>{pct(r.stats.responded, r.stats.reached)}</span></span>
              <span className={w.nowrap} style={{ fontWeight: leads ? 700 : undefined }}>{leads}</span>
              <span className={w.nowrap}>{r.stats.won ? formatMoneyCents(r.stats.won_cents) : '—'}</span>
              <span className={`${w.nowrap} ${w.muted}`}>{r.cost_cents != null ? formatMoneyCents(r.cost_cents) : r.kind === 'print' ? '—' : 'free'}</span>
              <span className={w.nowrap}>{r.cost_cents && leads ? formatMoneyCents(Math.round(r.cost_cents / leads)) : '—'}</span>
            </Link>
          );
        })}
      </div>

      {creating && (
        <NewPrintCampaign
          onClose={() => { setCreating(false); window.history.replaceState(null, '', '/admin/crm/campaigns'); }}
          onCreated={(id) => router.push(`/admin/crm/campaigns/${id}`)}
          notify={notify}
        />
      )}
    </div>
  );
}
