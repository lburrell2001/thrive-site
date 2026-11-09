'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { markThisBrowserAsAdmin } from '../components/SiteTracker';
import { adminAuth, adminHeaders, adminSignOut, rememberPasscode, storedPasscode } from '@/lib/adminSession';
import { AdminWorkspace } from './AdminWorkspace';


// The site's type (Poppins, loaded in the root layout as --rd-sans).
const F = {
  inter: `var(--rd-sans), system-ui, sans-serif`,
};

type Stage = 'checking' | 'login' | 'code' | 'enroll' | 'passcode' | 'in';

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#1c1c1c', border: '1.5px solid #333',
  borderRadius: 999, padding: '12px 18px',
  fontFamily: F.inter, fontSize: 14, color: '#fff',
  outline: 'none',
};
const labelStyle: React.CSSProperties = { fontFamily: F.inter, fontSize: 13, fontWeight: 600, color: '#9a9a9a', display: 'block', marginBottom: 6 };

function SubmitButton({ busy, disabled, children }: { busy: boolean; disabled: boolean; children: React.ReactNode }) {
  const off = busy || disabled;
  return (
    <button
      type="submit"
      disabled={off}
      style={{
        background: off ? '#333' : '#e50586',
        color: '#fff', border: 'none', borderRadius: 999,
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
      <div 
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414' }}>
        <span style={{ fontFamily: F.inter, fontSize: 14, color: '#666' }}>Loading…</span>
      </div>
    );
  }

  if (stage !== 'in') {
    const hint = (text: string) => <p style={{ fontFamily: F.inter, fontSize: 13, color: '#888', margin: 0, lineHeight: 1.55 }}>{text}</p>;
    return (
      <div 
        style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <img src="/new-thrive/logo-white.svg" alt="Thrive Creative Studios" style={{ height: 28, width: 'auto' }} />
            <div style={{ fontFamily: F.inter, fontSize: 12, color: '#8a8a8a', fontWeight: 600 }}>
              Admin Access
            </div>
          </div>

          {stage === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="adm-email">Email</label>
                <input id="adm-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="adm-password">Password</label>
                <input id="adm-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
              </div>
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e50586', margin: 0 }}>{error}</p>}
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
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e50586', margin: 0 }}>{error}</p>}
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
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e50586', margin: 0 }}>{error}</p>}
              <SubmitButton busy={busy} disabled={!enrollment || code.length !== 6}>Finish setup</SubmitButton>
              <button type="button" onClick={handleSignOut} style={{ background: 'none', border: 0, color: '#888', fontFamily: F.inter, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </form>
          )}

          {stage === 'passcode' && (
            <form onSubmit={handlePasscode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="adm-passcode">Passcode</label>
                <input id="adm-passcode" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Enter admin passcode" autoFocus style={fieldStyle} />
              </div>
              {error && <p style={{ fontFamily: F.inter, fontSize: 13, color: '#e50586', margin: 0 }}>{error}</p>}
              <SubmitButton busy={busy} disabled={!passcode}>Enter Admin</SubmitButton>
              <button type="button" onClick={() => { setError(''); setStage('login'); }} style={{ background: 'none', border: 0, color: '#888', fontFamily: F.inter, fontSize: 12, cursor: 'pointer' }}>
                Sign in with your account instead
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 32 }}>
            <Link
              href="/"
              style={{ fontFamily: F.inter, fontSize: 12, fontWeight: 600, color: '#e50586', textDecoration: 'none' }}
            >
              ← Return to Homepage
            </Link>
            <p style={{ fontFamily: F.inter, fontSize: 12, color: '#444', margin: 0 }}>
              Thrive Creative Studios — Admin Portal
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <style>{`
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
      <AdminWorkspace onSignOut={handleSignOut}>{children}</AdminWorkspace>
    </div>
  );
}
