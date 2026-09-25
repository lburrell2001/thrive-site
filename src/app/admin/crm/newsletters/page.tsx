'use client';

// Newsletters: who is on the list, the mailing address the law requires in
// every one, and every newsletter written or sent.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../../proposals/adminApi';
import { Toast, useToast } from '../../proposals/Toast';

interface Row {
  id: string;
  subject: string;
  audience: string;
  audience_tag: string | null;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipient_count: number;
  sent_at: string | null;
  updated_at: string;
  last_error: string | null;
}

interface Settings { address: string | null; subscribed: number; pending: number; unsubscribed: number }
interface Template { id: string; name: string }

const AUDIENCE: Record<string, string> = { subscribers: 'Everyone subscribed', clients: 'Clients', leads: 'Leads', tag: 'Tag' };
const BADGE: Record<Row['status'], string> = { draft: p.badgeDraft, sending: p.badgeViewed, sent: p.badgeSigned, failed: p.badgeDeclined };

export default function NewslettersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [startFrom, setStartFrom] = useState('designed');
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const [r, st] = await Promise.all([apiGet<Row[]>('/api/newsletters'), apiGet<Settings>('/api/newsletters/settings')]);
      setRows(r);
      setSettings(st);
      setAddress(st.address ?? '');
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not load newsletters', 'error');
      setRows((x) => x ?? []);
    }
  }, [show]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiGet<Row[]>('/api/newsletters'), apiGet<Settings>('/api/newsletters/settings'), apiGet<Template[]>('/api/newsletters/templates').catch(() => [])])
      .then(([r, st, t]) => { if (!cancelled) { setRows(r); setSettings(st); setAddress(st.address ?? ''); setTemplates(t); } })
      .catch((e) => { if (!cancelled) { show(e instanceof Error ? e.message : 'Could not load newsletters', 'error'); setRows([]); } });
    return () => { cancelled = true; };
  }, [show]);

  async function create() {
    setCreating(true);
    try {
      const body = startFrom === 'designed' || startFrom === 'plain' ? { kind: startFrom } : { template_id: startFrom };
      const created = await apiSend<{ id: string }>('/api/newsletters', 'POST', body);
      router.push(`/admin/crm/newsletters/${created.id}`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not start a newsletter', 'error');
      setCreating(false);
    }
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend('/api/newsletters/settings', 'PATCH', { address });
      show('Mailing address saved.');
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not save', 'error');
    }
  }

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <p className={p.rowMeta} style={{ margin: 0 }}><Link href="/admin/crm">← CRM</Link></p>
            <h1 className={p.pageTitle}>Newsletters</h1>
            <p className={p.pageSub}>Only people who subscribed are emailed. Every newsletter includes an unsubscribe link and your mailing address.</p>
          </div>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className={p.select} style={{ width: 'auto' }} value={startFrom} onChange={(e) => setStartFrom(e.target.value)} aria-label="Start from">
              <option value="designed">Designed layout</option>
              {templates.map((t) => <option key={t.id} value={t.id}>Template: {t.name}</option>)}
              <option value="plain">Plain text</option>
            </select>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={create} disabled={creating}>
              {creating ? 'Starting…' : 'New newsletter'}
            </button>
          </span>
        </div>

        {settings && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
            <section className={p.card}>
              <h2 className={p.cardTitle}>Your list</h2>
              <p style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 2px' }}>{settings.subscribed}</p>
              <p className={p.rowMeta}>
                subscribed{settings.pending ? ` · ${settings.pending} haven’t confirmed yet` : ''}{settings.unsubscribed ? ` · ${settings.unsubscribed} unsubscribed` : ''}
              </p>
              <p className={p.rowMeta} style={{ marginTop: 8 }}>
                People join from the website footer, or you can add a contact who agreed from their page in the CRM.
              </p>
            </section>
            <form className={p.card} onSubmit={saveAddress}>
              <h2 className={p.cardTitle}>Mailing address</h2>
              <p className={p.rowMeta} style={{ margin: '4px 0 10px' }}>
                US law (CAN-SPAM) requires a physical postal address in every marketing email. A PO box or a registered mailbox is fine.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className={p.input} style={{ flex: '1 1 220px' }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="PO Box 123, Dallas, TX 75201" aria-label="Mailing address" />
                <button type="submit" className={p.btn} disabled={!address.trim() || address.trim() === (settings.address ?? '')}>Save</button>
              </div>
              {!settings.address && <p className={p.rowMeta} style={{ color: '#b45309', marginTop: 8 }}>Sending is blocked until this is set.</p>}
            </form>
          </div>
        )}

        {templates.length > 0 && (
          <section className={p.card} style={{ marginBottom: 16 }}>
            <h2 className={p.cardTitle}>Templates</h2>
            <p className={p.rowMeta}>Save one from any designed newsletter; pick it next to “New newsletter”.</p>
            {templates.map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 14 }}>
                <span style={{ flex: 1 }}>{t.name}</span>
                <button
                  type="button"
                  className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`}
                  onClick={async () => {
                    if (!window.confirm(`Delete the template "${t.name}"? Newsletters made from it are not affected.`)) return;
                    try {
                      await apiSend(`/api/newsletters/templates/${t.id}`, 'DELETE');
                      setTemplates((list) => list.filter((x) => x.id !== t.id));
                      if (startFrom === t.id) setStartFrom('designed');
                    } catch (e) {
                      show(e instanceof Error ? e.message : 'Could not delete', 'error');
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>
        )}

        <div className={p.list}>
          {rows === null && <p className={p.empty}>Loading…</p>}
          {rows?.length === 0 && <p className={p.empty}>No newsletters yet. A short monthly note — a recent project, one useful tip, what you have availability for — is plenty.</p>}
          {rows?.map((r) => (
            <div key={r.id} className={p.row} style={{ gridTemplateColumns: '1fr 90px 150px auto' }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/crm/newsletters/${r.id}`} className={p.rowTitle}>{r.subject || 'Untitled newsletter'}</Link>
                <p className={p.rowMeta}>
                  {r.audience === 'tag' ? `Tag: ${r.audience_tag ?? '—'}` : AUDIENCE[r.audience]}
                  {r.status === 'sent' ? ` · sent to ${r.recipient_count}` : ''}
                  {r.status === 'failed' && r.last_error ? ` · ${r.last_error}` : ''}
                </p>
              </div>
              <span className={`${p.badge} ${BADGE[r.status]}`}>{r.status}</span>
              <span className={`${p.rowMeta} ${p.rowHideSmall}`}>{r.sent_at ? `Sent ${formatDate(r.sent_at)}` : `Edited ${formatDate(r.updated_at)}`}</span>
              <div className={p.rowActions}>
                <Link href={`/admin/crm/newsletters/${r.id}`} className={`${p.btn} ${p.btnSmall}`}>{r.status === 'sent' ? 'View' : 'Edit'}</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
