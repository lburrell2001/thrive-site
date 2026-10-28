'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bai_Jamjuree } from 'next/font/google';
import { markThisBrowserAsAdmin } from '../components/SiteTracker';
import { adminAuth, adminHeaders, adminSignOut, rememberPasscode, storedPasscode } from '@/lib/adminSession';

const baiJamjuree = Bai_Jamjuree({ weight: ['400', '600', '700'], subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const F = {
  bungee: `var(--font-bungee), 'Bungee', sans-serif`,
  inter:  `var(--font-inter),  'Inter',  sans-serif`,
};

type Stage = 'checking' | 'login' | 'code' | 'enroll' | 'passcode' | 'in';

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1a1a1a', border: '1.5px solid #333',
  borderRadius: 8, padding: '12px 14px',
  fontFamily: F.inter, fontSize: 14, color: '#fff',
  outline: 'none',
};
const labelStyle: React.CSSProperties = { fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 };

function SubmitButton({ busy, disabled, children }: { busy: boolean; disabled: boolean; children: React.ReactNode }) {
  const off = busy || disabled;
  return (
    <button
      type="submit"
      disabled={off}
      style={{
        background: off ? '#333' : '#e40586',
        color: '#fff', border: 'none', borderRadius: 8,
        padding: '12px 0', fontFamily: F.inter, fontSize: 14, fontWeight: 700,
        cursor: off ? 'default' : 'pointer', transition: 'background .15s',
      }}
    >
      {busy ? 'Checking…' : children}
    </button>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [stage,     setStage]     = useState<Stage>('checking');
  const [passcodeOn, setPasscodeOn] = useState(false);
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [code,      setCode]      = useState('');
  const [passcode,  setPasscode]  = useState('');
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const pathname = usePathname();

  /** After a password sign-in (or on load with a session): what's still needed. */
  const nextStep = useCallback(async () => {
    const { data } = await adminAuth.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === 'aal2') {
      // The server decides whether this account is an admin.
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { ...(await adminHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      if (!res.ok) {
        await adminSignOut();
        setError('That account does not have admin access.');
        setStage('login');
        return;
      }
      markThisBrowserAsAdmin();
      setStage('in');
    } else if (data?.nextLevel === 'aal2') {
      setStage('code');
    } else {
      setStage('enroll');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const mode = await fetch('/api/admin').then((r) => r.json()).catch(() => ({ passcode: false })) as { passcode?: boolean };
      setPasscodeOn(!!mode.passcode);
      const { data: { session } } = await adminAuth.auth.getSession();
      if (session) return nextStep();
      if (mode.passcode && storedPasscode()) return setStage('in');
      setStage('login');
    })();
  }, [nextStep]);

  // First time with an account: pair the authenticator app.
  useEffect(() => {
    if (stage !== 'enroll' || enrollment) return;
    (async () => {
      // Clear half-finished pairings from earlier attempts first.
      const { data: factors } = await adminAuth.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status === 'unverified') await adminAuth.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await adminAuth.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Thrive admin ${new Date().toISOString().slice(0, 10)}` });
      if (enrollError || !data) { setError('Could not start authenticator setup. Try again.'); return; }
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [stage, enrollment]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: signInError } = await adminAuth.auth.signInWithPassword({ email: email.trim(), password });
    setPassword('');
    if (signInError) { setError('Email or password is incorrect.'); setBusy(false); return; }
    await nextStep();
    setBusy(false);
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    let factorId = enrollment?.factorId;
    if (!factorId) {
      const { data } = await adminAuth.auth.mfa.listFactors();
      factorId = data?.totp?.[0]?.id;
    }
    if (!factorId) { setError('No authenticator is set up for this account.'); setBusy(false); return; }
    const { error: verifyError } = await adminAuth.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setCode('');
    if (verifyError) { setError('That code didn\'t work. Codes change every 30 seconds — try the current one.'); setBusy(false); return; }
    setEnrollment(null);
    await nextStep();
    setBusy(false);
  }

  async function handlePasscode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'X-Admin-Passcode': passcode, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setError(res.status === 429 ? (data.error ?? 'Too many tries.') : (data.error && res.status === 401 && data.error.includes('turned off') ? data.error : 'Incorrect passcode. Try again.'));
      } else {
        rememberPasscode(passcode);
        // Lauren's own visits to the site should not count as traffic.
        markThisBrowserAsAdmin();
        setStage('in');
      }
    } catch {
      setError('Connection error. Try again.');
    }
    setPasscode('');
    setBusy(false);
  }

  async function handleSignOut() {
    await adminSignOut();
    setEnrollment(null);
    setStage('login');
  }

  if (stage === 'checking') {
    return (
      <div className={`${baiJamjuree.variable}`}
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <span style={{ fontFamily: F.inter, fontSize: 14, color: '#666' }}>Loading…</span>
      </div>
    );
  }

  if (stage !== 'in') {
    const hint = (text: string) => <p style={{ fontFamily: F.inter, fontSize: 13, color: '#888', margin: 0, lineHeight: 1.55 }}>{text}</p>;
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

          {stage === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="adm-email">EMAIL</label>
                <input id="adm-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="adm-password">PASSWORD</label>
                <input id="adm-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
              </div>
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{error}</p>}
              <SubmitButton busy={busy} disabled={!email || !password}>Sign in</SubmitButton>
              {passcodeOn && (
                <button type="button" onClick={() => { setError(''); setStage('passcode'); }}
                  style={{ background: 'none', border: 0, color: '#888', fontFamily: F.inter, fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  Use the passcode instead
                </button>
              )}
            </form>
          )}

          {stage === 'code' && (
            <form onSubmit={handleCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {hint('Enter the 6-digit code from your authenticator app.')}
              <input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus
                style={{ ...fieldStyle, fontSize: 22, letterSpacing: '0.3em', textAlign: 'center' }} />
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{error}</p>}
              <SubmitButton busy={busy} disabled={code.length !== 6}>Verify</SubmitButton>
              <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 0, color: '#888', fontFamily: F.inter, fontSize: 12, cursor: 'pointer' }}>Use a different account</button>
            </form>
          )}

          {stage === 'enroll' && (
            <form onSubmit={handleCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {hint('One-time setup: scan this with an authenticator app on your phone (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows.')}
              {enrollment ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qr} alt="Authenticator QR code" style={{ width: 200, height: 200, background: '#fff', borderRadius: 12, padding: 10, alignSelf: 'center' }} />
                  <p style={{ fontFamily: F.inter, fontSize: 11, color: '#666', margin: 0, wordBreak: 'break-all', textAlign: 'center' }}>
                    Can&apos;t scan? Enter this key: <span style={{ color: '#bbb' }}>{enrollment.secret}</span>
                  </p>
                </>
              ) : !error && hint('Preparing…')}
              <input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ ...fieldStyle, fontSize: 22, letterSpacing: '0.3em', textAlign: 'center' }} />
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{error}</p>}
              <SubmitButton busy={busy} disabled={!enrollment || code.length !== 6}>Finish setup</SubmitButton>
              <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 0, color: '#888', fontFamily: F.inter, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </form>
          )}

          {stage === 'passcode' && (
            <form onSubmit={handlePasscode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="adm-passcode">PASSCODE</label>
                <input id="adm-passcode" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Enter admin passcode" autoFocus style={fieldStyle} />
              </div>
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e40586', margin: 0 }}>{error}</p>}
              <SubmitButton busy={busy} disabled={!passcode}>Enter Admin</SubmitButton>
              <button type="button" onClick={() => { setError(''); setStage('login'); }} style={{ background: 'none', border: 0, color: '#888', fontFamily: F.inter, fontSize: 12, cursor: 'pointer' }}>
                Sign in with your account instead
              </button>
            </form>
          )}

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
      { href: '/admin/crm/proposals', label: 'Proposals', color: '#5b2d8e', desc: 'Build, send and track' },
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
  { href: '/admin/security', label: 'Security', color: '#1f1f1f' },
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
