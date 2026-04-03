'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bungee, Bai_Jamjuree } from 'next/font/google';
import { supabasePortal } from '@/lib/supabasePortal';

const bungee = Bungee({ weight: '400', subsets: ['latin'], variable: '--font-bungee' });
const baiJamjuree = Bai_Jamjuree({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const BASE_NAV_LINKS = [
  { href: '/portal/dashboard',  label: 'Dashboard' },
  { href: '/portal/requests',   label: 'My Requests' },
  { href: '/portal/progress',   label: 'Progress' },
  { href: '/portal/invoices',   label: 'Invoices' },
  { href: '/portal/payments',   label: 'Payments' },
  { href: '/portal/onboarding', label: 'Onboarding' },
  { href: '/portal/files',      label: 'Files & Assets' },
  { href: '/portal/settings',   label: 'Settings' },
];

function buildPageTitles(userName: string, userCompany: string) {
  const welcome = `Welcome back, ${userCompany || userName}`;
  return {
    '/portal/dashboard':  { title: 'DASHBOARD',       subtitle: welcome },
    '/portal/requests':   { title: 'MY REQUESTS',     subtitle: 'Track and manage your design requests' },
    '/portal/progress':   { title: 'PROGRESS',        subtitle: 'Project milestones and timelines' },
    '/portal/invoices':   { title: 'INVOICES',        subtitle: 'Billing history and payments' },
    '/portal/payments':   { title: 'PAYMENTS',        subtitle: 'Payment methods and history' },
    '/portal/onboarding': { title: 'ONBOARDING',      subtitle: 'Get started with your project' },
    '/portal/files':      { title: 'FILES & ASSETS',  subtitle: 'Delivered files and uploads' },
    '/portal/settings':   { title: 'SETTINGS',        subtitle: 'Account and notification preferences' },
  } as Record<string, { title: string; subtitle: string }>;
}


function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {open ? (
        <>
          <line x1="4" y1="4" x2="18" y2="18" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="4" x2="4"  y2="18" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="3" y1="6"  x2="19" y2="6"  stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="11" x2="19" y2="11" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="16" x2="19" y2="16" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [checking,     setChecking]     = useState(true);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [isDesktop,    setIsDesktop]    = useState(false);
  const [userName,     setUserName]     = useState('Client');
  const [userInitials, setUserInitials] = useState('CL');
  const [userRole,     setUserRole]     = useState('client');
  const [userCompany,  setUserCompany]  = useState('');

  // Track desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (pathname === '/portal/login') return;

    supabasePortal.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/portal/login'); return; }

      const res = await fetch('/api/portal/me', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const json = await res.json() as { ok?: boolean; profile?: { full_name: string; initials: string; role: string; company_name: string } };

      const profile = json.profile;
      const name     = profile?.full_name    || session.user.email?.split('@')[0] || 'Client';
      const initials = profile?.initials     || name.slice(0, 2).toUpperCase();
      const role     = profile?.role         || 'client';
      const company  = profile?.company_name || '';

      setUserName(name);
      setUserInitials(initials);
      setUserRole(role);
      setUserCompany(company);
      setChecking(false);
    });
  }, [router, pathname]);

  async function handleSignOut() {
    await supabasePortal.auth.signOut();
    router.push('/portal/login');
  }

  if (pathname === '/portal/login') {
    return <div className={`${bungee.variable} ${baiJamjuree.variable}`}>{children}</div>;
  }

  if (checking) {
    return (
      <div
        className={`${bungee.variable} ${baiJamjuree.variable}`}
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f5f4' }}
      >
        <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 14, color: '#808080' }}>
          Loading…
        </span>
      </div>
    );
  }

  const NAV_LINKS = BASE_NAV_LINKS;

  const PAGE_TITLES = buildPageTitles(userName, userCompany);
  const pageInfo    = PAGE_TITLES[pathname] ?? { title: 'PORTAL', subtitle: '' };

  return (
    <div className={`${bungee.variable} ${baiJamjuree.variable}`} style={{ display: 'flex', minHeight: '100dvh' }}>
      <style>{`
        @media (min-width: 768px) { .portal-main { margin-left: 220px; } }
        .portal-header { padding: 0 32px; }
        @media (max-width: 767px) {
          .portal-header { padding: 0 16px; }
          .portal-header h1 { font-size: 16px !important; }
          .portal-header p  { display: none; }
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && !isDesktop && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 25 }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', top: 0, bottom: 0, left: 0,
        width: 220,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        zIndex: 30,
        transform: isDesktop || sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .22s ease',
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 20px 24px' }}>
          <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" height={36} style={{ display: 'block', width: 'auto' }} />
        </div>

        <div style={{ height: 1, margin: '0 20px', background: '#1f1f1f' }} />

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 12px 0' }}>
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || (href !== '/portal/dashboard' && pathname.startsWith(href));
            const isAdmin  = href === '/portal/admin';
            const activeBg = isAdmin ? '#5b2d8e' : '#e40586';
            return (
              <Link
                key={href}
                href={href}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center',
                  height: 40, borderRadius: 8,
                  paddingLeft: 16, paddingRight: 12,
                  fontFamily: 'var(--font-inter)', fontSize: 14, fontWeight: 600,
                  textDecoration: 'none',
                  background:   isActive ? activeBg : 'transparent',
                  color:        isActive ? '#fff' : '#808080',
                  transition: 'color .15s, background .15s',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 4, borderRadius: '8px 0 0 8px', background: '#0cf574',
                  }} />
                )}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + sign out */}
        <div style={{ padding: '16px 20px 24px' }}>
          <div style={{ height: 1, background: '#1f1f1f', marginBottom: 16 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#e40586',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-inter)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {userInitials}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-inter)', color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </div>
              <div style={{ fontFamily: 'var(--font-inter)', color: '#666', fontSize: 10, lineHeight: 1.3 }}>
                {userRole}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid #333',
              borderRadius: 8,
              padding: '8px 0',
              fontFamily: 'var(--font-inter)', fontSize: 12, fontWeight: 600,
              color: '#666',
              cursor: 'pointer',
              transition: 'border-color .15s, color .15s',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = '#e40586'; (e.target as HTMLButtonElement).style.color = '#e40586'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = '#333'; (e.target as HTMLButtonElement).style.color = '#666'; }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="portal-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f6f5f4' }}>
        {/* Header */}
        <header className="portal-header" style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 72,
          background: '#fff', borderBottom: '1px solid #e5e5e5',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Hamburger — hidden on desktop */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: isDesktop ? 'none' : 'flex' }}
              aria-label="Toggle menu"
            >
              <HamburgerIcon open={sidebarOpen} />
            </button>
            <div>
              <h1 style={{ fontFamily: 'var(--font-bungee)', fontSize: 20, color: '#0a0a0a', lineHeight: 1, margin: 0 }}>
                {pageInfo.title}
              </h1>
              {pageInfo.subtitle && (
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: 13, color: '#808080', margin: '3px 0 0' }}>
                  {pageInfo.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right', display: isDesktop ? 'block' : 'none' }}>
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, fontWeight: 600, color: '#0a0a0a', margin: 0 }}>
                {userName}
              </p>
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: '#808080', margin: 0 }}>
                {userRole}
              </p>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#e40586',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'var(--font-inter)', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                {userInitials}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
