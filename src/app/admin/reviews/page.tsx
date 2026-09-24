'use client';

// Reviews: approve what clients sent before it goes on the site, choose
// which service page it appears on, and add testimonials received by email
// or text. Requests are sent from a won deal in the CRM.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import type { ReviewRow, ReviewStatus } from '@/types/review';

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'submitted', label: 'To approve', empty: 'Nothing waiting. Ask a recent client for a review from their won deal in the CRM.' },
  { value: 'approved', label: 'On the site', empty: 'No reviews published yet.' },
  { value: 'requested', label: 'Asked, not answered', empty: 'No open requests.' },
  { value: 'hidden', label: 'Hidden', empty: 'Nothing hidden.' },
];

function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  return <span aria-label={`${n} out of 5 stars`} style={{ color: '#e40586', letterSpacing: 1 }}>{'★'.repeat(n)}<span style={{ color: '#d9d6d2' }}>{'★'.repeat(5 - n)}</span></span>;
}

export default function ReviewsAdmin() {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [tab, setTab] = useState<ReviewStatus>('submitted');
  const [adding, setAdding] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<ReviewRow[]>('/api/reviews'));
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not load reviews', 'error');
      setRows((r) => r ?? []);
    }
  }, [show]);

  useEffect(() => {
    let cancelled = false;
    apiGet<ReviewRow[]>('/api/reviews')
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((e) => { if (!cancelled) { show(e instanceof Error ? e.message : 'Could not load reviews', 'error'); setRows([]); } });
    return () => { cancelled = true; };
  }, [show]);

  async function update(id: string, patch: Record<string, unknown>, message: string) {
    try {
      await apiSend(`/api/reviews/${id}`, 'PATCH', patch);
      show(message);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  async function remove(row: ReviewRow) {
    if (!window.confirm(row.status === 'requested' ? 'Cancel this request? The link will stop working.' : 'Delete this review for good?')) return;
    try {
      await apiSend(`/api/reviews/${row.id}`, 'DELETE');
      show('Deleted.');
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  const visible = rows?.filter((r) => r.status === tab) ?? [];
  const current = TABS.find((t) => t.value === tab)!;

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>Reviews</h1>
            <p className={p.pageSub}>
              Approved reviews appear on their service page. Ask for one from a won deal in the CRM.
            </p>
          </div>
          <button type="button" className={p.btn} onClick={() => setAdding((v) => !v)}>
            {adding ? 'Close' : 'Add a testimonial'}
          </button>
        </div>

        {adding && <ManualForm onAdded={async () => { setAdding(false); setTab('submitted'); show('Added — approve it to publish.'); await load(); }} onError={(m) => show(m, 'error')} />}

        <div className={p.filters} role="tablist" aria-label="Review status">
          {TABS.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={`${p.filterChip} ${tab === t.value ? p.filterChipOn : ''}`} onClick={() => setTab(t.value)}>
              {t.label}{rows ? ` (${rows.filter((r) => r.status === t.value).length})` : ''}
            </button>
          ))}
        </div>

        <div className={p.list}>
          {rows === null && <p className={p.empty}>Loading…</p>}
          {rows !== null && visible.length === 0 && <p className={p.empty}>{current.empty}</p>}
          {visible.map((r) => (
            <div key={r.id} style={{ padding: '16px 18px', borderBottom: '1px solid #f0eeec' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{r.display_name || r.contact_name || 'Client'}</strong>
                  {r.display_role && <span className={p.rowMeta} style={{ display: 'inline', marginLeft: 6 }}>{r.display_role}</span>}
                  {' '}<Stars n={r.rating} />
                </div>
                <span className={p.rowMeta}>
                  {r.status === 'requested' ? `Asked ${formatDate(r.requested_at)}` : r.submitted_at ? `Received ${formatDate(r.submitted_at)}` : ''}
                  {r.crm_contact_id && <> · <Link href={`/admin/crm?contact=${r.crm_contact_id}${r.crm_deal_id ? `&deal=${r.crm_deal_id}` : ''}`}>{r.deal_title ?? r.contact_name ?? 'CRM'}</Link></>}
                </span>
              </div>

              {r.body && <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>“{r.body}”</p>}

              {r.status !== 'requested' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
                  {!r.consent_publish && <span className={`${p.badge} ${p.badgeExpired}`}>Not okay to publish</span>}
                  <select
                    className={p.select}
                    style={{ width: 'auto' }}
                    value={r.service_slug ?? ''}
                    aria-label="Show on"
                    onChange={(e) => update(r.id, { service_slug: (e.target.value || null) as ServiceSlug | null }, 'Saved.')}
                  >
                    <option value="">Any service page</option>
                    {Object.values(SERVICE_SEO).map((svc) => <option key={svc.slug} value={svc.slug}>{svc.name}</option>)}
                  </select>
                  {r.status !== 'approved' && r.consent_publish && (
                    <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} onClick={() => update(r.id, { status: 'approved' }, 'Published.')}>Approve</button>
                  )}
                  {r.status === 'approved' && (
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => update(r.id, { featured: !r.featured }, r.featured ? 'Unfeatured.' : 'Featured — shown first.')}>
                      {r.featured ? '★ Featured' : 'Feature'}
                    </button>
                  )}
                  {r.status !== 'hidden' && (
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => update(r.id, { status: 'hidden' }, 'Hidden from the site.')}>Hide</button>
                  )}
                  {r.status === 'hidden' && (
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => update(r.id, { status: 'submitted' }, 'Moved back to To approve.')}>Unhide</button>
                  )}
                  <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => remove(r)}>Delete</button>
                </div>
              )}
              {r.status === 'requested' && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => remove(r)}>Cancel request</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function ManualForm({ onAdded, onError }: { onAdded: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(5);
  const [service, setService] = useState<ServiceSlug | ''>('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiSend('/api/reviews', 'POST', {
        display_name: name, display_role: role, body, rating, service_slug: service || null, crm_contact_id: null, consent_publish: consent,
      });
      onAdded();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className={p.card} style={{ marginBottom: 18 }}>
      <h2 className={p.cardTitle}>Add a testimonial you received another way</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
        <label><span className={p.label}>Client name</span><input className={p.input} value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label><span className={p.label}>Role and company</span><input className={p.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Owner, Bloom Co." /></label>
        <label><span className={p.label}>Rating</span>
          <select className={p.select} value={rating ?? ''} onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
          </select>
        </label>
        <label><span className={p.label}>Service</span>
          <select className={p.select} value={service} onChange={(e) => setService(e.target.value as ServiceSlug | '')}>
            <option value="">Any service page</option>
            {Object.values(SERVICE_SEO).map((svc) => <option key={svc.slug} value={svc.slug}>{svc.name}</option>)}
          </select>
        </label>
      </div>
      <label style={{ display: 'block', marginTop: 12 }}>
        <span className={p.label}>Their words, exactly as written</span>
        <textarea className={p.textarea} value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} />
      </label>
      <label className={p.toggleRow} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        The client agreed to be quoted on the website.
      </label>
      <div style={{ marginTop: 12 }}>
        <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={saving || !consent}>{saving ? 'Adding…' : 'Add testimonial'}</button>
      </div>
    </form>
  );
}
