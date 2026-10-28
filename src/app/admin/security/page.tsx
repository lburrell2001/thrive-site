'use client';

// Security: replace the shared admin passcode with an admin account (email,
// password and an authenticator-app code). The order is enforced so it can't
// lock Lauren out: make the account, sign in with it once (which pairs the
// authenticator), and only then can the passcode be turned off.

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import { adminAuth, adminHeaders, adminSignOut } from '@/lib/adminSession';
import { formatDate } from '../proposals/adminApi';

type Status = {
  passcodeOn: boolean;
  accounts: { id: string; email: string; authenticator: boolean; last_sign_in_at: string | null }[];
  signedInAs: string | null;
};

async function adminAction<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { ...(await adminHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export default function SecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try { setStatus(await adminAction<Status>('security_status')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setNote('');
    if (password.length < 12) { setError('Use at least 12 characters — a short sentence works well.'); return; }
    if (password !== confirm) { setError('The passwords don’t match.'); return; }
    setBusy(true);
    try {
      await adminAction('create_admin_account', { email, password });
      // Sign in with it straight away; the sign-in screen then walks through
      // pairing the authenticator app.
      await adminSignOut();
      const { error: signInError } = await adminAuth.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw new Error('Account created, but signing in failed. Reload and sign in with it.');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
      setBusy(false);
    }
  }

  async function retirePasscode() {
    setBusy(true); setError(''); setNote('');
    try {
      await adminAction('retire_passcode');
      setNote('The passcode is off. Admin now needs your account and authenticator code.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn the passcode off');
    }
    setBusy(false);
  }

  const hasAccount = (status?.accounts.length ?? 0) > 0;

  return (
    <div className={p.screen}>
      <div className={p.wrap} style={{ maxWidth: 720 }}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>Security</h1>
            <p className={p.pageSub}>
              Admin sign-in uses an account with a password and a code from an authenticator app on your phone,
              instead of a shared passcode.
            </p>
          </div>
        </div>

        {status === null && !error && <p className={p.empty}>Loading…</p>}
        {error && <p style={{ color: '#c40473', fontSize: 14, margin: '0 0 16px' }}>{error}</p>}
        {note && <p style={{ color: '#1a8a4a', fontSize: 14, margin: '0 0 16px' }}>{note}</p>}

        {status && (
          <>
            <section className={p.card} style={{ marginBottom: 20 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Status</h2>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
                <li>Passcode: <b>{status.passcodeOn ? 'still on' : 'off'}</b></li>
                <li>Signed in now with: <b>{status.signedInAs ? `${status.signedInAs} + authenticator` : 'the passcode'}</b></li>
                {status.accounts.map((a) => (
                  <li key={a.id}>
                    Admin account <b>{a.email}</b> — authenticator {a.authenticator ? 'paired' : <b>not paired yet</b>}
                    {a.last_sign_in_at ? `, last sign-in ${formatDate(a.last_sign_in_at)}` : ''}
                  </li>
                ))}
              </ul>
            </section>

            {!hasAccount && (
              <section className={p.card} style={{ marginBottom: 20 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>1. Create your admin account</h2>
                <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666' }}>
                  Use an email only you can open, not one of your client portal logins. Next you&apos;ll scan a QR code
                  with an authenticator app (Google Authenticator, 1Password, Authy…).
                </p>
                <form onSubmit={createAccount}>
                  <div className={p.field}>
                    <label className={p.label} htmlFor="sec-email">Email</label>
                    <input id="sec-email" className={p.input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className={p.field}>
                    <label className={p.label} htmlFor="sec-pass">Password (12+ characters)</label>
                    <input id="sec-pass" className={p.input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <div className={p.field}>
                    <label className={p.label} htmlFor="sec-confirm">Confirm password</label>
                    <input id="sec-confirm" className={p.input} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                  </div>
                  <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={busy}>{busy ? 'Creating…' : 'Create account and set up authenticator'}</button>
                </form>
              </section>
            )}

            {hasAccount && status.passcodeOn && (
              <section className={p.card} style={{ marginBottom: 20 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>2. Turn off the passcode</h2>
                {status.signedInAs ? (
                  <>
                    <p style={{ margin: '0 0 16px', fontSize: 14, color: '#666' }}>
                      You&apos;re signed in with your account and authenticator, so it&apos;s safe to switch the passcode off.
                      After this, nobody can get into admin with the passcode.
                    </p>
                    <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={retirePasscode} disabled={busy}>Turn off the passcode</button>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
                    Sign out, then sign in with your admin account (you&apos;ll pair the authenticator the first time).
                    Come back here to switch the passcode off.
                  </p>
                )}
              </section>
            )}

            <section className={p.card}>
              <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>If you lose your phone</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#666', lineHeight: 1.6 }}>
                In Supabase, open Authentication → Users, find your admin email and remove its MFA factor. The next
                sign-in will ask you to pair a new phone. Keep your authenticator backed up (1Password and Authy sync
                across devices) so this is rarely needed.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
