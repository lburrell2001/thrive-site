'use client';

// Fade-ins for the redesign: anything with the shared `rise` class inside the
// returned ref gets `in` once it scrolls into view.

import { useEffect, useRef } from 'react';
import s from './redesign.module.css';

export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add(s.in); obs.unobserve(e.target); }
    }), { threshold: 0.12 });
    root.querySelectorAll(`.${s.rise}:not(.${s.in})`).forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
