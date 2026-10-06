'use client';

// One contact: stage and value up top, then follow-up tasks, a place to log
// notes and calls, and a timeline of everything that has happened with them
// across the site — inquiries, messages, proposals, invoices.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from '../proposals/adminApi';
import { ReminderDialog } from '../ReminderDialog';
import type { ReminderPreview, ReminderResult } from '@/lib/reminders';
import { formatPhone } from '@/lib/phone';
import {
  ACTIVITY_KINDS,
  CRM_STAGES,
  STAGE_LABEL,
  type CrmActivityKind,
  type CrmContact,
  type CrmContactDetail,
  type CrmDeal,
  type CrmStage,
  type TimelineKind,
} from '@/types/crm';
import { LIFECYCLE_LABEL, STAGE_COLOR, avatarColor, initials, lifecycleOf, parseDollars, timeAgo, todayIso } from './shared';
import w from './workspace.module.css';
import { ReviewRequestDialog } from './ReviewRequestDialog';
import { EmailDialog } from './EmailDialog';
import { runContactAction } from './contactActions';

const KIND_LABEL: Record<CrmActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
};

const EVENT_COLOR: Record<TimelineKind, string> = {
  note: '#808080',
  call: '#1e3add',
  meeting: '#1e3add',
  email: '#1e3add',
  stage: '#111',
  inquiry: '#e40586',
  message: '#fd6100',
  proposal: '#5b2d8e',
  portal_proposal: '#5b2d8e',
  invoice: '#1a8a4a',
  review: '#e40586',
  newsletter: '#0f766e',
  prospect: '#fd6100',
  reply: '#0a8f4f',
  print: '#9409ce',
};

/** How a deal came to be, for "Opened … from …". Manual deals say nothing. */
const DEAL_SOURCE: Record<string, string> = {
  inquiry: 'a website inquiry',
  proposal: 'a proposal',
  portal: 'the portal',
  'email reply': 'a reply to your email',
  booking: 'a booked call',
  print: 'a print campaign',
};

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function dollars(cents: number | null) {
  return cents == null ? '' : String(cents / 100);
}

