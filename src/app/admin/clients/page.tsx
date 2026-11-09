'use client';

// Clients: everyone with a portal login. Each one opens in the contact panel
// on its Client tab (projects, invoices, files, requests, vault), so a
// client's sales history and their portal work are in one place.
// /admin/clients?client=<portal client id> opens one straight away (the
// workspace handles that).

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet } from '../proposals/adminApi';
import { useCrm } from '../crm/CrmContext';
import { avatarColor, initials, timeAgo } from '../crm/shared';
import { ClientPortal, NewClientForm, clientApi } from './ClientPortal';
import type { CrmContactRow } from '@/types/crm';

interface PortalClient { id: string; full_name: string; company_name: string; email?: string | null }

export default function ClientsPage() {
  const { contacts, openContact, refresh, version, notify } = useCrm();
  const [clients, setClients] = useState<PortalClient[] | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  // A client with no CRM contact (rare: made before the CRM) opens here instead.
  const [orphan, setOrphan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientApi({ action: 'list_clients' }).then((r) => {
      if (cancelled) return;
      if (r.error) notify(String(r.error), 'error');
      else setClients((r.data as PortalClient[]) ?? []);
    });
    return () => { cancelled = true; };
  }, [version, notify]);

  const byPortal = new Map((contacts ?? []).filter((c) => c.portal_client_id).map((c) => [c.portal_client_id as string, c]));
  const query = q.trim().toLowerCase();
  const rows = (clients ?? [])
    .map((client) => ({ client, contact: byPortal.get(client.id) ?? null }))
    .filter(({ client, contact }) => !query
      || [client.full_name, client.company_name, client.email, contact?.email].some((v) => v?.toLowerCase().includes(query)))
    .sort((a, b) => (b.contact?.last_touch_at ?? '').localeCompare(a.contact?.last_touch_at ?? ''));

  function open(client: PortalClient, contact: CrmContactRow | null) {
    if (contact) { setOrphan(null); openContact(contact.id, null, 'client'); }
    else setOrphan(client.id);
  }

  async function created(portalId: string) {
    setAdding(false);
    refresh();
    // The database links a new portal login to a contact; find it and open it.
    const list = await apiGet<CrmContactRow[]>('/api/crm/contacts').catch(() => []);
    const contact = list.find((c) => c.portal_client_id === portalId);
    if (contact) openContact(contact.id, null, 'client');
    else setOrphan(portalId);
    notify('Client created. They can sign in to the portal with their email.');
  }

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Clients</h1>
          <p className={w.sub}>Everyone with a portal login. Open one to see their projects, invoices, files and requests next to their deals and history.</p>
        </div>
        <div className={w.headActions}>
          <a href="/admin/welcome-preview" className={p.btn}>Preview portal welcome</a>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setAdding(true)}>New client</button>
        </div>
      </div>

      {adding && (
        <section className={w.card} style={{ marginBottom: 18 }}>
          <div className={w.cardHead}>
            <h2 className={w.cardTitle}>New client</h2>
            <button type="button" className={w.cardLink} onClick={() => setAdding(false)}>Cancel</button>
          </div>
          <div style={{ padding: 18 }}>
            <p className={w.muted} style={{ margin: '0 0 14px', fontSize: 13.5 }}>
              Creates their portal login. They sign in with a code sent to this email. If they’re already in the CRM, they’re linked by email.
            </p>
            <NewClientForm api={clientApi} onCreated={(id) => void created(id)} />
          </div>
        </section>
      )}

      <div className={w.toolbar}>
        <input className={w.searchInput} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" aria-label="Search clients" />
        <span className={w.muted} style={{ fontSize: 13 }}>{clients ? `${rows.length} client${rows.length === 1 ? '' : 's'}` : ''}</span>
      </div>

      <section className={w.card}>
        {!clients ? <p className={w.empty}>Loading…</p>
          : rows.length === 0 ? <p className={w.empty}>{query ? 'No clients match.' : 'No clients yet.'}</p>
          : rows.map(({ client, contact }) => (
            <button key={client.id} type="button" className={w.item} onClick={() => open(client, contact)}>
              <span className={w.avatar} style={{ background: avatarColor(contact?.id ?? client.id) }}>{initials(client.full_name, client.email)}</span>
              <span className={w.itemMain}>
                <span className={w.itemTitle}>{client.full_name || client.email}{client.company_name ? <span className={w.muted} style={{ fontWeight: 500 }}> · {client.company_name}</span> : null}</span>
                <span className={w.itemSub}>{[client.email ?? contact?.email, !contact && 'not in the CRM'].filter(Boolean).join(' · ')}</span>
              </span>
              {contact && <span className={w.itemWhen}>{timeAgo(contact.last_touch_at)}</span>}
            </button>
          ))}
      </section>

      {orphan && (
        <section style={{ marginTop: 18 }}>
          <div className={w.cardHead} style={{ padding: '0 0 10px', border: 0 }}>
            <h2 className={w.cardTitle}>{clients?.find((c) => c.id === orphan)?.full_name ?? 'Client'}</h2>
            <button type="button" className={w.cardLink} onClick={() => setOrphan(null)}>Close</button>
          </div>
          <ClientPortal key={orphan} clientId={orphan} onDeleted={() => { setOrphan(null); refresh(); }} />
        </section>
      )}
    </div>
  );
}
