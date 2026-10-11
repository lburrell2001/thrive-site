'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bai_Jamjuree } from 'next/font/google';
import { markThisBrowserAsAdmin } from '../components/SiteTracker';

const baiJamjuree = Bai_Jamjuree({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed,    setAuthed]    = useState(false);
  const [checking,  setChecking]  = useState(true);
  const [passcode,  setPasscode]  = useState('');
  const [error,     setError]     = useState('');
  const [verifying, setVerifying] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_passcode');
    if (stored) setAuthed(true);
    setChecking(false);
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true); setError('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'X-Admin-Passcode': passcode, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setError('Incorrect passcode. Try again.');
        setVerifying(false);
        return;
      }
      sessionStorage.setItem('admin_passcode', passcode);
      // Lauren's own visits to the site should not count as traffic.
      markThisBrowserAsAdmin();
      setAuthed(true);
    } catch {
      setError('Connection error. Try again.');
    }
    setVerifying(false);
  }

  function handleSignOut() {
    sessionStorage.removeItem('admin_passcode');
    setAuthed(false);
    setPasscode('');
  }

  if (checking) {
    return (
      <div className={`${baiJamjuree.variable}`}
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <span style={{ fontFamily: F.inter, fontSize: 14, color: '#666' }}>Loading…</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className={`${baiJamjuree.variable}`}
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" style={{ height: 28, width: 'auto' }} />
            <div style={{ fontFamily: F.inter, fontSize: 9, color: '#666', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              ADMIN ACCESS
            </div>
          </div>

          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>
                PASSCODE
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#1a1a1a', border: '1.5px solid #333',
                  borderRadius: 8, padding: '12px 14px',
                  fontFamily: F.inter, fontSize: 14, color: '#fff',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={verifying || !passcode}
              style={{
                background: verifying || !passcode ? '#333' : '#e40586',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px 0', fontFamily: F.inter, fontSize: 14, fontWeight: 700,
                cursor: verifying || !passcode ? 'default' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {verifying ? 'Verifying…' : 'Enter Admin'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 32 }}>
            <a
              href="/"
              style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#e50586', textDecoration: 'none' }}
            >
              ← Return to Homepage
            </a>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#444', margin: 0 }}>
              Thrive Creative Studios — Admin Portal
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${baiJamjuree.variable}`} style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f6f5f4' }}>
      <style>{`
        .adm-hdr {
          position: sticky; top: 0; z-index: 20; flex-shrink: 0;
          display: flex; align-items: center; flex-wrap: wrap;
          padding: 0 32px; height: 64px;
          background: #0a0a0a; border-bottom: 1px solid #1f1f1f;
          box-sizing: border-box;
        }
        .adm-hdr-brand { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .adm-hdr-nav { display: flex; gap: 4px; flex: 1; padding: 0 24px; }
        .adm-hdr-out { flex-shrink: 0; }
        .adm-nav-link {
          font-family: var(--font-inter), 'Inter', sans-serif; font-size: 12px; font-weight: 600;
          padding: 6px 14px; border-radius: 6px; text-decoration: none; white-space: nowrap;
          background: transparent; color: #888; border: 0; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          transition: background .15s, color .15s;
        }
        .adm-nav-link:hover { color: #fff; background: #1a1a1a; }
        .adm-nav-link:focus-visible { outline: 2px solid #e40586; outline-offset: 2px; }
        .adm-nav-group { position: relative; }
        .adm-nav-caret { font-size: 9px; opacity: .7; transition: transform .15s; }
        .adm-nav-group[data-open="true"] .adm-nav-caret { transform: rotate(180deg); }
        .adm-nav-menu {
          position: absolute; top: calc(100% + 8px); left: 0; z-index: 30; min-width: 190px;
          display: flex; flex-direction: column; padding: 6px;
          background: #141414; border: 1px solid #262626; border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0,0,0,.45);
        }
        .adm-nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px;
          font-family: var(--font-inter), 'Inter', sans-serif; font-size: 13px; font-weight: 600;
          color: #bbb; text-decoration: none;
        }
        .adm-nav-item:hover, .adm-nav-item:focus-visible { background: #1f1f1f; color: #fff; outline: none; }
        .adm-nav-item[aria-current="page"] { color: #fff; }
        .adm-nav-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .adm-nav-desc { display: block; font-size: 11px; font-weight: 400; color: #777; margin-top: 1px; }
        @media (max-width: 640px) {
          .adm-hdr { height: auto; padding: 10px 16px 0; gap: 0; }
          .adm-hdr-brand { flex: 1; padding-bottom: 10px; }
          .adm-hdr-out { padding-bottom: 10px; order: 1; }
          .adm-hdr-nav { order: 2; flex: none; width: 100%; padding: 8px 0 10px; border-top: 1px solid #1f1f1f; gap: 2px; }
          .adm-nav-link { padding: 6px 10px; }
          .adm-nav-group:last-child .adm-nav-menu { left: auto; right: 0; }
        }
        input[type="date"] { cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 1;
          cursor: pointer;
          width: 16px;
          height: 16px;
          filter: invert(45%);
          margin-left: 6px;
        }
      `}</style>

      {/* Admin header */}
      <header className="adm-hdr">
        <div className="adm-hdr-brand">
          <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" style={{ height: 24, width: 'auto' }} />
          <div style={{ fontFamily: F.inter, fontSize: 8, color: '#5b2d8e', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            ADMIN
          </div>
        </div>

        <AdminNav pathname={pathname ?? ''} />

        <button
          className="adm-hdr-out"
          onClick={handleSignOut}
          style={{
            background: 'transparent', border: '1px solid #333', borderRadius: 8,
            padding: '7px 16px', fontFamily: F.inter, fontSize: 12, fontWeight: 600,
            color: '#666', cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = '#e40586'; (e.target as HTMLButtonElement).style.color = '#e40586'; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = '#333'; (e.target as HTMLButtonElement).style.color = '#666'; }}
        >
          Sign Out
        </button>
      </header>

      <main style={{ flex: 1, overflow: 'hidden' }}>{children}</main>
    </div>
  );
}

// The admin sections, grouped so the header stays short. A group's
// button names the page you're on, in that page's colour.
type NavLink = { href: string; label: string; color: string; desc?: string };
type NavEntry = NavLink | { label: string; items: NavLink[] };

const NAV: NavEntry[] = [
  { href: '/admin', label: 'Home', color: '#1f1f1f' },
  { href: '/admin/crm', label: 'CRM', color: '#1e3add' },
  {
    label: 'Clients',
    items: [
      { href: '/admin/clients', label: 'Clients', color: '#555', desc: 'Portal logins, invoices, onboarding' },
      { href: '/admin/proposals', label: 'Proposals', color: '#5b2d8e', desc: 'Build, send and track' },
      { href: '/admin/calls', label: 'Calls', color: '#0f766e', desc: 'Bookings and booking hours' },
      { href: '/admin/reviews', label: 'Reviews', color: '#b45309', desc: 'Approve client reviews' },
    ],
  },
  {
    label: 'Website',
    items: [
      { href: '/admin/analytics', label: 'Analytics', color: '#0a7d4a', desc: 'Traffic, sources, link builder' },
      { href: '/admin/journal', label: 'Journal', color: '#c2410c', desc: 'Articles' },
      { href: '/admin/portfolio', label: 'Portfolio', color: '#e50586', desc: 'Projects and case studies' },
      { href: '/admin/services', label: 'Services', color: '#fd6100', desc: 'Service pages' },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

function AdminNav({ pathname }: { pathname: string }) {
  // The open menu remembers the page it was opened on, so it closes by
  // itself once you navigate.
  const [menu, setMenu] = useState<{ label: string; path: string } | null>(null);
  const open = menu?.path === pathname ? menu.label : null;
  const setOpen = (label: string | null) => setMenu(label ? { label, path: pathname } : null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!navRef.current?.contains(e.target as Node)) setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav className="adm-hdr-nav" ref={navRef} aria-label="Admin">
      {NAV.map((entry) => {
        if ('href' in entry) {
          const on = isActive(pathname, entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="adm-nav-link"
              aria-current={on ? 'page' : undefined}
              style={on ? { background: entry.color, color: '#fff' } : undefined}
            >
              {entry.label}
            </Link>
          );
        }
        const current = entry.items.find((item) => isActive(pathname, item.href));
        const isOpen = open === entry.label;
        const menuId = `adm-nav-${entry.label.toLowerCase()}`;
        return (
          <div key={entry.label} className="adm-nav-group" data-open={isOpen}>
            <button
              type="button"
              className="adm-nav-link"
              aria-expanded={isOpen}
              aria-controls={menuId}
              onClick={() => setOpen(isOpen ? null : entry.label)}
              style={current ? { background: current.color, color: '#fff' } : undefined}
            >
              {current && current.label !== entry.label ? `${entry.label} · ${current.label}` : entry.label}
              <span className="adm-nav-caret" aria-hidden>▼</span>
            </button>
            {isOpen && (
              <div className="adm-nav-menu" id={menuId}>
                {entry.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="adm-nav-item"
                    aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                    onClick={() => setOpen(null)}
                  >
                    <span className="adm-nav-dot" style={{ background: item.color }} />
                    <span>
                      {item.label}
                      {item.desc && <span className="adm-nav-desc">{item.desc}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