export function ContactDrawer({ id, focusDealId, onClose, onChanged, onDeleted, notify }: {
  id: string;
  /** The deal whose card was clicked: highlighted and scrolled to. */
  focusDealId?: string | null;
  onClose: () => void;
  /** Something on the board may have changed — stage, value, tasks. */
  onChanged: () => void;
  onDeleted: () => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<CrmContactDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [messaging, setMessaging] = useState(false);
  const [prospecting, setProspecting] = useState(false);
  const [tab, setTab] = useState<'overview' | 'activity' | 'details'>('overview');
  const [busy, setBusy] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<CrmContactDetail>(`/api/crm/contacts/${id}`);
      setDetail(data);
      setLoadError('');
      return data;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load contact');
      return null;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await reload();
      // Opening the contact is reading their new inquiries.
      if (!cancelled && data?.inquiries.some((i) => i.status === 'new')) {
        await apiSend(`/api/crm/contacts/${id}/seen`, 'POST').catch(() => {});
        onChanged();
      }
    })();
    return () => { cancelled = true; };
  }, [id, reload, onChanged]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !messaging && !prospecting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, messaging, prospecting]);

  const save = useCallback(async (patch: Partial<CrmContact>, okMessage?: string) => {
    try {
      const updated = await apiSend<CrmContact>(`/api/crm/contacts/${id}`, 'PATCH', patch);
      setDetail((d) => (d ? { ...d, contact: updated } : d));
      if (okMessage) notify(okMessage);
      onChanged();
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save', 'error');
      return false;
    }
  }, [id, notify, onChanged]);

  const saveDeal = useCallback(async (dealId: string, patch: Partial<CrmDeal>, okMessage?: string) => {
    try {
      const updated = await apiSend<CrmDeal>(`/api/crm/deals/${dealId}`, 'PATCH', patch);
      setDetail((d) => (d ? { ...d, deals: d.deals.map((x) => (x.id === dealId ? updated : x)) } : d));
      if (okMessage) notify(okMessage);
      onChanged();
      // A stage change adds a timeline entry.
      if (patch.stage) void reload();
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save deal', 'error');
      return false;
    }
  }, [notify, onChanged, reload]);

  const loadPreview = useCallback(
    () => apiSend<ReminderPreview>('/api/admin', 'POST', { action: 'reminder_preview', target: { kind: 'crm_contact', id } }),
    [id],
  );

  async function startProposal() {
    setBusy('proposal');
    try {
      const recipient = await apiSend<{ id: string }>(`/api/crm/contacts/${id}/recipient`, 'POST');
      router.push(`/admin/proposals/new?client=${recipient.id}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not start a proposal', 'error');
      setBusy('');
    }
  }

  async function createPortal() {
    const c = detail?.contact;
    if (!c) return;
    if (!window.confirm(`Create a portal login for ${c.email}? Their open deal will be marked Won.`)) return;
    setBusy('portal');
    try {
      await apiSend(`/api/crm/contacts/${id}/portal`, 'POST');
      notify('Portal account created.');
      await reload();
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create portal account', 'error');
    }
    setBusy('');
  }

  async function remove() {
    const c = detail?.contact;
    if (!c) return;
    setBusy('delete');
    if (await runContactAction({ action: 'delete' }, [id], c.name || c.email || 'this contact', notify)) onDeleted();
    else setBusy('');
  }

  async function moveTo(to: 'lead' | 'prospect') {
    const c = detail?.contact;
    if (!c) return;
    setBusy('move');
    if (await runContactAction({ action: 'move', to }, [id], c.name || c.email || 'this contact', notify)) {
      await reload();
      onChanged();
    }
    setBusy('');
  }

  async function setProspect(on: boolean) {
    const ok = await save({ prospect_status: on ? 'prospect' : null } as Partial<CrmContact>, on ? 'Added to Prospects.' : 'Taken off Prospects.');
    if (ok) void reload();
  }

  const c = detail?.contact;
  const stage = c && detail ? lifecycleOf({
    portal_client_id: c.portal_client_id,
    won_deals: detail.deals.filter((d) => d.stage === 'won').length,
    open_deals: detail.deals.filter((d) => ['lead', 'contacted', 'proposal'].includes(d.stage)).length,
    prospect_status: c.prospect_status,
  }) : null;
  const sent = detail?.timeline.filter((t) => t.kind === 'prospect' || t.kind === 'newsletter') ?? [];
  const replies = detail?.timeline.filter((t) => t.kind === 'reply') ?? [];

  return (
    <>
      <div className={s.backdrop} onClick={onClose} />
      <aside className={`${s.drawer} ${s.panel}`} role="dialog" aria-modal="true" aria-labelledby="crm-drawer-title">
        {!detail ? (
          <div className={s.drawerHead}>
            <div className={s.drawerTitleRow}>
              <p id="crm-drawer-title" className={s.drawerSub}>{loadError || 'Loading…'}</p>
              <button type="button" className={s.close} onClick={onClose} aria-label="Close">×</button>
            </div>
          </div>
        ) : c && (
          <>
            <div className={s.drawerHead}>
              <div className={s.drawerTitleRow}>
                <div className={s.panelWho}>
                  <span className={`${w.avatar} ${w.avatarLg}`} style={{ background: avatarColor(c.id) }} aria-hidden="true">{initials(c.name, c.email)}</span>
                  <div style={{ minWidth: 0 }}>
                    <h2 id="crm-drawer-title" className={s.drawerTitle}>
                      {c.name || c.email || 'Unnamed'}
                      {stage && <span className={`${w.pill} ${w[`pill${LIFECYCLE_LABEL[stage]}` as 'pillLead']}`} style={{ marginLeft: 10, verticalAlign: 'middle' }}><span className={w.pillDot} />{LIFECYCLE_LABEL[stage]}</span>}
                    </h2>
                    <p className={s.drawerSub}>
                      {[c.company, c.email, c.phone && formatPhone(c.phone)].filter(Boolean).join(' · ') || 'No contact details yet'}
                      {c.website && <> · <a href={/^https?:/i.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">{c.website.replace(/^https?:\/\//, '')}</a></>}
                    </p>
                  </div>
                </div>
                <button type="button" className={s.close} onClick={onClose} aria-label="Close">×</button>
              </div>

              <div className={s.actions}>
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} onClick={() => setProspecting(true)} disabled={!c.email}>
                  ✉ Email
                </button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setMessaging(true)} disabled={!c.email && !c.phone && !c.portal_client_id}>
                  Quick message
                </button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={startProposal} disabled={busy === 'proposal'}>
                  New proposal
                </button>
                {detail.portal ? (
                  <Link href={`/admin/clients?client=${detail.portal.id}`} className={`${p.btn} ${p.btnSmall}`}>Client page</Link>
                ) : stage === 'prospect' ? (
                  <>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => moveTo('lead')} disabled={busy === 'move'}>Move to Leads</button>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setProspect(false)}>Not a prospect</button>
                  </>
                ) : stage === 'contact' ? (
                  <>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setProspect(true)}>Make prospect</button>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => moveTo('lead')} disabled={busy === 'move'}>Make lead</button>
                  </>
                ) : (
                  <>
                    {stage === 'lead' && (
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => moveTo('prospect')} disabled={busy === 'move'}>Move to Prospects</button>
                    )}
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={createPortal} disabled={busy === 'portal'}>
                      {busy === 'portal' ? 'Creating…' : 'Create portal login'}
                    </button>
                  </>
                )}
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={remove} disabled={busy === 'delete'}>Delete</button>
              </div>

              <div className={s.panelStats}>
                <span><strong>{sent.length}</strong> email{sent.length === 1 ? '' : 's'} sent{sent[0] ? ` · last ${timeAgo(sent[0].at)}` : ''}</span>
                <span><strong>{replies.length}</strong> repl{replies.length === 1 ? 'y' : 'ies'}{c.replied_at ? ` · last ${timeAgo(c.replied_at)}` : ''}</span>
                {detail.portal ? (
                  <span>Paid <strong>{formatMoneyCents(detail.portal.paid_cents)}</strong>{detail.portal.outstanding_cents ? ` · ${formatMoneyCents(detail.portal.outstanding_cents)} due` : ''}</span>
                ) : (
                  <span>Added <strong>{formatDate(c.created_at)}</strong></span>
                )}
              </div>

              <div className={w.tabs} role="tablist" aria-label="Contact" style={{ margin: '14px 0 0' }}>
                {(['overview', 'activity', 'details'] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${w.tab} ${tab === t ? w.tabOn : ''}`} onClick={() => setTab(t)}>
                    {t === 'overview' ? 'Overview' : t === 'activity' ? `Activity${detail.timeline.length ? ` · ${detail.timeline.length}` : ''}` : 'Details'}
                  </button>
                ))}
              </div>
            </div>

            <div className={s.drawerBody}>
              {tab === 'overview' && (
                <>
                  {stage === 'prospect' && (
                    <section className={s.section}>
                      <p className={s.prospectNote}>
                        <strong>Prospect.</strong> {sent.length ? `Emailed ${sent.length}×.` : 'Not emailed yet.'} When they reply to an email, they become a New lead on the pipeline automatically.
                      </p>
                    </section>
                  )}
                  {replies[0] && (
                    <section className={s.section}>
                      <div className={s.sectionHead}><h3 className={s.sectionTitle}>Latest reply</h3><span className={s.eventWhen}>{timeAgo(replies[0].at)}</span></div>
                      <p className={s.replyQuote}>{replies[0].body || '(no text)'}</p>
                    </section>
                  )}
                  <TasksSection contactId={id} detail={detail} onChange={async () => { await reload(); onChanged(); }} notify={notify} />
                  <DealsSection
                    contactId={id}
                    detail={detail}
                    focusDealId={focusDealId ?? null}
                    onSave={saveDeal}
                    onChange={async () => { await reload(); onChanged(); }}
                    notify={notify}
                  />
                </>
              )}

              {tab === 'activity' && (
                <section className={s.section}>
                  <LogForm contactId={id} onLogged={reload} notify={notify} />
                  <Timeline detail={detail} onDelete={async (activityId) => {
                    try {
                      await apiSend(`/api/crm/activities/${activityId}`, 'DELETE');
                      await reload();
                    } catch (error) {
                      notify(error instanceof Error ? error.message : 'Could not delete', 'error');
                    }
                  }} />
                </section>
              )}

              {tab === 'details' && (
                <>
                  <DetailsSection key={c.updated_at} contact={c} onSave={(patch) => save(patch, 'Details saved.')} />
                  <NewsletterSection contact={c} onChange={async () => { await reload(); onChanged(); }} notify={notify} />
                  <section className={s.section}>
                    <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={remove} disabled={busy === 'delete'}>
                      Delete contact
                    </button>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </aside>

      {prospecting && c && (
        <EmailDialog
          contactId={id}
          onClose={() => setProspecting(false)}
          onDone={(message) => { setProspecting(false); notify(message); void reload(); onChanged(); }}
        />
      )}

      {messaging && c && (
        <ReminderDialog
          title={`Message ${c.name || c.email}`}
          custom
          loadPreview={loadPreview}
          send={(input) =>
            apiSend<ReminderResult>('/api/admin', 'POST', {
              action: 'send_reminder',
              target: { kind: 'crm_contact', id, subject: input.subject },
              channels: input.channels,
              note: input.note,
            })
          }
          saveContact={async (proposalClientId, phone, smsOptIn) => {
            await apiSend(`/api/proposal-clients/${proposalClientId}`, 'PATCH', { phone, sms_opt_in: smsOptIn });
          }}
          onClose={() => setMessaging(false)}
          onSent={() => { void reload(); onChanged(); }}
        />
      )}
    </>
  );
}

