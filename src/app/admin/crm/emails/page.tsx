'use client';

// Emails: every email to an audience (newsletters to subscribers, outreach
// to prospects, a hand-picked group), the templates they start from, and
// the settings every email needs (mailing address, reply catching).
// One-to-one emails are sent from a contact's panel with the same templates;
// the ones saved or scheduled but not sent yet are listed here too.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiGet, apiSend, formatDate } from '../../proposals/adminApi';
import { useCrm } from '../CrmContext';
import type { EmailStyle, EmailTemplate } from '@/lib/emailContent';
import { formatWhen } from '@/lib/scheduleTime';
import { EmailDialog } from '../EmailDialog';

interface Row {
  id: string;
  style: EmailStyle | null;
  subject: string;
  audience: string;
  audience_tag: string | null;
  audience_contact_ids: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_at: string | null;
  recipient_count: number;
  sent_at: string | null;
  updated_at: string;
  last_error: string | null;
}

/** A one-to-one email saved or scheduled from a contact's Email button. */
interface OneToOne {
  id: string;
  contact_id: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'failed';
  scheduled_at: string | null;
  error: string | null;
  updated_at: string;
  crm_contacts: { name: string; email: string | null; company: string | null } | null;
}

interface Settings {
  address: string | null;
  subscribed: number;
  pending: number;
  unsubscribed: number;
  prospects: number;
  inbound: { domain: string | null; webhook: boolean };
}

type Tab = 'emails' | 'templates' | 'settings';

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));

type Start = 'designed' | 'personal' | string;
type Who = 'subscribers' | 'prospects' | 'contacts';

const AUDIENCE: Record<string, string> = {
  subscribers: 'Subscribers', clients: 'Subscribed clients', leads: 'Subscribed leads', tag: 'Subscribers with a tag',
  prospects: 'All prospects', prospect_tag: 'Prospects with a tag', contacts: 'Hand-picked',
};
const STATUS_PILL: Record<Row['status'], string> = { draft: w.pillMuted, scheduled: w.pillProspect, sending: w.pillBlue, sent: w.pillClient, failed: w.pillLead };
const ROW_COLUMNS = 'minmax(0,1fr) 170px 90px 150px';

