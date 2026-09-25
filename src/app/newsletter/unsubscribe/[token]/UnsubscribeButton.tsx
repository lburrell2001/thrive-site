'use client';

import { useState } from 'react';
import s from '../../newsletter.module.css';

export default function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState('');

  async function go() {
    setState('working'); setError('');
    const res = await fetch(`/api/newsletter/unsubscribe?t=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => null);
    if (res?.ok) setState('done');
    else {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? 'Something went wrong — please try again.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return <p className={s.text} role="status">You&apos;re unsubscribed and won&apos;t get newsletters from Thrive again. Sorry to see you go!</p>;
  }
  return (
    <>
      <p className={s.text}>Stop receiving newsletters from Thrive Creative Studios? Emails about a project you&apos;re working on with us aren&apos;t affected.</p>
      {error && <p className={s.error} role="alert">{error}</p>}
      <button type="button" className={s.button} onClick={go} disabled={state === 'working'}>
        {state === 'working' ? 'ONE MOMENT…' : 'UNSUBSCRIBE'}
      </button>
    </>
  );
}
