'use client';

// Every admin page after sign-in: one sidebar, ⌘K search, and one contact
// panel any page can open through useCrm(). ?contact=<id>&deal=<id> (or
// ?portal=<portal client id>) on any admin URL opens someone straight away,
// which is how the digest and notification emails link in.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import a from './admin.module.css';
import { AdminIcon, type IconName } from './AdminIcon';
import { apiGet } from './proposals/adminApi';
import { Toast, useToast } from './proposals/Toast';
import { ContactDrawer } from './crm/ContactDrawer';
import { CommandPalette } from './crm/CommandPalette';
import { CrmContext, type CrmWorkspace } from './crm/CrmContext';
import type { CrmContactRow, CrmToday } from '@/types/crm';

type NavItem = { href: string; label: string; icon: IconName };

const NAV: { group: string | null; items: NavItem[] }[] = [
  { group: null, items: [{ href: '/admin', label: 'Home', icon: 'home' }] },
  {
    group: 'Sales',
    items: [
      { href: '/admin/crm/pipeline', label: 'Pipeline', icon: 'pipeline' },
      { href: '/admin/crm/prospects', label: 'Prospects', icon: 'prospects' },
      { href: '/admin/crm/contacts', label: 'Contacts', icon: 'contacts' },
      { href: '/admin/crm/proposals', label: 'Proposals', icon: 'proposals' },
      { href: '/admin/invoices', label: 'Estimates & invoices', icon: 'invoices' },
      { href: '/admin/price-list', label: 'Price list', icon: 'pricelist' },
    ],
  },
  { group: 'Clients', items: [
    { href: '/admin/clients', label: 'Clients', icon: 'clients' },
    { href: '/admin/work', label: 'Work in progress', icon: 'work' },
    { href: '/admin/questionnaires', label: 'Questionnaires', icon: 'questionnaires' },
  ] },
  {
    group: 'Outreach',
    items: [
      { href: '/admin/crm/emails', label: 'Emails', icon: 'emails' },
      { href: '/admin/crm/campaigns', label: 'Campaigns', icon: 'campaigns' },
      { href: '/admin/crm/calls', label: 'Calls', icon: 'calls' },
    ],
  },
  {
    group: 'Website',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: 'analytics' },
      { href: '/admin/homepage', label: 'Homepage', icon: 'homepage' },
      { href: '/admin/journal', label: 'Journal', icon: 'journal' },
      { href: '/admin/portfolio', label: 'Portfolio', icon: 'portfolio' },
      { href: '/admin/services', label: 'Services', icon: 'services' },
      { href: '/admin/reviews', label: 'Reviews', icon: 'reviews' },
    ],
  },
];

// Full-screen tools with their own top bar.
const FULL_SCREEN = /^\/admin\/crm\/proposals\/[^/]+\/(edit|preview|tune)/;

const urlParam = (key: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key));

function setUrl(contact: string | null, deal: string | null, panel: string | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete('portal');
  for (const [key, value] of [['contact', contact], ['deal', deal], ['panel', panel]] as const) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, '', url);
}

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

