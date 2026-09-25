'use client';

// The footer's "Stay in the Loop" box. Double opt-in: this sends a confirm
// email, and nobody is on the list until they click it.

import { useState } from 'react';

export default function NewsletterSignup({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending'); setError('');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong — please try again.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return <p role="status" style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5 }}>Almost there — check your inbox and tap the link to confirm.</p>;
  }

  return (
    <form className={className} onSubmit={submit}>
      <input
        type="email"
        placeholder="Your email address"
        aria-label="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      {/* Honeypot for bots; hidden from people and screen readers. */}
      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ position: 'absolute', left: -10000, width: 1, height: 1, opacity: 0 }}
      />
      <button type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'SENDING…' : 'SUBSCRIBE →'}</button>
      {error && <p role="alert" style={{ flexBasis: '100%', margin: '6px 0 0', fontSize: 13, color: '#b00020' }}>{error}</p>}
    </form>
  );
}
