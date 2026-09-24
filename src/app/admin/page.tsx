'use client';

// Admin home: what needs attention today, each item one click from where
// it gets handled. Built from the same summary as the weekly digest.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from './proposals/proposals.module.css';
import s from './home.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from './proposals/adminApi';
import { Toast, useToast } from './proposals/Toast';
import { ReminderDialog } from './ReminderDialog';
import type { ReminderPreview, ReminderResult, ReminderTarget } from '@/lib/reminders';
import type { AdminSummary } from '@/types/adminSummary';
import { CRM_STAGES, STAGE_LABEL } from '@/types/crm';
import { STAGE_COLOR } from './crm/shared';

function ago(iso: string | null) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function change(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? 'same as last week' : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last week`;
}

interface Reminding {
  title: string;
  target: ReminderTarget;
}

export default function AdminHome() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [failed, setFailed] = useState('');
  const [reminding, setReminding] = useState<Reminding | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      setSummary(await apiGet<AdminSummary>('/api/dashboard'));
      setFailed('');
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Could not load the dashboard');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet<AdminSummary>('/api/dashboard')
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((error) => { if (!cancelled) setFailed(error instanceof Error ? error.message : 'Could not load the dashboard'); });
    return () => { cancelled = true; };
  }, []);

  async function complete(taskId: string) {
    setSummary((prev) => prev && { ...prev, followUps: prev.followUps.filter((t) => t.id !== taskId) });
    try {
      await apiSend(`/api/crm/tasks/${taskId}`, 'PATCH', { completed: true });
      show('Marked done.');
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not update task', 'error');
      void load();
    }
  }

  async function sendDigest() {
    setSendingDigest(true);
    try {
      const result = await apiSend<{ email: string; sms: string }>('/api/dashboard/digest', 'POST');
      show(`Digest ${result.email === 'sent' ? 'emailed' : `email ${result.email}`}${result.sms === 'sent' ? ' and texted' : ''}.`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not send the digest', 'error');
    }
    setSendingDigest(false);
  }

  const loadPreview = useCallback(
    () => apiSend<ReminderPreview>('/api/admin', 'POST', { action: 'reminder_preview', target: reminding?.target }),
    [reminding],
  );

  const d = summary;
  const dueNow = d?.followUps.filter((t) => t.due_date <= d.today) ?? [];
  const upcoming = d?.followUps.filter((t) => t.due_date > d.today) ?? [];

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>
              {d ? new Date(`${d.today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
            </h1>
            <p className={p.pageSub}>What needs you, and how the week is going.</p>
          </div>
          <button type="button" className={p.btn} onClick={sendDigest} disabled={sendingDigest || !d}>
            {sendingDigest ? 'Sending…' : 'Send me the weekly digest'}
          </button>
        </div>

        {!d ? (
          <p className={p.empty}>{failed || 'Loading…'}</p>
        ) : (
          <>
            <div className={s.tiles}>
              <Tile label="Follow-ups due" value={String(dueNow.length)} alert={dueNow.some((t) => t.overdue)} note={dueNow.some((t) => t.overdue) ? `${dueNow.filter((t) => t.overdue).length} overdue` : upcoming.length ? `${upcoming.length} more this week` : undefined} href="#follow-ups" />
              <Tile label="New inquiries" value={String(d.newInquiries.length)} alert={d.newInquiries.length > 0} href="#inquiries" />
              <Tile label="Awaiting signature" value={String(d.proposalsAwaiting.length)} href="#proposals" />
              <Tile label="Overdue invoices" value={formatMoneyCents(d.unpaidTotals.overdue_cents)} alert={d.unpaidTotals.overdue_cents > 0} note={d.unpaidTotals.due_cents ? `${formatMoneyCents(d.unpaidTotals.due_cents)} not yet due` : undefined} href="#invoices" />
              <Tile label="Open pipeline" value={formatMoneyCents(d.pipeline.open_value_cents)} note={`${formatMoneyCents(d.pipeline.won_this_month_cents)} won this month`} href="/admin/crm" />
              {d.traffic && (
                <Tile label="Visits this week" value={d.traffic.visits.toLocaleString()} note={change(d.traffic.visits, d.traffic.previous_visits) ?? undefined} href="/admin/analytics" />
              )}
            </div>

            <div className={s.grid}>
              <Panel id="follow-ups" title="Follow-ups" link={{ href: '/admin/crm', label: 'CRM' }} empty={d.followUps.length === 0 ? 'Nothing due this week.' : null}>
                {[...dueNow, ...upcoming].map((t) => (
                  <li key={t.id} className={s.item}>
                    <input type="checkbox" className={s.check} aria-label={`Mark "${t.title}" done`} onChange={() => complete(t.id)} />
                    <div className={s.itemMain}>
                      <Link href={`/admin/crm?contact=${t.contact_id}`} className={s.itemTitle}>{t.title}</Link>
                      <p className={s.itemSub}>{t.contact_name}</p>
                    </div>
                    <span className={`${s.when} ${t.overdue ? s.late : t.due_date === d.today ? s.today : ''}`}>
                      {t.overdue ? `Overdue · ${formatDate(t.due_date)}` : t.due_date === d.today ? 'Today' : formatDate(t.due_date)}
                    </span>
                  </li>
                ))}
              </Panel>

              <Panel id="inquiries" title="New inquiries" link={{ href: '/admin/crm', label: 'CRM' }} empty={d.newInquiries.length === 0 ? 'No unread inquiries.' : null}>
                {d.newInquiries.map((i) => (
                  <li key={i.id} className={s.item}>
                    <span className={s.dot} aria-hidden="true" />
                    <div className={s.itemMain}>
                      <Link href={i.contact_id ? `/admin/crm?contact=${i.contact_id}${i.deal_id ? `&deal=${i.deal_id}` : ''}` : '/admin/crm'} className={s.itemTitle}>
                        {i.name}{i.project_type ? ` · ${i.project_type}` : ''}
                      </Link>
                      <p className={s.itemSub}>{[i.budget && `Budget ${i.budget}`, i.source && `via ${i.source}`, i.email].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={s.when}>{ago(i.created_at)}</span>
                  </li>
                ))}
              </Panel>

              <Panel id="proposals" title="Waiting on a signature" link={{ href: '/admin/proposals', label: 'Proposals' }} empty={d.proposalsAwaiting.length === 0 ? 'Nothing out for signature.' : null}>
                {d.proposalsAwaiting.map((pr) => (
                  <li key={`${pr.kind}:${pr.id}`} className={s.item}>
                    <div className={s.itemMain}>
                      <Link href={pr.kind === 'builder' ? `/admin/proposals/${pr.id}/edit` : `/admin/clients?client=${pr.client_id}`} className={s.itemTitle}>{pr.title}</Link>
                      <p className={s.itemSub}>
                        {[
                          pr.client_name,
                          pr.total_cents != null && formatMoneyCents(pr.total_cents, pr.currency),
                          pr.kind === 'builder' ? (pr.viewed ? 'opened' : 'not opened yet') : 'uploaded PDF',
                          pr.since && `sent ${ago(pr.since)}`,
                          pr.last_reminded_at && `reminded ${ago(pr.last_reminded_at)}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${p.btn} ${p.btnSmall}`}
                      onClick={() => setReminding({
                        title: 'Remind about proposal',
                        target: pr.kind === 'builder' ? { kind: 'proposal', id: pr.id } : { kind: 'portal_proposal', id: pr.id },
                      })}
                    >
                      Remind
                    </button>
                  </li>
                ))}
              </Panel>

              <Panel id="invoices" title="Unpaid invoices" link={null} empty={d.unpaidInvoices.length === 0 ? 'Everything is paid.' : null}>
                {d.unpaidInvoices.map((inv) => (
                  <li key={inv.id} className={s.item}>
                    <div className={s.itemMain}>
                      <Link href={`/admin/clients?client=${inv.client_id}`} className={s.itemTitle}>
                        {inv.client_name} · {formatMoneyCents(inv.amount_cents)}
                      </Link>
                      <p className={s.itemSub}>
                        {[inv.invoice_number, inv.project_name, inv.last_reminded_at && `reminded ${ago(inv.last_reminded_at)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`${s.when} ${inv.overdue ? s.late : ''}`}>{inv.overdue ? 'Overdue' : 'Due'} {formatDate(inv.due_date)}</span>
                    <button
                      type="button"
                      className={`${p.btn} ${p.btnSmall}`}
                      onClick={() => setReminding({ title: 'Remind about invoice', target: { kind: 'invoice', id: inv.id } })}
                    >
                      Remind
                    </button>
                  </li>
                ))}
              </Panel>

              <Panel id="pipeline" title="Pipeline" link={{ href: '/admin/crm', label: 'Board' }} empty={null}>
                {CRM_STAGES.map((stage) => {
                  const row = d.pipeline.stages[stage];
                  return (
                    <li key={stage} className={s.item}>
                      <span className={s.stageDot} style={{ background: STAGE_COLOR[stage] }} aria-hidden="true" />
                      <div className={s.itemMain}><span className={s.itemTitlePlain}>{STAGE_LABEL[stage]}</span></div>
                      <span className={s.num}>{row.count}</span>
                      <span className={`${s.num} ${s.value}`}>{row.value_cents ? formatMoneyCents(row.value_cents) : '—'}</span>
                    </li>
                  );
                })}
              </Panel>

              <Panel id="traffic" title="This week on the site" link={{ href: '/admin/analytics', label: 'Analytics' }} empty={d.traffic ? null : 'Analytics could not load.'}>
                {d.traffic && (
                  <>
                    <li className={s.item}>
                      <div className={s.itemMain}>
                        <span className={s.itemTitlePlain}>{d.traffic.visits.toLocaleString()} visits · {d.traffic.inquiries} inquir{d.traffic.inquiries === 1 ? 'y' : 'ies'}</span>
                        <p className={s.itemSub}>
                          {[
                            change(d.traffic.visits, d.traffic.previous_visits),
                            d.traffic.top_source && `most from ${d.traffic.top_source.source} (${d.traffic.top_source.visits})`,
                          ].filter(Boolean).join(' · ') || 'Last 7 days'}
                        </p>
                      </div>
                    </li>
                    {d.traffic.top_insight && (
                      <li className={s.insight}>
                        <p className={s.insightLabel}>Top suggestion</p>
                        <p className={s.itemTitlePlain}>{d.traffic.top_insight.title}</p>
                        {d.traffic.top_insight.actions[0] && <p className={s.itemSub}>{d.traffic.top_insight.actions[0]}</p>}
                      </li>
                    )}
                  </>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>

      {reminding && (
        <ReminderDialog
          key={JSON.stringify(reminding.target)}
          title={reminding.title}
          loadPreview={loadPreview}
          send={(input) =>
            apiSend<ReminderResult>('/api/admin', 'POST', {
              action: 'send_reminder',
              target: reminding.target,
              channels: input.channels,
              note: input.note,
            })
          }
          saveContact={async (proposalClientId, phone, smsOptIn) => {
            await apiSend(`/api/proposal-clients/${proposalClientId}`, 'PATCH', { phone, sms_opt_in: smsOptIn });
          }}
          onClose={() => setReminding(null)}
          onSent={() => void load()}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

function Tile({ label, value, note, alert, href }: { label: string; value: string; note?: string; alert?: boolean; href: string }) {
  return (
    <a href={href} className={`${s.tile} ${alert ? s.tileAlert : ''}`}>
      <span className={s.tileLabel}>{label}</span>
      <span className={s.tileValue}>{value}</span>
      {note && <span className={s.tileNote}>{note}</span>}
    </a>
  );
}

function Panel({ id, title, link, empty, children }: {
  id: string;
  title: string;
  link: { href: string; label: string } | null;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={s.panel}>
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>{title}</h2>
        {link && <Link href={link.href} className={s.panelLink}>{link.label} →</Link>}
      </div>
      {empty ? <p className={s.empty}>{empty}</p> : <ul className={s.list}>{children}</ul>}
    </section>
  );
}
