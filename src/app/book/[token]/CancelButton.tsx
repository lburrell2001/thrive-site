'use client';

import { useState } from 'react';
import Link from 'next/link';
import s from '../book.module.css';

export default function CancelButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState('');

  async function cancel() {
    if (!window.confirm('Cancel this call?')) return;
    setState('working'); setError('');
    const res = await fetch(`/api/booking/${token}/cancel`, { method: 'POST' }).catch(() => null);
    if (res?.ok) setState('done');
    else {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? 'Could not cancel — please try again.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return <p className={s.lede} role="status">Cancelled. <Link href="/book">Pick a new time →</Link></p>;
  }
  return (
    <div className={s.form}>
      {error && <p className={s.error} role="alert">{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" className={s.submit} onClick={cancel} disabled={state === 'working'}>
          {state === 'working' ? 'CANCELLING…' : 'CANCEL THIS CALL'}
        </button>
      </div>
    </div>
  );
}
