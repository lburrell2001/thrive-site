'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from './proposals.module.css';

export interface ToastState {
  message: string;
  tone: 'ok' | 'error';
  key: number;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.tone === 'error' ? 6000 : 2800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div
      className={`${s.toast} ${toast.tone === 'error' ? s.toastError : ''}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
