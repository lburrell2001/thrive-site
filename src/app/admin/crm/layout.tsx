'use client';

// The CRM workspace: a sidebar of views (Today, Pipeline, Prospects,
// Contacts, Emails), ⌘K search, and one contact panel any page can open.
// ?contact=<id>&deal=<id> (or ?portal=<portal client id>) in the URL opens
// someone straight away, which is how the dashboard, digest and
// notification emails link in.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import w from './workspace.module.css';
import { apiGet } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { ContactDrawer } from './ContactDrawer';
import { CommandPalette } from './CommandPalette';
import { CrmContext, type CrmWorkspace } from './CrmContext';
import type { CrmContactRow, CrmToday } from '@/types/crm';

const NAV = [
  { href: '/admin/crm', label: 'Today', icon: '◉' },
  { href: '/admin/crm/pipeline', label: 'Pipeline', icon: '▦' },
  { href: '/admin/crm/prospects', label: 'Prospects', icon: '◎' },
  { href: '/admin/crm/contacts', label: 'Contacts', icon: '☺' },
  { href: '/admin/crm/emails', label: 'Emails', icon: '✉' },
] as const;

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));

function setUrl(contact: string | null, deal: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('portal');
  for (const [key, value] of [['contact', contact], ['deal', deal]] as const) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, '', url);
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // Whoever the URL names opens straight away.
  const [open, setOpen] = useState<{ contact: string; deal: string | null } | null>(() => {
    const contact = urlParam('contact');
    return contact ? { contact, deal: urlParam('deal') } : null;
  });
  const [version, setVersion] = useState(0);
  const [contacts, setContacts] = useState<CrmContactRow[] | null>(null);
  const [today, setToday] = useState<CrmToday | null>(null);
  const [palette, setPalette] = useState(false);
  const { toast, show } = useToast();

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const openContact = useCallback((contact: string | null, deal: string | null = null) => {
    setOpen(contact ? { contact, deal } : null);
    setUrl(contact, deal);
  }, []);

  // Contacts (for search) and the sidebar counts, again after any change.
  useEffect(() => {
    let cancelled = false;
    apiGet<CrmContactRow[]>('/api/crm/contacts').then((c) => { if (!cancelled) setContacts(c); }).catch(() => {});
    apiGet<CrmToday>('/api/crm/today').then((t) => { if (!cancelled) setToday(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, [version]);

  // ?portal=<id> from a client's page: find their contact.
  useEffect(() => {
    const portal = urlParam('portal');
    if (!portal || urlParam('contact')) return;
    apiGet<CrmContactRow[]>('/api/crm/contacts')
      .then((list) => {
        const found = list.find((c) => c.portal_client_id === portal);
        if (found) openContact(found.id);
        else show('That client has no CRM contact yet', 'error');
      })
      .catch(() => {});
  }, [openContact, show]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ctx = useMemo<CrmWorkspace>(() => ({
    openContact: (id, deal = null) => openContact(id, deal),
    version,
    refresh,
    contacts,
    notify: show,
  }), [openContact, version, refresh, contacts, show]);

  const counts: Partial<Record<(typeof NAV)[number]['href'], { n: number; hot: boolean }>> = today ? {
    '/admin/crm': { n: today.replies.length + today.tasks.length + today.inquiries.length, hot: true },
    '/admin/crm/prospects': { n: today.prospects.total, hot: false },
  } : {};

  const active = (href: string) => (href === '/admin/crm' ? pathname === href : pathname.startsWith(href));
  // The email designer wants the whole width.
  const editing = /^\/admin\/crm\/emails\/(?!$)/.test(pathname);

  return (
    <CrmContext.Provider value={ctx}>
      <div className={w.shell}>
        <nav className={w.side} aria-label="CRM">
          <button type="button" className={w.searchButton} onClick={() => setPalette(true)}>
            <span aria-hidden="true">⌕</span><span>Search</span><span className={w.kbd}>⌘K</span>
          </button>
          <p className={w.navLabel}>Workspace</p>
          {NAV.map((n) => {
            const c = counts[n.href];
            return (
              <Link key={n.href} href={n.href} className={`${w.navItem} ${active(n.href) ? w.navOn : ''}`} aria-current={active(n.href) ? 'page' : undefined}>
                <span className={w.navIcon} aria-hidden="true">{n.icon}</span>
                {n.label}
                {c && c.n > 0 && <span className={`${w.navCount} ${c.hot ? '' : w.navCountQuiet}`}>{c.n}</span>}
              </Link>
            );
          })}
          <p className={w.sideFoot}>
            Prospects → reply → Lead → Proposal → Won. Replies to your emails land here and in your inbox.
          </p>
        </nav>

        <main className={w.main} style={editing ? { overflow: 'auto' } : undefined}>{children}</main>
      </div>

      {open && (
        <ContactDrawer
          key={open.contact}
          id={open.contact}
          focusDealId={open.deal}
          onClose={() => openContact(null)}
          onChanged={refresh}
          onDeleted={() => { openContact(null); refresh(); }}
          notify={show}
        />
      )}

      {palette && (
        <CommandPalette
          contacts={contacts ?? []}
          onClose={() => setPalette(false)}
          onOpenContact={(id) => { setPalette(false); openContact(id); }}
        />
      )}

      <Toast toast={toast} />
    </CrmContext.Provider>
  );
}
