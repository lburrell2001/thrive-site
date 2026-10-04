'use client';

// Today: what needs Lauren now. Replies to answer first (a reply is the
// best signal there is), then follow-ups due, new inquiries, and deals
// that have gone quiet.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import w from './workspace.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from '../proposals/adminApi';
import { useCrm } from './CrmContext';
import { STAGE_LABEL, type CrmToday } from '@/types/crm';
import { avatarColor, initials, timeAgo, todayIso } from './shared';

function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function TodayPage() {
  const { openContact, version, refresh, notify } = useCrm();
  const [data, setData] = useState<CrmToday | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<CrmToday>('/api/crm/today')
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) notify(e instanceof Error ? e.message : 'Could not load today', 'error'); });
    return () => { cancelled = true; };
  }, [version, notify]);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    try { await fn(); if (ok) notify(ok); refresh(); } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  const today = todayIso();
  const nothing = data && !data.replies.length && !data.tasks.length && !data.inquiries.length && !data.quiet.length;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className={w.title}>{greeting()}, Lauren</h1>
          <p className={w.sub}>
            {!data ? 'Loading…' : nothing ? 'Nothing waiting on you. A good day to reach out to a few prospects.'
              : [
                data.replies.length && `${data.replies.length} ${data.replies.length === 1 ? 'reply' : 'replies'} to answer`,
                data.tasks.length && `${data.tasks.length} follow-up${data.tasks.length === 1 ? '' : 's'} due`,
                data.inquiries.length && `${data.inquiries.length} new inquir${data.inquiries.length === 1 ? 'y' : 'ies'}`,
              ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className={w.headActions}>
          <Link href="/admin/crm/prospects?add=1" className={p.btn}>Add prospects</Link>
          <Link href="/admin/crm/emails" className={`${p.btn} ${p.btnPrimary}`}>Write an email</Link>
        </div>
      </div>

      {data && (
        <div className={w.statRow}>
          <div className={w.stat}><p className={w.statLabel}>Open pipeline</p><p className={w.statValue}>{formatMoneyCents(data.pipeline_cents)}</p><p className={w.statNote}><Link href="/admin/crm/pipeline">See the board</Link></p></div>
          <div className={w.stat}><p className={w.statLabel}>Won this month</p><p className={w.statValue}>{formatMoneyCents(data.won_this_month_cents)}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Prospects</p><p className={w.statValue}>{data.prospects.total}</p><p className={w.statNote}>{data.prospects.never_emailed ? <Link href="/admin/crm/prospects">{data.prospects.never_emailed} not emailed yet</Link> : 'all emailed'}</p></div>
        </div>
      )}

      {data && (
        <div className={w.grid2}>
          <section className={w.card} style={{ gridColumn: data.replies.length ? '1 / -1' : undefined }}>
            <div className={w.cardHead}>
              <h2 className={w.cardTitle}>Replies</h2>
              {data.replies.length > 0 && <span className={`${w.cardCount} ${w.cardHot}`}>{data.replies.length}</span>}
            </div>
            {data.replies.length === 0 && <p className={w.empty}>No new replies. They’re forwarded to your inbox too — mark them done here once answered.</p>}
            {data.replies.map((r) => (
              <div key={r.id} className={w.item} style={{ cursor: 'default' }}>
                <span className={w.avatar} style={{ background: r.contact_id ? avatarColor(r.contact_id) : '#a19d97' }}>{initials(r.name)}</span>
                <button type="button" className={w.itemMain} style={{ all: 'unset', flex: 1, minWidth: 0, cursor: r.contact_id ? 'pointer' : 'default' }} onClick={() => r.contact_id && openContact(r.contact_id)}>
                  <span className={w.itemTitle}>{r.name}{r.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {r.company}</span> : null}</span>
                  <span className={w.itemSub}>{r.subject || '(no subject)'}{!r.contact_id ? ' · not in the CRM' : ''}{!r.forwarded ? ' · not forwarded' : ''}</span>
                  <span className={w.itemQuote}>{r.text || '(no text)'}</span>
                </button>
                <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                  <span className={w.itemWhen}>{timeAgo(r.received_at)}</span>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => act(() => apiSend(`/api/crm/replies/${r.id}`, 'PATCH', { handled: true }), 'Marked done.')}>Done</button>
                </span>
              </div>
            ))}
          </section>

          <section className={w.card}>
            <div className={w.cardHead}>
              <h2 className={w.cardTitle}>Follow-ups due</h2>
              {data.tasks.length > 0 && <span className={w.cardCount}>{data.tasks.length}</span>}
            </div>
            {data.tasks.length === 0 && <p className={w.empty}>Nothing due today.</p>}
            {data.tasks.map((t) => {
              const late = t.due_date && t.due_date < today;
              return (
                <div key={t.id} className={w.item} style={{ cursor: 'default', alignItems: 'center' }}>
                  <input type="checkbox" className={w.check} aria-label={`Mark "${t.title}" done`} onChange={() => act(() => apiSend(`/api/crm/tasks/${t.id}`, 'PATCH', { completed: true }), 'Done.')} />
                  <button type="button" className={w.itemMain} style={{ all: 'unset', flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openContact(t.contact_id)}>
                    <span className={w.itemTitle}>{t.title}</span>
                    <span className={w.itemSub}>{t.name}</span>
                  </button>
                  <span className={w.itemWhen} style={late ? { color: '#b91c1c', fontWeight: 700 } : undefined}>{t.due_date === today ? 'Today' : late ? `Overdue · ${formatDate(t.due_date)}` : formatDate(t.due_date)}</span>
                </div>
              );
            })}
          </section>

          <section className={w.card}>
            <div className={w.cardHead}>
              <h2 className={w.cardTitle}>New inquiries</h2>
              {data.inquiries.length > 0 && <span className={`${w.cardCount} ${w.cardHot}`}>{data.inquiries.length}</span>}
            </div>
            {data.inquiries.length === 0 && <p className={w.empty}>No unread inquiries.</p>}
            {data.inquiries.map((i) => (
              <button key={i.id} type="button" className={w.item} onClick={() => openContact(i.contact_id)}>
                <span className={w.avatar} style={{ background: avatarColor(i.contact_id) }}>{initials(i.name)}</span>
                <span className={w.itemMain}>
                  <span className={w.itemTitle}>{i.name}</span>
                  <span className={w.itemSub}>{i.project_type || 'Website inquiry'}</span>
                </span>
                <span className={w.itemWhen}>{timeAgo(i.created_at)}</span>
              </button>
            ))}
          </section>

          <section className={w.card}>
            <div className={w.cardHead}>
              <h2 className={w.cardTitle}>Gone quiet</h2>
              <span className={w.muted} style={{ fontSize: 12.5 }}>Open deals, nothing in 2+ weeks</span>
            </div>
            {data.quiet.length === 0 && <p className={w.empty}>Every open deal has been touched recently.</p>}
            {data.quiet.map((d) => (
              <button key={d.id} type="button" className={w.item} onClick={() => openContact(d.contact_id, d.id)}>
                <span className={w.avatar} style={{ background: avatarColor(d.contact_id) }}>{initials(d.name)}</span>
                <span className={w.itemMain}>
                  <span className={w.itemTitle}>{d.title}</span>
                  <span className={w.itemSub}>{d.name} · {STAGE_LABEL[d.stage]}</span>
                </span>
                <span className={w.itemWhen}>{timeAgo(d.last_touch_at)}</span>
              </button>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