function DealsSection({ contactId, detail, focusDealId, onSave, onChange, notify }: {
  contactId: string;
  detail: CrmContactDetail;
  focusDealId: string | null;
  onSave: (dealId: string, patch: Partial<CrmDeal>, okMessage?: string) => Promise<boolean>;
  onChange: () => Promise<void>;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [askingReview, setAskingReview] = useState<CrmDeal | null>(null);
  const focused = useRef<HTMLElement>(null);

  useEffect(() => {
    focused.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      await apiSend('/api/crm/deals', 'POST', { contact_id: contactId, title: title.trim(), stage: 'lead' });
      setTitle('');
      notify('Deal added.');
      await onChange();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add deal', 'error');
    }
    setAdding(false);
  }

  async function remove(deal: CrmDeal) {
    if (!window.confirm(`Delete the deal "${deal.title}"? Its proposals and inquiries stay on this contact.`)) return;
    try {
      await apiSend(`/api/crm/deals/${deal.id}`, 'DELETE');
      notify('Deal deleted.');
      await onChange();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete deal', 'error');
    }
  }

  const unassigned = detail.proposals.filter((pr) => !pr.crm_deal_id || !detail.deals.some((d) => d.id === pr.crm_deal_id));

  return (
    <section className={s.section}>
      <div className={s.sectionHead}><h3 className={s.sectionTitle}>Deals</h3></div>
      {detail.deals.length === 0 && <p className={s.eventMeta} style={{ margin: '0 0 8px' }}>No deals with this person yet.</p>}
      {detail.deals.map((deal) => {
        const proposals = detail.proposals.filter((pr) => pr.crm_deal_id === deal.id);
        const isFocused = deal.id === focusDealId;
        return (
          <article
            key={deal.id}
            ref={isFocused ? focused : undefined}
            className={`${s.deal} ${isFocused ? s.dealFocused : ''}`}
            aria-label={deal.title}
          >
            <div className={s.dealHead}>
              <span className={s.dot} style={{ background: STAGE_COLOR[deal.stage] }} aria-hidden="true" />
              <DealTitle key={deal.title} title={deal.title} onSave={(next) => onSave(deal.id, { title: next }, 'Renamed.')} />
              <button type="button" className={s.iconButton} aria-label={`Delete deal "${deal.title}"`} onClick={() => remove(deal)}>×</button>
            </div>
            <div className={s.dealGrid}>
              <label>
                <span className={s.miniLabel}>Stage</span>
                <select
                  className={p.select}
                  value={deal.stage}
                  onChange={(e) => onSave(deal.id, { stage: e.target.value as CrmStage }, `Moved to ${STAGE_LABEL[e.target.value as CrmStage]}`)}
                >
                  {CRM_STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
                </select>
              </label>
              <ValueField key={deal.value_cents ?? 'none'} cents={deal.value_cents} onSave={(value_cents) => onSave(deal.id, { value_cents }, 'Value saved.')} />
            </div>
            {deal.stage === 'lost' && (
              <LostReason key={deal.lost_reason ?? ''} reason={deal.lost_reason} onSave={(lost_reason) => onSave(deal.id, { lost_reason }, 'Saved.')} />
            )}
            {proposals.length > 0 && (
              <ul className={s.dealProposals}>
                {proposals.map((pr) => <ProposalLine key={pr.id} proposal={pr} />)}
              </ul>
            )}
            {deal.stage === 'won' && <ReviewLine deal={deal} reviews={detail.reviews} onAsk={() => setAskingReview(deal)} />}
            <p className={s.eventMeta} style={{ marginTop: 8 }}>
              Opened {formatDate(deal.created_at)}{DEAL_SOURCE[deal.source] ? ` from ${DEAL_SOURCE[deal.source]}` : ''}
              {' · '}{STAGE_LABEL[deal.stage]} since {formatDate(deal.stage_changed_at)}
            </p>
          </article>
        );
      })}

      {unassigned.length > 0 && (
        <>
          <p className={s.miniLabel} style={{ marginTop: 12 }}>Proposals not on a deal</p>
          <ul className={s.dealProposals}>
            {unassigned.map((pr) => <ProposalLine key={pr.id} proposal={pr} />)}
          </ul>
        </>
      )}

      <form className={s.addRow} onSubmit={add}>
        <input className={p.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New deal, e.g. Website refresh" aria-label="New deal" />
        <button type="submit" className={`${p.btn} ${p.btnSmall}`} disabled={adding || !title.trim()}>Add deal</button>
      </form>

      {askingReview && (
        <ReviewRequestDialog
          contactId={contactId}
          deal={askingReview}
          onClose={() => setAskingReview(null)}
          onSent={async () => { setAskingReview(null); notify('Review request sent.'); await onChange(); }}
        />
      )}
    </section>
  );
}

/** On a won deal: ask for a review, or show where the request stands. */
function ReviewLine({ deal, reviews, onAsk }: { deal: CrmDeal; reviews: CrmContactDetail['reviews']; onAsk: () => void }) {
  const review = reviews.find((r) => r.crm_deal_id === deal.id);
  if (!review) {
    return (
      <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginTop: 8 }} onClick={onAsk}>
        ★ Ask for a review
      </button>
    );
  }
  const text =
    review.status === 'requested' ? `Review requested ${formatDate(review.requested_at)} — not answered yet`
    : review.status === 'approved' ? `Review on the website${review.rating ? ` · ${'★'.repeat(review.rating)}` : ''}`
    : review.status === 'hidden' ? 'Review received (hidden)'
    : `Review received${review.rating ? ` · ${'★'.repeat(review.rating)}` : ''} — approve it in Reviews`;
  return (
    <p className={s.eventMeta} style={{ marginTop: 8 }}>
      <Link href="/admin/reviews" style={{ color: 'inherit' }}>{text}</Link>
    </p>
  );
}

function ProposalLine({ proposal: pr }: { proposal: CrmContactDetail['proposals'][number] }) {
  return (
    <li className={s.task}>
      <Link href={`/admin/proposals/${pr.id}/edit`} className={s.taskTitle} style={{ color: '#111' }}>{pr.title}</Link>
      <span className={s.chip}>{pr.status}</span>
      <span className={s.taskDue}>{formatMoneyCents(pr.total_cents, pr.currency)}</span>
    </li>
  );
}

function DealTitle({ title, onSave }: { title: string; onSave: (title: string) => Promise<boolean> }) {
  const [value, setValue] = useState(title);
  return (
    <input
      className={s.dealTitleInput}
      value={value}
      aria-label="Deal name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim();
        if (!next) setValue(title);
        else if (next !== title) void onSave(next);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

/** Newsletter status, and adding or removing someone by hand. */
function NewsletterSection({ contact: c, onChange, notify }: {
  contact: CrmContact;
  onChange: () => Promise<void>;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function set(status: 'subscribed' | 'unsubscribed') {
    setBusy(true);
    try {
      await apiSend(`/api/crm/contacts/${c.id}/newsletter`, 'POST', status === 'subscribed' ? { status, consent_note: note } : { status });
      notify(status === 'subscribed' ? 'Added to the newsletter.' : 'Removed from the newsletter.');
      setAdding(false); setNote('');
      await onChange();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update', 'error');
    }
    setBusy(false);
  }

  const status = c.newsletter_status;
  const line =
    status === 'subscribed'
      ? `Subscribed ${c.newsletter_subscribed_at ? `since ${formatDate(c.newsletter_subscribed_at)}` : ''}${c.newsletter_source === 'footer' ? ' · signed up on the website' : c.newsletter_consent_note ? ` · ${c.newsletter_consent_note}` : ''}`
      : status === 'pending'
        ? 'Signed up on the website but hasn’t clicked the confirm link yet — not emailed until they do.'
        : status === 'unsubscribed'
          ? `Unsubscribed${c.newsletter_unsubscribed_at ? ` ${formatDate(c.newsletter_unsubscribed_at)}` : ''}. Only add them back if they ask.`
          : 'Not on the newsletter.';

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h3 className={s.sectionTitle}>Newsletter subscription</h3>
        {status === 'subscribed' || status === 'pending' ? (
          <button type="button" className={s.moreButton} onClick={() => set('unsubscribed')} disabled={busy}>Remove</button>
        ) : !adding ? (
          <button type="button" className={s.moreButton} onClick={() => setAdding(true)} disabled={!c.email}>
            {c.email ? 'Add to newsletter' : 'Needs an email'}
          </button>
        ) : null}
      </div>
      <p className={s.eventMeta} style={{ margin: 0 }}>{line}</p>
      {adding && (
        <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); void set('subscribed'); }}>
          <input
            className={p.input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How did they agree? e.g. “Said yes on our call”"
            aria-label="How they agreed to receive the newsletter"
            autoFocus
          />
          <button type="submit" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={busy || note.trim().length < 3}>Add</button>
          <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => { setAdding(false); setNote(''); }}>Cancel</button>
        </form>
      )}
    </section>
  );
}

