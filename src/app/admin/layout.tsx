'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bai_Jamjuree } from 'next/font/google';

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

  const isPortfolio = pathname?.startsWith('/admin/portfolio');
  const isServices  = pathname?.startsWith('/admin/services');

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
        @media (max-width: 640px) {
          .adm-hdr { height: auto; padding: 10px 16px 0; gap: 0; }
          .adm-hdr-brand { flex: 1; padding-bottom: 10px; }
          .adm-hdr-out { padding-bottom: 10px; }
          .adm-hdr-nav { flex: none; width: 100%; padding: 0 0 10px; border-top: 1px solid #1f1f1f; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .adm-hdr-nav::-webkit-scrollbar { display: none; }
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

        {/* Section nav — wraps below brand+signout on mobile */}
        <nav className="adm-hdr-nav">
          <a
            href="/admin"
            style={{
              fontFamily: F.inter, fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
              background: !isPortfolio && !isServices ? '#1f1f1f' : 'transparent',
              color: !isPortfolio && !isServices ? '#fff' : '#666',
              transition: 'background .15s, color .15s', whiteSpace: 'nowrap',
            }}
          >
            Clients
          </a>
          <a
            href="/admin/portfolio"
            style={{
              fontFamily: F.inter, fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
              background: isPortfolio ? '#e50586' : 'transparent',
              color: isPortfolio ? '#fff' : '#666',
              transition: 'background .15s, color .15s', whiteSpace: 'nowrap',
            }}
          >
            Portfolio
          </a>
          <a
            href="/admin/services"
            style={{
              fontFamily: F.inter, fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
              background: isServices ? '#fd6100' : 'transparent',
              color: isServices ? '#fff' : '#666',
              transition: 'background .15s, color .15s', whiteSpace: 'nowrap',
            }}
          >
            Services
          </a>
        </nav>
      </header>

      <main style={{ flex: 1, overflow: 'hidden' }}>{children}</main>
    </div>
  );
}