export default function EmailsPage() {
  const router = useRouter();
  const { notify: show, version } = useCrm();
  const [tab, setTab] = useState<Tab>(() => { const t = urlParam('tab'); return t === 'templates' || t === 'settings' ? t : 'emails'; });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [singles, setSingles] = useState<OneToOne[]>([]);
  const [emailing, setEmailing] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState('');
  // From the Prospects page: "Email them" arrives with ?new=1&contacts=…
  const [starting, setStarting] = useState<{ ids: string[] } | null>(() =>
    urlParam('new') === '1' ? { ids: (urlParam('contacts') ?? '').split(',').filter(Boolean) } : null);

  const load = useCallback(async () => {
    const [r, t, st, o] = await Promise.all([
      apiGet<Row[]>('/api/newsletters'),
      apiGet<EmailTemplate[]>('/api/emails/templates').catch(() => []),
      apiGet<Settings>('/api/newsletters/settings'),
      apiGet<OneToOne[]>('/api/emails/drafts').catch(() => []),
    ]);
    return { r, t, st, o };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ r, t, st, o }) => { if (!cancelled) { setRows(r); setTemplates(t); setSettings(st); setSingles(o); setAddress(st.address ?? ''); } })
      .catch((e) => { if (!cancelled) { show(e instanceof Error ? e.message : 'Could not load emails', 'error'); setRows([]); } });
    return () => { cancelled = true; };
  }, [load, show, version]);

  async function reload() {
    try {
      const { r, t, st, o } = await load();
      setRows(r); setTemplates(t); setSettings(st); setSingles(o);
    } catch { /* the toast from the first load is enough */ }
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend('/api/newsletters/settings', 'PATCH', { address });
      show('Mailing address saved.');
      await reload();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save', 'error');
    }
  }

  async function newTemplate(body: { style: EmailStyle } | { starters: true }) {
    try {
      const created = await apiSend<{ id: string }>('/api/emails/templates', 'POST', body);
      if ('starters' in body) { await reload(); show('Starter templates added.'); }
      else router.push(`/admin/crm/emails/templates/${created.id}`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not create the template', 'error');
    }
  }

  const scheduled = (rows ?? []).filter((r) => r.status === 'scheduled')
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
  const drafts = rows?.filter((r) => r.status !== 'sent' && r.status !== 'scheduled') ?? [];
  const sent = rows?.filter((r) => r.status === 'sent') ?? [];
  const singleScheduled = singles.filter((o) => o.status === 'scheduled' || o.status === 'sending');
  const singleDrafts = singles.filter((o) => o.status === 'draft' || o.status === 'failed');
  const inboundOn = Boolean(settings?.inbound.domain && settings.inbound.webhook);

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <p className={w.eyebrow}>CRM</p>
          <h1 className={w.title}>Emails</h1>
          <p className={w.sub}>Newsletters and outreach are the same thing here: design an email once, then choose who gets it. To email one person, open them and click Email.</p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setStarting({ ids: [] })}>New email</button>
        </div>
      </div>

      {settings && !settings.address && (
        <p className={p.card} style={{ color: '#92400e', background: '#fffbeb', marginBottom: 14 }}>
          Add your mailing address in <button type="button" className={w.cardLink} style={{ color: 'inherit', textDecoration: 'underline' }} onClick={() => setTab('settings')}>Settings</button> — every marketing email has to include one, so sending is off until it’s there.
        </p>
      )}
      {settings && !inboundOn && (
        <p className={p.card} style={{ color: '#1e3a8a', background: '#eff6ff', marginBottom: 14 }}>
          Replies aren’t being caught yet, so a prospect who writes back won’t move to the pipeline on their own. <button type="button" className={w.cardLink} style={{ color: 'inherit', textDecoration: 'underline' }} onClick={() => setTab('settings')}>See setup</button>.
        </p>
      )}

      {settings && (
        <div className={w.statRow}>
          <div className={w.stat}><p className={w.statLabel}>Subscribers</p><p className={w.statValue}>{settings.subscribed}</p><p className={w.statNote}>{settings.pending ? `${settings.pending} not confirmed yet` : 'confirmed'}</p></div>
          <div className={w.stat}><p className={w.statLabel}>Prospects</p><p className={w.statValue}>{settings.prospects}</p><p className={w.statNote}><Link href="/admin/crm/prospects">Manage the list</Link></p></div>
          <div className={w.stat}><p className={w.statLabel}>Unsubscribed</p><p className={w.statValue}>{settings.unsubscribed}</p><p className={w.statNote}>never emailed again</p></div>
          <div className={w.stat}><p className={w.statLabel}>Replies</p><p className={w.statValue} style={{ fontSize: 18, marginTop: 12 }}>{inboundOn ? 'Being caught' : 'Not set up'}</p></div>
        </div>
      )}

      <div className={w.tabs} role="tablist" aria-label="Emails">
        {(['emails', 'templates', 'settings'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${w.tab} ${tab === t ? w.tabOn : ''}`} onClick={() => setTab(t)}>
            {t === 'emails' ? 'Emails' : t === 'templates' ? `Templates${templates.length ? ` · ${templates.length}` : ''}` : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'emails' && (
        <div style={{ display: 'grid', gap: 18 }}>
          {rows === null ? <p className={w.empty}>Loading…</p> : rows.length === 0 && singles.length === 0 ? (
            <div className={w.card}><p className={w.empty}>No emails yet. Start one with New email — for prospects, a short personal note gets the most replies.</p></div>
          ) : (
            ([['Scheduled', scheduled, singleScheduled], ['Drafts', drafts, singleDrafts], ['Sent', sent, []]] as const).map(([label, list, ones]) => (list.length > 0 || ones.length > 0) && (
              <section key={label}>
                <p className={w.navLabel} style={{ margin: '0 4px 8px' }}>{label}</p>
                <div className={w.table}>
                  {list.map((r) => (
                    <Link key={r.id} href={`/admin/crm/emails/${r.id}`} className={`${w.row} ${w.rowClick}`} style={{ gridTemplateColumns: ROW_COLUMNS, color: 'inherit', textDecoration: 'none' }}>
                      <span className={w.whoText}>
                        <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{r.subject || 'Untitled email'}</span>
                        <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>
                          {r.style === 'personal' ? 'Personal' : 'Designed'}{r.status === 'failed' && r.last_error ? ` · ${r.last_error}` : ''}
                        </span>
                      </span>
                      <span className={`${w.muted} ${w.truncate} ${w.hideSmall}`}>
                        {r.audience === 'contacts' ? `${r.audience_contact_ids.length} hand-picked` : r.audience.endsWith('tag') ? `${AUDIENCE[r.audience]}: ${r.audience_tag ?? '—'}` : AUDIENCE[r.audience]}
                      </span>
                      <span><span className={`${w.pill} ${STATUS_PILL[r.status]}`}>{r.status}</span></span>
                      <span className={`${w.muted} ${w.nowrap} ${w.hideSmall}`}>
                        {r.status === 'scheduled' ? formatWhen(r.scheduled_at) : r.sent_at ? `${r.recipient_count} · ${formatDate(r.sent_at)}` : formatDate(r.updated_at)}
                      </span>
                    </Link>
                  ))}
                  {ones.map((o) => (
                    <button key={o.id} type="button" onClick={() => setEmailing(o.contact_id)} className={`${w.row} ${w.rowClick}`} style={{ gridTemplateColumns: ROW_COLUMNS, color: 'inherit', textAlign: 'left', font: 'inherit', width: '100%', border: 0, background: 'none' }}>
                      <span className={w.whoText}>
                        <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{o.subject || 'Untitled email'}</span>
                        <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>
                          One-to-one{o.status === 'failed' && o.error ? ` · ${o.error}` : ''}
                        </span>
                      </span>
                      <span className={`${w.muted} ${w.truncate} ${w.hideSmall}`}>{o.crm_contacts?.name || o.crm_contacts?.email || '—'}</span>
                      <span><span className={`${w.pill} ${STATUS_PILL[o.status]}`}>{o.status}</span></span>
                      <span className={`${w.muted} ${w.nowrap} ${w.hideSmall}`}>{o.status === 'scheduled' ? formatWhen(o.scheduled_at) : formatDate(o.updated_at)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {tab === 'templates' && (
        <>
          <div className={w.toolbar}>
            <span className={w.muted} style={{ flex: 1, fontSize: 13.5 }}>Templates start new emails, and the Email button on a contact. Save one from any email too.</span>
            <button type="button" className={p.btn} onClick={() => newTemplate({ style: 'designed' })}>New designed</button>
            <button type="button" className={p.btn} onClick={() => newTemplate({ style: 'personal' })}>New personal</button>
          </div>
          <div className={w.table}>
            {templates.length === 0 && (
              <div className={w.empty}>
                No templates yet.{' '}
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} onClick={() => newTemplate({ starters: true })}>Add starters (intro, follow-up, designed)</button>
              </div>
            )}
            {templates.map((t) => (
              <Link key={t.id} href={`/admin/crm/emails/templates/${t.id}`} className={`${w.row} ${w.rowClick}`} style={{ gridTemplateColumns: 'minmax(0,1fr) 100px 130px', color: 'inherit', textDecoration: 'none' }}>
                <span className={w.whoText}>
                  <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{t.name || 'Untitled template'}</span>
                  <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>{t.subject || 'No subject yet'}</span>
                </span>
                <span><span className={`${w.pill} ${t.style === 'personal' ? w.pillProspect : w.pillBlue}`}>{t.style === 'personal' ? 'Personal' : 'Designed'}</span></span>
                <span className={`${w.muted} ${w.hideSmall}`}>Edited {formatDate(t.updated_at)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && settings && (
        <div className={w.grid2}>
          <form className={w.card} onSubmit={saveAddress}>
            <div className={w.cardHead}><h2 className={w.cardTitle}>Mailing address</h2></div>
            <div style={{ padding: 18 }}>
              <p className={w.muted} style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>
                US law (CAN-SPAM) requires a physical address in every marketing email — newsletters and cold outreach alike. A PO box or registered mailbox is fine.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className={p.input} style={{ flex: '1 1 220px' }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="PO Box 123, Dallas, TX 75201" aria-label="Mailing address" />
                <button type="submit" className={p.btn} disabled={!address.trim() || address.trim() === (settings.address ?? '')}>Save</button>
              </div>
            </div>
          </form>
          <section className={w.card}>
            <div className={w.cardHead}>
              <h2 className={w.cardTitle}>Catching replies</h2>
              <span className={`${w.pill} ${inboundOn ? w.pillClient : w.pillMuted}`} style={{ marginLeft: 'auto' }}>{inboundOn ? 'On' : 'Off'}</span>
            </div>
            <div style={{ padding: 18, fontSize: 13.5, lineHeight: 1.6 }}>
              {inboundOn ? (
                <p style={{ margin: 0 }}>
                  Replies go to <code>reply-…@{settings.inbound.domain}</code>. Each one is logged on the person, forwarded to your inbox (hit reply there to answer them), and a prospect who replies becomes a New lead.
                </p>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>In Resend → Domains, add a receiving domain such as <code>mail.thrivecreativestudios.org</code> and add the MX record it shows at your DNS provider.</li>
                  <li>In Resend → Webhooks, add <code>https://thrivecreativestudios.org/api/email/inbound</code> for the <code>email.received</code> event and copy its signing secret.</li>
                  <li>In Vercel, set <code>RESEND_INBOUND_DOMAIN</code> (the domain from step 1) and <code>RESEND_WEBHOOK_SECRET</code>, then redeploy.</li>
                </ol>
              )}
              {!settings.inbound.domain && settings.inbound.webhook && <p style={{ color: '#b45309' }}>The webhook secret is set but RESEND_INBOUND_DOMAIN isn’t.</p>}
              {settings.inbound.domain && !settings.inbound.webhook && <p style={{ color: '#b45309' }}>RESEND_INBOUND_DOMAIN is set but RESEND_WEBHOOK_SECRET isn’t — replies would be refused.</p>}
            </div>
          </section>
        </div>
      )}

      {emailing && (
        <EmailDialog contactId={emailing} onClose={() => setEmailing(null)} onDone={(message) => { setEmailing(null); show(message); void reload(); }} />
      )}

      {starting && (
        <NewEmailDialog
          contactIds={starting.ids}
          templates={templates}
          onClose={() => { setStarting(null); window.history.replaceState(null, '', '/admin/crm/emails'); }}
          onCreated={(id) => router.push(`/admin/crm/emails/${id}`)}
        />
      )}
    </div>
  );
}

function NewEmailDialog({ contactIds, templates, onClose, onCreated }: {
  contactIds: string[];
  templates: EmailTemplate[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [who, setWho] = useState<Who>(contactIds.length ? 'contacts' : 'subscribers');
  const [start, setStart] = useState<Start>(contactIds.length ? (templates.find((t) => t.style === 'personal')?.id ?? 'personal') : 'designed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true); setError('');
    try {
      const body = {
        ...(start === 'designed' || start === 'personal' ? { kind: start } : { template_id: start }),
        audience: who,
        ...(who === 'contacts' ? { contact_ids: contactIds } : {}),
      };
      const created = await apiSend<{ id: string }>('/api/newsletters', 'POST', body);
      onCreated(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the email');
      setBusy(false);
    }
  }

  const options: { value: Who; label: string; note: string; disabled?: boolean }[] = [
    { value: 'subscribers', label: 'Newsletter subscribers', note: 'People who signed up. You can narrow to clients, leads or a tag in the editor.' },
    { value: 'prospects', label: 'Prospects', note: 'Everyone on the Prospects list (or a tag of them). Replies turn them into leads.' },
    { value: 'contacts', label: `Hand-picked${contactIds.length ? ` (${contactIds.length})` : ''}`, note: contactIds.length ? 'The people you selected.' : 'Select people on the Prospects page first.', disabled: !contactIds.length },
  ];

  return (
    <>
      <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => !busy && onClose()} />
      <div className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="new-email-title">
        <h2 id="new-email-title" className={w.dialogTitle}>New email</h2>
        <p className={w.navLabel} style={{ margin: '16px 0 8px' }}>Who is it for?</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {options.map((o) => (
            <label key={o.value} className={w.item} style={{ border: `1px solid ${who === o.value ? '#141414' : '#ebe9e5'}`, borderRadius: 12, opacity: o.disabled ? 0.5 : 1, cursor: o.disabled ? 'default' : 'pointer' }}>
              <input type="radio" name="who" className={w.check} checked={who === o.value} disabled={o.disabled} onChange={() => setWho(o.value)} />
              <span className={w.itemMain}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{o.label}</span>
                <span className={w.muted} style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>{o.note}</span>
              </span>
            </label>
          ))}
        </div>
        <p className={w.navLabel} style={{ margin: '18px 0 8px' }}>Start from</p>
        <select className={p.select} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start from">
          <option value="designed">Blank designed email</option>
          <option value="personal">Blank personal note</option>
          {templates.map((t) => <option key={t.id} value={t.id}>Template: {t.name} ({t.style === 'personal' ? 'personal' : 'designed'})</option>)}
        </select>
        {who !== 'subscribers' && (
          <p className={w.muted} style={{ fontSize: 12.5, lineHeight: 1.5, margin: '10px 0 0' }}>
            For people who haven’t heard from you before, a short personal note usually lands in the main inbox and gets more replies than a designed email.
          </p>
        )}
        {error && <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" className={p.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={create} disabled={busy}>{busy ? 'Starting…' : 'Start writing'}</button>
        </div>
      </div>
    </>
  );
}
