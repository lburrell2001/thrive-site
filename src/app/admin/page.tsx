'use client';

// Home: everything that needs Lauren today, in one place. Replies to answer
// first (the best signal there is), then follow-ups, new inquiries, calls,
// money waiting on her (signatures, unpaid invoices), deals gone quiet,
// reviews, and how the pipeline and the site are doing. Built from the same
// summary as the weekly digest (/api/dashboard) plus the CRM's Today feed.
// Clicking a person opens them in the contact panel, right here.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from './proposals/proposals.module.css';
import w from './crm/workspace.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from './proposals/adminApi';
import { useCrm } from './crm/CrmContext';
import { ReminderDialog } from './ReminderDialog';
import { MeetingLink } from './crm/MeetingLink';
import { STAGE_COLOR, avatarColor, initials, timeAgo } from './crm/shared';
import type { ReminderPreview, ReminderResult, ReminderTarget } from '@/lib/reminders';
import type { AdminSummary } from '@/types/adminSummary';
import { CRM_STAGES, STAGE_LABEL, type CrmToday } from '@/types/crm';

function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function change(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? 'same as last week' : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last week`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Reminding { title: string; target: ReminderTarget }

export default function AdminHome() {
  const { openContact, contacts, version, refresh, notify } = useCrm();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [today, setToday] = useState<CrmToday | null>(null);
  const [failed, setFailed] = useState('');
  const [reminding, setReminding] = useState<Reminding | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<AdminSummary>('/api/dashboard'), apiGet<CrmToday>('/api/crm/today')])
      .then(([s, t]) => { if (!cancelled) { setSummary(s); setToday(t); setFailed(''); } })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error ? e.message : 'Could not load'); });
    return () => { cancelled = true; };
  }, [version]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notify(ok); refresh(); } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  async function sendDigest() {
    setSendingDigest(true);
    try {
      const result = await apiSend<{ email: string; sms: string }>('/api/dashboard/digest', 'POST');
      notify(`Digest ${result.email === 'sent' ? 'emailed' : `email ${result.email}`}${result.sms === 'sent' ? ' and texted' : ''}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send the digest', 'error');
    }
    setSendingDigest(false);
  }

  const loadPreview = useCallback(
    () => apiSend<ReminderPreview>('/api/admin', 'POST', { action: 'reminder_preview', target: reminding?.target }),
    [reminding],
  );

  /** A portal client's contact panel when there is one, else their client page. */
  const portalContact = (clientId: string | null) => (clientId ? contacts?.find((c) => c.portal_client_id === clientId) ?? null : null);
  function openClient(clientId: string | null) {
    const contact = portalContact(clientId);
    if (contact) openContact(contact.id, null, 'client');
    else if (clientId) window.location.assign(`/admin/clients?client=${clientId}`);
  }

  const d = summary;
  const dueNow = d?.followUps.filter((t) => t.due_date <= d.today) ?? [];
  const upcoming = d?.followUps.filter((t) => t.due_date > d.today) ?? [];
  const overdue = dueNow.filter((t) => t.overdue).length;
  const replies = today?.replies ?? [];

  const line = d && today ? [
    replies.length && plural(replies.length, 'reply', 'replies') + ' to answer',
    dueNow.length && plural(dueNow.length, 'follow-up', 'follow-ups') + ' due',
    d.newInquiries.length && plural(d.newInquiries.length, 'new inquiry', 'new inquiries'),
    d.unpaidTotals.overdue_cents > 0 && `${formatMoneyCents(d.unpaidTotals.overdue_cents)} overdue`,
  ].filter(Boolean).join(' · ') || 'Nothing waiting on you. A good day to reach out to a few prospects.' : null;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>{greeting()}, Lauren</h1>
          <p className={w.sub}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}
            {line ? ` · ${line}` : failed ? ` · ${failed}` : ' · Loading…'}
          </p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={p.btn} onClick={sendDigest} disabled={sendingDigest || !d}>
            {sendingDigest ? 'Sending…' : 'Email me the weekly digest'}
          </button>
          <Link href="/admin/crm/prospects?add=1" className={p.btn}>Add prospects</Link>
          <Link href="/admin/crm/emails" className={`${p.btn} ${p.btnPrimary}`}>Write an email</Link>
        </div>
      </div>

      {d && today && (
        <>
          <div className={w.statRow}>
            <Stat label="Follow-ups due" value={String(dueNow.length)} note={overdue ? `${overdue} overdue` : upcoming.length ? `${upcoming.length} more this week` : 'all clear'} hot={overdue > 0} href="#follow-ups" />
            <Stat label="New inquiries" value={String(d.newInquiries.length)} hot={d.newInquiries.length > 0} href="#inquiries" />
            <Stat label="Awaiting signature" value={String(d.proposalsAwaiting.length)} href="#signatures" />
            <Stat label="Overdue invoices" value={formatMoneyCents(d.unpaidTotals.overdue_cents)} hot={d.unpaidTotals.overdue_cents > 0} note={d.unpaidTotals.due_cents ? `${formatMoneyCents(d.unpaidTotals.due_cents)} not yet due` : undefined} href="#invoices" />
            <Stat label="Open pipeline" value={formatMoneyCents(d.pipeline.open_value_cents)} note={`${formatMoneyCents(d.pipeline.won_this_month_cents)} won this month`} href="/admin/crm/pipeline" />
            {d.traffic && <Stat label="Visits this week" value={d.traffic.visits.toLocaleString()} note={change(d.traffic.visits, d.traffic.previous_visits) ?? undefined} href="/admin/analytics" />}
          </div>

          <div className={w.grid2}>
            {replies.length > 0 && (
              <Card id="replies" title="Replies" count={replies.length} hot wide>
                {replies.map((r) => (
                  <div key={r.id} className={w.item} style={{ cursor: 'default' }}>
                    <span className={w.avatar} style={{ background: r.contact_id ? avatarColor(r.contact_id) : '#a19d97' }}>{initials(r.name)}</span>
                    <button type="button" className={w.itemMain} style={{ all: 'unset', flex: 1, minWidth: 0, cursor: r.contact_id ? 'pointer' : 'default' }} onClick={() => r.contact_id && openContact(r.contact_id)}>
                      <span className={w.itemTitle}>{r.name}{r.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {r.company}</span> : null}</span>
                      <span className={w.itemSub}>{r.subject || '(no subject)'}{!r.contact_id ? ' · not in the CRM' : ''}</span>
                      <span className={w.itemQuote}>{r.text || '(no text)'}</span>
                    </button>
                    <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                      <span className={w.itemWhen}>{timeAgo(r.received_at)}</span>
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => act(() => apiSend(`/api/crm/replies/${r.id}`, 'PATCH', { handled: true }), 'Marked done.')}>Done</button>
                    </span>
                  </div>
                ))}
              </Card>
            )}

            <Card id="follow-ups" title="Follow-ups" count={dueNow.length} empty={d.followUps.length ? null : 'Nothing due this week.'}>
              {[...dueNow, ...upcoming].map((t) => (
                <div key={t.id} className={w.item} style={{ cursor: 'default', alignItems: 'center' }}>
                  <input type="checkbox" className={w.check} aria-label={`Mark "${t.title}" done`} onChange={() => act(() => apiSend(`/api/crm/tasks/${t.id}`, 'PATCH', { completed: true }), 'Done.')} />
                  <button type="button" className={w.itemMain} style={{ all: 'unset', flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openContact(t.contact_id)}>
                    <span className={w.itemTitle}>{t.title}</span>
                    <span className={w.itemSub}>{t.contact_name}</span>
                  </button>
                  <span className={w.itemWhen} style={t.overdue ? { color: 'var(--a-danger)', fontWeight: 700 } : t.due_date === d.today ? { color: 'var(--a-accent)', fontWeight: 700 } : undefined}>
                    {t.overdue ? `Overdue · ${formatDate(t.due_date)}` : t.due_date === d.today ? 'Today' : formatDate(t.due_date)}
                  </span>
                </div>
              ))}
            </Card>

            <Card id="inquiries" title="New inquiries" count={d.newInquiries.length} hot empty={d.newInquiries.length ? null : 'No unread inquiries.'}>
              {d.newInquiries.map((i) => (
                <button key={i.id} type="button" className={w.item} onClick={() => i.contact_id && openContact(i.contact_id, i.deal_id)}>
                  <span className={w.avatar} style={{ background: avatarColor(i.contact_id ?? i.id) }}>{initials(i.name)}</span>
                  <span className={w.itemMain}>
                    <span className={w.itemTitle}>{i.name}{i.project_type ? <span className={w.muted} style={{ fontWeight: 500 }}> · {i.project_type}</span> : null}</span>
                    <span className={w.itemSub}>{[i.budget && `Budget ${i.budget}`, i.source && `via ${i.source}`, i.email].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={w.itemWhen}>{timeAgo(i.created_at)}</span>
                </button>
              ))}
            </Card>

            <Card id="calls" title="Calls & meetings" count={d.upcomingCalls.length} link={{ href: '/admin/crm/calls', label: 'Calls' }} empty={d.upcomingCalls.length ? null : 'Nothing booked or on your calendar this week.'}>
              {d.upcomingCalls.map((c) => {
                const time = new Date(c.starts_at).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' });
                if (c.kind !== 'meeting') return (
                  <button key={c.id} type="button" className={w.item} onClick={() => c.contact_id && openContact(c.contact_id)}>
                    <span className={w.avatar} style={{ background: avatarColor(c.contact_id ?? c.id) }}>{initials(c.name)}</span>
                    <span className={w.itemMain}>
                      <span className={w.itemTitle}>{c.name}{c.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {c.company}</span> : null}</span>
                      <span className={w.itemSub}>{c.notes ? `Booked call · “${c.notes.length > 100 ? `${c.notes.slice(0, 100)}…` : c.notes}”` : 'Booked call'}</span>
                    </span>
                    <span className={w.itemWhen}>{time}</span>
                  </button>
                );
                const open = () => { if (c.contact_id) openContact(c.contact_id); };
                return (
                  <div key={c.id} className={w.item} role={c.contact_id ? 'button' : undefined} tabIndex={c.contact_id ? 0 : undefined}
                    style={{ cursor: c.contact_id ? 'pointer' : 'default' }} onClick={open}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }}>
                    <span className={w.avatar} style={{ background: c.contact_id ? avatarColor(c.contact_id) : '#9a958f' }}>{c.contact_id ? initials(c.name) : '◷'}</span>
                    <span className={w.itemMain}>
                      <span className={w.itemTitle}>{c.name}{c.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {c.company}</span> : null}</span>
                      <span className={w.itemSub}>
                        {[c.contact_id ? c.subject : null, 'Outlook calendar', c.matched_by === 'name' && 'matched by name'].filter(Boolean).join(' · ')}
                        {c.join_url && <> · <a href={c.join_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Join</a></>}
                      </span>
                    </span>
                    <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                      <span className={w.itemWhen}>{time}</span>
                      {c.event_id && <MeetingLink eventId={c.event_id} contactId={c.contact_id} matchedBy={c.matched_by} onDone={refresh} />}
                    </span>
                  </div>
                );
              })}
            </Card>

            <Card id="signatures" title="Waiting on a signature" count={d.proposalsAwaiting.length} link={{ href: '/admin/crm/proposals', label: 'Proposals' }} empty={d.proposalsAwaiting.length ? null : 'Nothing out for signature.'}>
              {d.proposalsAwaiting.map((pr) => (
                <div key={`${pr.kind}:${pr.id}`} className={w.item} style={{ cursor: 'default', alignItems: 'center' }}>
                  <div className={w.itemMain}>
                    {pr.kind === 'builder'
                      ? <Link href={`/admin/crm/proposals/${pr.id}/edit`} className={w.itemTitle} style={{ color: 'inherit', textDecoration: 'none' }}>{pr.title}</Link>
                      : <button type="button" className={w.itemTitle} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }} onClick={() => openClient(pr.client_id)}>{pr.title}</button>}
                    <p className={w.itemSub}>
                      {[
                        pr.client_name,
                        pr.total_cents != null && formatMoneyCents(pr.total_cents, pr.currency),
                        pr.kind === 'builder' ? (pr.viewed ? 'opened' : 'not opened yet') : 'uploaded PDF',
                        pr.since && `sent ${timeAgo(pr.since)}`,
                        pr.last_reminded_at && `reminded ${timeAgo(pr.last_reminded_at)}`,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setReminding({
                    title: 'Remind about proposal',
                    target: pr.kind === 'builder' ? { kind: 'proposal', id: pr.id } : { kind: 'portal_proposal', id: pr.id },
                  })}>Remind</button>
                </div>
              ))}
            </Card>

            <Card id="invoices" title="Unpaid invoices" count={d.unpaidInvoices.length} link={{ href: '/admin/invoices', label: 'Invoices' }} empty={d.unpaidInvoices.length ? null : 'Everything is paid.'}>
              {d.unpaidInvoices.map((inv) => (
                <div key={inv.id} className={w.item} style={{ cursor: 'default', alignItems: 'center' }}>
                  <button type="button" className={w.itemMain} style={{ all: 'unset', flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openClient(inv.client_id)}>
                    <span className={w.itemTitle}>{inv.client_name} · {formatMoneyCents(inv.amount_cents)}</span>
                    <span className={w.itemSub}>{[inv.invoice_number, inv.project_name, inv.last_reminded_at && `reminded ${timeAgo(inv.last_reminded_at)}`].filter(Boolean).join(' · ')}</span>
                  </button>
                  <span className={w.itemWhen} style={inv.overdue ? { color: 'var(--a-danger)', fontWeight: 700 } : undefined}>{inv.overdue ? 'Overdue' : 'Due'} {formatDate(inv.due_date)}</span>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setReminding({ title: 'Remind about invoice', target: { kind: 'invoice', id: inv.id } })}>Remind</button>
                </div>
              ))}
            </Card>

            <Card id="quiet" title="Gone quiet" note="Open deals, nothing in 2+ weeks" empty={today.quiet.length ? null : 'Every open deal has been touched recently.'}>
              {today.quiet.map((q) => (
                <button key={q.id} type="button" className={w.item} onClick={() => openContact(q.contact_id, q.id)}>
                  <span className={w.avatar} style={{ background: avatarColor(q.contact_id) }}>{initials(q.name)}</span>
                  <span className={w.itemMain}>
                    <span className={w.itemTitle}>{q.title}</span>
                    <span className={w.itemSub}>{q.name} · {STAGE_LABEL[q.stage]}</span>
                  </span>
                  <span className={w.itemWhen}>{timeAgo(q.last_touch_at)}</span>
                </button>
              ))}
            </Card>

            <Card id="reviews" title="Reviews" link={{ href: '/admin/reviews', label: 'Reviews' }} empty={d.reviewsToApprove.length || d.reviewCandidates.length ? null : 'Nothing to approve, and no recent wins waiting for a review request.'}>
              {d.reviewsToApprove.map((r) => (
                <Link key={r.id} href="/admin/reviews" className={w.item} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className={w.itemMain}>
                    <span className={w.itemTitle}>{r.display_name ?? 'Client'}{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}: approve?</span>
                    {r.body && <span className={w.itemSub}>“{r.body.length > 110 ? `${r.body.slice(0, 110)}…` : r.body}”</span>}
                  </span>
                  <span className={w.itemWhen}>{timeAgo(r.submitted_at)}</span>
                </Link>
              ))}
              {d.reviewCandidates.map((c) => (
                <button key={c.deal_id} type="button" className={w.item} onClick={() => openContact(c.contact_id, c.deal_id)}>
                  <span className={w.itemMain}>
                    <span className={w.itemTitle}>Ask {c.contact_name} for a review</span>
                    <span className={w.itemSub}>{c.deal_title} · won {timeAgo(c.won_at)}</span>
                  </span>
                </button>
              ))}
            </Card>

            <Card id="pipeline" title="Pipeline" link={{ href: '/admin/crm/pipeline', label: 'Board' }} empty={null}>
              {CRM_STAGES.map((stage) => {
                const row = d.pipeline.stages[stage];
                return (
                  <Link key={stage} href="/admin/crm/pipeline" className={w.item} style={{ color: 'inherit', textDecoration: 'none', alignItems: 'center' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: STAGE_COLOR[stage], flexShrink: 0 }} aria-hidden="true" />
                    <span className={w.itemMain}><span className={w.itemTitle} style={{ fontWeight: 600 }}>{STAGE_LABEL[stage]}</span></span>
                    <span className={w.itemWhen} style={{ fontVariantNumeric: 'tabular-nums' }}>{row.count} · {row.value_cents ? formatMoneyCents(row.value_cents) : '—'}</span>
                  </Link>
                );
              })}
            </Card>

            <Card id="traffic" title="This week on the site" link={{ href: '/admin/analytics', label: 'Analytics' }} empty={d.traffic ? null : 'Analytics could not load.'}>
              {d.traffic && (
                <>
                  <div className={w.item} style={{ cursor: 'default' }}>
                    <span className={w.itemMain}>
                      <span className={w.itemTitle}>{d.traffic.visits.toLocaleString()} visits · {plural(d.traffic.inquiries, 'inquiry', 'inquiries')}</span>
                      <span className={w.itemSub}>
                        {[change(d.traffic.visits, d.traffic.previous_visits), d.traffic.top_source && `most from ${d.traffic.top_source.source} (${d.traffic.top_source.visits})`].filter(Boolean).join(' · ') || 'Last 7 days'}
                      </span>
                    </span>
                  </div>
                  {d.traffic.top_insight && (
                    <div className={w.item} style={{ cursor: 'default', background: 'var(--a-surface-2)' }}>
                      <span className={w.itemMain}>
                        <span className={w.itemTitle}>Idea: {d.traffic.top_insight.title}</span>
                        {d.traffic.top_insight.actions[0] && <span className={w.itemSub}>{d.traffic.top_insight.actions[0]}</span>}
                      </span>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {reminding && (
        <ReminderDialog
          key={JSON.stringify(reminding.target)}
          title={reminding.title}
          loadPreview={loadPreview}
          send={(input) => apiSend<ReminderResult>('/api/admin', 'POST', {
            action: 'send_reminder', target: reminding.target, channels: input.channels, note: input.note,
          })}
          saveContact={async (proposalClientId, phone, smsOptIn) => {
            await apiSend(`/api/proposal-clients/${proposalClientId}`, 'PATCH', { phone, sms_opt_in: smsOptIn });
          }}
          onClose={() => setReminding(null)}
          onSent={refresh}
        />
      )}
    </div>
  );
}

function Stat({ label, value, note, hot, href }: { label: string; value: string; note?: string; hot?: boolean; href: string }) {
  return (
    <a href={href} className={w.stat} style={{ color: 'inherit', textDecoration: 'none', borderColor: hot ? '#f6b3d6' : undefined }}>
      <p className={w.statLabel}>{label}</p>
      <p className={w.statValue} style={hot ? { color: 'var(--a-accent)' } : undefined}>{value}</p>
      {note && <p className={w.statNote}>{note}</p>}
    </a>
  );
}

function Card({ id, title, count, hot, note, link, empty, wide, children }: {
  id: string;
  title: string;
  count?: number;
  hot?: boolean;
  note?: string;
  link?: { href: string; label: string };
  empty?: string | null;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={w.card} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div className={w.cardHead}>
        <h2 className={w.cardTitle}>{title}</h2>
        {count ? <span className={`${w.cardCount} ${hot ? w.cardHot : ''}`}>{count}</span> : null}
        {note && <span className={w.muted} style={{ fontSize: 12.5 }}>{note}</span>}
        {link && <Link href={link.href} className={w.cardLink}>{link.label} →</Link>}
      </div>
      {empty ? <p className={w.empty}>{empty}</p> : children}
    </section>
  );
}