function ValueField({ cents, onSave }: { cents: number | null; onSave: (cents: number | null) => Promise<boolean> }) {
  const [value, setValue] = useState(dollars(cents));
  const [error, setError] = useState('');

  async function commit() {
    const parsed = parseDollars(value);
    if (parsed === undefined) { setError('Numbers only'); return; }
    setError('');
    if (parsed !== cents) await onSave(parsed);
  }

  return (
    <label>
      <span className={s.miniLabel}>Value ($){error && <span style={{ color: '#b00020' }}> · {error}</span>}</span>
      <input
        className={p.input}
        inputMode="decimal"
        value={value}
        placeholder="Not set"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </label>
  );
}

function LostReason({ reason, onSave }: { reason: string | null; onSave: (reason: string | null) => Promise<boolean> }) {
  const [value, setValue] = useState(reason ?? '');
  return (
    <label style={{ display: 'block', marginTop: 10 }}>
      <span className={s.miniLabel}>Why was it lost?</span>
      <input
        className={p.input}
        value={value}
        placeholder="Budget, timing, went with someone else…"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if ((value.trim() || null) !== reason) void onSave(value.trim() || null); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </label>
  );
}

function TasksSection({ contactId, detail, onChange, notify }: {
  contactId: string;
  detail: CrmContactDetail;
  onChange: () => Promise<void>;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const today = todayIso();

  const open = detail.tasks.filter((t) => !t.completed_at);
  const done = detail.tasks.filter((t) => t.completed_at);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      await apiSend(`/api/crm/contacts/${contactId}/tasks`, 'POST', { title, due_date: due || null });
      setTitle(''); setDue('');
      await onChange();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add task', 'error');
    }
    setAdding(false);
  }

  async function run(fn: () => Promise<unknown>) {
    try { await fn(); await onChange(); } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update task', 'error');
    }
  }

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h3 className={s.sectionTitle}>Follow-ups</h3>
        {done.length > 0 && (
          <button type="button" className={s.moreButton} onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide' : 'Show'} {done.length} done
          </button>
        )}
      </div>

      {open.length === 0 && <p className={s.eventMeta} style={{ margin: '0 0 4px' }}>Nothing scheduled.</p>}
      {[...open, ...(showDone ? done : [])].map((t) => {
        const late = !t.completed_at && t.due_date && t.due_date < today;
        return (
          <div key={t.id} className={s.task}>
            <input
              type="checkbox"
              checked={Boolean(t.completed_at)}
              aria-label={`Mark "${t.title}" ${t.completed_at ? 'not done' : 'done'}`}
              onChange={(e) => run(() => apiSend(`/api/crm/tasks/${t.id}`, 'PATCH', { completed: e.target.checked }))}
            />
            <span className={`${s.taskTitle} ${t.completed_at ? s.taskDone : ''}`}>{t.title}</span>
            {t.due_date && (
              <span className={`${s.taskDue} ${late ? s.taskLate : ''}`}>
                {t.due_date === today ? 'Today' : formatDate(t.due_date)}
              </span>
            )}
            <button
              type="button"
              className={s.iconButton}
              aria-label={`Delete "${t.title}"`}
              onClick={() => run(() => apiSend(`/api/crm/tasks/${t.id}`, 'DELETE'))}
            >
              ×
            </button>
          </div>
        );
      })}

      <form className={s.addRow} onSubmit={add}>
        <input className={p.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up about…" aria-label="New task" />
        <input className={p.input} type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 150 }} aria-label="Due date" />
        <button type="submit" className={`${p.btn} ${p.btnSmall}`} disabled={adding || !title.trim()}>Add</button>
      </form>
    </section>
  );
}