export function AdminWorkspace({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => void }) {
  const pathname = usePathname() ?? '';
  // Whoever the URL names opens straight away.
  const [open, setOpen] = useState<{ contact: string; deal: string | null; panel: 'client' | null } | null>(() => {
    const contact = urlParam('contact');
    return contact ? { contact, deal: urlParam('deal'), panel: urlParam('panel') === 'client' ? 'client' : null } : null;
  });
  const [version, setVersion] = useState(0);
  const [contacts, setContacts] = useState<CrmContactRow[] | null>(null);
  const [today, setToday] = useState<CrmToday | null>(null);
  const [palette, setPalette] = useState(false);
  // The phone menu remembers the page it opened on, so navigating closes it.
  const [menuOn, setMenuOn] = useState<string | null>(null);
  const menuOpen = menuOn === pathname;
  const { toast, show } = useToast();

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const openContact = useCallback((contact: string | null, deal: string | null = null, panel: 'client' | null = null) => {
    setOpen(contact ? { contact, deal, panel } : null);
    setUrl(contact, deal, panel);
  }, []);

  // Contacts (for search) and the sidebar counts, again after any change.
  useEffect(() => {
    let cancelled = false;
    apiGet<CrmContactRow[]>('/api/crm/contacts').then((c) => { if (!cancelled) setContacts(c); }).catch(() => {});
    apiGet<CrmToday>('/api/crm/today').then((t) => { if (!cancelled) setToday(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, [version]);

  // ?portal=<portal client id> (or the old /admin/clients?client=<id>): open
  // their contact on the Client tab.
  useEffect(() => {
    const portal = urlParam('portal') ?? (pathname === '/admin/clients' ? urlParam('client') : null);
    if (!portal || urlParam('contact')) return;
    apiGet<CrmContactRow[]>('/api/crm/contacts')
      .then((list) => {
        const found = list.find((c) => c.portal_client_id === portal);
        if (found) openContact(found.id, null, 'client');
        else show('That client has no CRM contact yet', 'error');
      })
      .catch(() => {});
    // Only on arrival: the URL names who to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    openContact: (id, deal = null, panel = null) => openContact(id, deal, panel),
    version,
    refresh,
    contacts,
    notify: show,
  }), [openContact, version, refresh, contacts, show]);

  const counts: Record<string, { n: number; hot: boolean }> = today ? {
    '/admin': { n: today.replies.length + today.tasks.length + today.inquiries.length, hot: true },
    '/admin/crm/prospects': { n: today.prospects.total, hot: false },
  } : {};

  const fullScreen = FULL_SCREEN.test(pathname);

  const link = (item: NavItem) => {
    const on = isActive(pathname, item.href);
    const c = counts[item.href];
    return (
      <Link key={item.href} href={item.href} className={`${a.link} ${on ? a.linkOn : ''}`} aria-current={on ? 'page' : undefined}>
        <AdminIcon name={item.icon} className={a.icon} />
        {item.label}
        {c && c.n > 0 && <span className={`${a.count} ${c.hot ? '' : a.countQuiet}`}>{c.n}</span>}
      </Link>
    );
  };

  return (
    <CrmContext.Provider value={ctx}>
      <div className={`${a.app} ${fullScreen ? a.appFull : ''}`}>
        {!fullScreen && (
          <>
            <div className={a.bar}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" />
              <button type="button" className={a.menuButton} aria-expanded={menuOpen} onClick={() => setMenuOn(menuOpen ? null : pathname)}>
                {menuOpen ? 'Close' : 'Menu'}
              </button>
            </div>
            {menuOpen && <div className={a.scrim} onClick={() => setMenuOn(null)} aria-hidden="true" />}

            <aside className={`${a.side} ${menuOpen ? a.sideOpen : ''}`}>
              <Link href="/admin" className={a.brand}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" />
                <span className={a.brandTag}>Admin</span>
              </Link>
              <button type="button" className={a.search} onClick={() => setPalette(true)}>
                <AdminIcon name="search" className={a.icon} /><span>Search people</span><span className={a.kbd}>⌘K</span>
              </button>
              <nav className={a.nav} aria-label="Admin">
                {NAV.map((section) => (
                  <div key={section.group ?? 'top'}>
                    {section.group && <p className={a.group}>{section.group}</p>}
                    {section.items.map(link)}
                  </div>
                ))}
              </nav>
              <div className={a.foot}>
                {link({ href: '/admin/settings', label: 'Settings', icon: 'settings' })}
                <a href="/" target="_blank" rel="noreferrer" className={a.link}><AdminIcon name="site" className={a.icon} />View site</a>
                <button type="button" className={`${a.link} ${a.signOut}`} onClick={onSignOut}>
                  <AdminIcon name="signOut" className={a.icon} />Sign out
                </button>
              </div>
            </aside>
          </>
        )}

        <main className={a.main}>{children}</main>
      </div>

      {open && (
        <ContactDrawer
          key={`${open.contact}:${open.panel ?? ''}`}
          id={open.contact}
          focusDealId={open.deal}
          initialTab={open.panel}
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
