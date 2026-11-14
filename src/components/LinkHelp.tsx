'use client';

// Shown instead of a dead end when an estimate or proposal link is missing its
// key (cut off by a mail app or a partial copy-paste): the client types the
// email it was sent to and gets a fresh link (POST /api/link-help). The page
// reads the same for any link, so it never says whether a document exists.

import { useState } from 'react';

export function LinkHelp({ kind, path, dark = false }: { kind: 'estimate' | 'proposal'; path: string; dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      const res = await fetch('/api/link-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, path }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'That didn’t go through. Please try again.');
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t go through. Please try again.');
      setState('idle');
    }
  }

  const ink = dark ? '#fff' : '#141414';
  const soft = dark ? 'rgba(255,255,255,0.7)' : '#4a4a4a';

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: dark ? '#000' : '#fff', color: ink }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <img src={dark ? '/new-thrive/logo-white.svg' : '/new-thrive/logo-mark-blk.svg'} alt="Thrive Creative Studios" style={{ height: 36, width: 'auto', marginBottom: 28 }} />
        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(30px, 7vw, 42px)', lineHeight: 1, fontWeight: 700, letterSpacing: '-0.065em' }}>
          {state === 'sent' ? 'Check your inbox' : 'This link is missing a piece'}
        </h1>
        {state === 'sent' ? (
          <p style={{ margin: 0, color: soft, lineHeight: 1.6, fontSize: 16 }}>
            If I’ve sent {kind === 'estimate' ? 'an estimate' : 'a proposal'} to {email}, a fresh link is on its way now. It can take a minute — check your spam folder too.
            I’ve also been let know, so I’ll reach out if you don’t get it.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 22px', color: soft, lineHeight: 1.6, fontSize: 16 }}>
              Links sometimes get cut short by email apps or when they’re copied. Enter the email address I sent your {kind} to, and I’ll send you a fresh link right away.
            </p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ fontSize: 16, padding: '14px 18px', borderRadius: 999, border: `1.5px solid ${dark ? 'rgba(255,255,255,0.35)' : '#d4d4d4'}`, background: dark ? '#141414' : '#fff', color: ink, fontFamily: 'inherit' }}
              />
              <button
                type="submit" disabled={state === 'sending'}
                style={{ fontSize: 16, fontWeight: 600, padding: '14px 22px', borderRadius: 999, border: 0, background: '#e50586', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: state === 'sending' ? 0.6 : 1 }}
              >
                {state === 'sending' ? 'Sending…' : 'Send Me a Fresh Link'}
              </button>
              {error && <p role="alert" style={{ margin: 0, color: dark ? '#fd6100' : '#e50586', fontSize: 14 }}>{error}</p>}
            </form>
            <p style={{ margin: '22px 0 0', color: soft, fontSize: 14, lineHeight: 1.5 }}>
              Or just reply to the email it came in and I’ll send it again.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