function DetailsSection({ contact: c, onSave }: { contact: CrmContact; onSave: (patch: Partial<CrmContact>) => Promise<boolean> }) {
  const [name, setName] = useState(c.name);
  const [company, setCompany] = useState(c.company ?? '');
  const [email, setEmail] = useState(c.email ?? '');
  const [phone, setPhone] = useState(c.phone ? formatPhone(c.phone) : '');
  const [source, setSource] = useState(c.source);
  const [tags, setTags] = useState(c.tags.join(', '));
  const [website, setWebsite] = useState(c.website ?? '');
  const [saving, setSaving] = useState(false);

  const nextTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const dirty =
    name !== c.name || company !== (c.company ?? '') || email !== (c.email ?? '') ||
    phone !== (c.phone ? formatPhone(c.phone) : '') || source !== c.source || nextTags.join(',') !== c.tags.join(',') ||
    website !== (c.website ?? '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, company, email, phone, website, source: source.trim() || 'manual', tags: nextTags } as Partial<CrmContact>);
    setSaving(false);
  }

  return (
    <section className={s.section}>
      <div className={s.sectionHead}><h3 className={s.sectionTitle}>Details</h3></div>
      <form onSubmit={submit}>
        <div className={s.formGrid}>
          <label>
            <span className={s.miniLabel}>Name</span>
            <input className={p.input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            <span className={s.miniLabel}>Company</span>
            <input className={p.input} value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label>
            <span className={s.miniLabel}>Email</span>
            <input className={p.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span className={s.miniLabel}>Phone</span>
            <input className={p.input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            <span className={s.miniLabel}>Website</span>
            <input className={p.input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="bloombakery.com" />
          </label>
          <label>
            <span className={s.miniLabel}>Source</span>
            <input className={p.input} value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            <span className={s.miniLabel}>Tags (comma separated)</span>
            <input className={p.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="branding, retainer" />
          </label>
        </div>
        <p className={s.eventMeta}>
          Added {formatDate(c.created_at)}. Texts use the number and consent on their portal or proposal record, not this one.
        </p>
        {dirty && (
          <div className={s.modalActions} style={{ marginTop: 10 }}>
            <button type="submit" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function LogForm({ contactId, onLogged, notify }: {
  contactId: string;
  onLogged: () => Promise<unknown>;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [kind, setKind] = useState<CrmActivityKind>('note');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await apiSend(`/api/crm/contacts/${contactId}/activities`, 'POST', { kind, body });
      setBody('');
      await onLogged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save', 'error');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit}>
      <div className={s.kindPicker} role="radiogroup" aria-label="What are you logging?">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={`${p.filterChip} ${kind === k ? p.filterChipOn : ''}`}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <textarea
        className={p.textarea}
        style={{ minHeight: 70 }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind === 'note' ? 'Add a note…' : `What was the ${KIND_LABEL[kind].toLowerCase()} about?`}
        aria-label="Note"
      />
      <div className={s.modalActions} style={{ marginTop: 8 }}>
        <button type="submit" className={`${p.btn} ${p.btnSmall}`} disabled={saving || !body.trim()}>
          {saving ? 'Saving…' : `Log ${KIND_LABEL[kind].toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}

function Timeline({ detail, onDelete }: { detail: CrmContactDetail; onDelete: (activityId: string) => void }) {
  if (detail.timeline.length === 0) {
    return <p className={s.eventMeta}>Nothing yet.</p>;
  }
  return (
    <ol className={s.timeline}>
      {detail.timeline.map((item) => (
        <li key={item.key} className={s.event}>
          <span className={s.eventDot} style={{ background: EVENT_COLOR[item.kind] }} />
          <div style={{ minWidth: 0 }}>
            <div className={s.eventHead}>
              <p className={s.eventTitle}>
                {item.href ? <Link href={item.href}>{item.title}</Link> : item.title}
              </p>
              <span className={s.eventWhen}>
                {when(item.at)}
                {item.activityId && (
                  <button
                    type="button"
                    className={s.iconButton}
                    aria-label="Delete this entry"
                    onClick={() => { if (window.confirm('Delete this entry?')) onDelete(item.activityId!); }}
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
            {item.meta && <p className={s.eventMeta}>{item.meta}</p>}
            {item.body && <p className={s.eventBody}>{item.body}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
