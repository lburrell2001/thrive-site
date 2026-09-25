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

const AUDIENCE: Record<string, string> = { subscribers: 'Everyone subscribed', clients: 'Clients', leads: 'Leads', tag: 'Tag' };
const BADGE: Record<Row['status'], string> = { draft: p.badgeDraft, sending: p.badgeViewed, sent: p.badgeSigned, failed: p.badgeDeclined };

export default function NewslettersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState('');
  const [creating, setCreating] = useState(false);
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
    Promise.all([apiGet<Row[]>('/api/newsletters'), apiGet<Settings>('/api/newsletters/settings')])
      .then(([r, st]) => { if (!cancelled) { setRows(r); setSettings(st); setAddress(st.address ?? ''); } })
      .catch((e) => { if (!cancelled) { show(e instanceof Error ? e.message : 'Could not load newsletters', 'error'); setRows([]); } });
    return () => { cancelled = true; };
  }, [show]);

  async function create() {
    setCreating(true);
    try {
      const created = await apiSend<{ id: string }>('/api/newsletters', 'POST');
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
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={create} disabled={creating}>
            {creating ? 'Starting…' : 'New newsletter'}
          </button>
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
