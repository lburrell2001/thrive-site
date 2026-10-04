'use client';

// Prospect emails: the templates Lauren sends to potential clients one at a
// time (from a contact's "Prospect email" button in the CRM), and what has
// gone out recently.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../../proposals/adminApi';
import { Toast, useToast } from '../../proposals/Toast';
import type { ProspectStyle, ProspectTemplate } from '@/lib/prospectEmail';

interface Sent {
  id: string;
  contact_id: string | null;
  email: string;
  subject: string;
  style: ProspectStyle;
  status: 'sent' | 'failed';
  error: string | null;
  sent_at: string;
  crm_contacts: { name: string; company: string | null } | null;
}

const STYLE_LABEL: Record<ProspectStyle, string> = { personal: 'Personal', designed: 'Designed' };

export default function ProspectingPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProspectTemplate[] | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [address, setAddress] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState('');
  const { toast, show } = useToast();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<ProspectTemplate[]>('/api/prospects/templates'),
      apiGet<Sent[]>('/api/prospects').catch(() => []),
      apiGet<{ address: string | null }>('/api/newsletters/settings').catch(() => ({ address: null })),
    ])
      .then(([t, s, st]) => { if (!cancelled) { setTemplates(t); setSent(s); setAddress(st.address); } })
      .catch((e) => { if (!cancelled) { show(e instanceof Error ? e.message : 'Could not load', 'error'); setTemplates([]); } });
    return () => { cancelled = true; };
  }, [show]);

  async function create(body: { style: ProspectStyle } | { starters: true }) {
    setBusy('style' in body ? body.style : 'starters');
    try {
      const created = await apiSend<{ id: string }>('/api/prospects/templates', 'POST', body);
      if ('starters' in body) {
        setTemplates(await apiGet<ProspectTemplate[]>('/api/prospects/templates'));
        show('Starter templates added.');
        setBusy('');
      } else {
        router.push(`/admin/crm/prospecting/${created.id}`);
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not create the template', 'error');
      setBusy('');
    }
  }

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <p className={p.rowMeta} style={{ margin: 0 }}><Link href="/admin/crm">← CRM</Link></p>
            <h1 className={p.pageTitle}>Prospect emails</h1>
            <p className={p.pageSub}>
              Templates for reaching out to potential clients. Send one from a contact in the CRM with <strong>Prospect email</strong> — you can edit it for that person before it goes.
            </p>
          </div>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={p.btn} onClick={() => create({ style: 'designed' })} disabled={busy !== ''}>
              {busy === 'designed' ? 'Starting…' : 'New designed'}
            </button>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => create({ style: 'personal' })} disabled={busy !== ''}>
              {busy === 'personal' ? 'Starting…' : 'New personal'}
            </button>
          </span>
        </div>

        {address === null && (
          <p className={p.card} style={{ color: '#92400e', background: '#fffbeb', marginBottom: 14 }}>
            Add your mailing address on the <Link href="/admin/crm/newsletters">Newsletters page</Link> before sending — it’s required in every marketing email, cold ones included.
          </p>
        )}

        <section className={p.card} style={{ marginBottom: 16 }}>
          <h2 className={p.cardTitle}>Which style?</h2>
          <p className={p.rowMeta} style={{ lineHeight: 1.6 }}>
            <strong>Personal</strong> looks like an email you typed: text, a small signature with your logo, and a link or two. Use it for first contact — it gets more replies and usually lands in the main inbox.
            {' '}<strong>Designed</strong> uses the newsletter blocks for an image-led email. Better once someone knows you, or to show off a project; heavier designs more often land in Promotions.
          </p>
          <p className={p.rowMeta} style={{ lineHeight: 1.6, marginTop: 8 }}>
            Write <code>{'{{first_name}}'}</code> or <code>{'{{company}}'}</code> to fill in from the contact, and <code>{'[[a note to yourself]]'}</code> for a line you’ll personalise each time — sending is blocked until those are filled in.
          </p>
        </section>

        <div className={p.list} style={{ marginBottom: 24 }}>
          {templates === null && <p className={p.empty}>Loading…</p>}
          {templates?.length === 0 && (
            <div className={p.empty}>
              <p style={{ margin: '0 0 10px' }}>No templates yet.</p>
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => create({ starters: true })} disabled={busy !== ''}>
                {busy === 'starters' ? 'Adding…' : 'Add starter templates (intro, follow-up, designed)'}
              </button>
            </div>
          )}
          {templates?.map((t) => (
            <div key={t.id} className={p.row} style={{ gridTemplateColumns: '1fr 100px 150px auto' }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/crm/prospecting/${t.id}`} className={p.rowTitle}>{t.name || 'Untitled template'}</Link>
                <p className={p.rowMeta}>{t.subject || 'No subject yet'}</p>
              </div>
              <span className={`${p.badge} ${t.style === 'personal' ? p.badgeSigned : p.badgeViewed}`}>{STYLE_LABEL[t.style]}</span>
              <span className={`${p.rowMeta} ${p.rowHideSmall}`}>Edited {formatDate(t.updated_at)}</span>
              <div className={p.rowActions}>
                <Link href={`/admin/crm/prospecting/${t.id}`} className={`${p.btn} ${p.btnSmall}`}>Edit</Link>
              </div>
            </div>
          ))}
        </div>

        <h2 className={p.cardTitle}>Recently sent</h2>
        <div className={p.list}>
          {sent.length === 0 && <p className={p.empty}>Nothing sent yet. Open a contact in the CRM and choose Prospect email.</p>}
          {sent.map((r) => (
            <div key={r.id} className={p.row} style={{ gridTemplateColumns: '1fr 90px 150px' }}>
              <div style={{ minWidth: 0 }}>
                <span className={p.rowTitle}>{r.crm_contacts?.name || r.email}{r.crm_contacts?.company ? ` · ${r.crm_contacts.company}` : ''}</span>
                <p className={p.rowMeta}>{r.subject}{r.status === 'failed' && r.error ? ` · ${r.error}` : ''}</p>
              </div>
              <span className={`${p.badge} ${r.status === 'sent' ? p.badgeSigned : p.badgeDeclined}`}>{r.status}</span>
              <span className={`${p.rowMeta} ${p.rowHideSmall}`}>{formatDate(r.sent_at)}</span>
            </div>
          ))}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
