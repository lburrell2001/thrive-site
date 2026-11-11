'use client';

// A photography project: just the photos. The name and a small line on top,
// every photo whole (never cropped) in a masonry of columns, and a full-screen
// viewer with arrows, swipe and Esc. Then the next project and the closing band.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { caseImageUrl } from '@/lib/storage';
import type { CaseImage } from '../../work/caseStudies';
import CtaBand from '../CtaBand';
import { rd } from '../links';
import { useReveal } from '../useReveal';
import s from '../redesign.module.css';
import p from './project.module.css';
import g from './photos.module.css';

export default function PhotoView({ title, line, photos, next }: {
  title: string;
  /** e.g. "Photography · 2026" */
  line?: string;
  photos: CaseImage[];
  next: { slug: string; title: string; category: string | null } | null;
}) {
  const root = useReveal<HTMLDivElement>();
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length)), [photos.length]);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, close, step]);

  return (
    <div ref={root}>
      <section className={g.head}>
        <h1 className={`${s.display} ${g.title}`}>{title}</h1>
        {line && <p className={g.line}>{line}</p>}
      </section>

      <div className={g.masonry}>
        {photos.map((ph, i) => (
          <button key={ph.src} type="button" className={`${g.photo} ${s.rise}`} onClick={() => setOpen(i)} aria-label={`View larger: ${ph.alt || `photo ${i + 1}`}`}>
            <img src={caseImageUrl(ph.src, 1200)} alt={ph.alt} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className={g.viewer} role="dialog" aria-modal="true" aria-label={`${title}: photo ${open + 1} of ${photos.length}`} onClick={close}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}>
          <img key={photos[open].src} src={caseImageUrl(photos[open].src, 2400)} alt={photos[open].alt} onClick={(e) => e.stopPropagation()} />
          <span className={g.count}>{open + 1} / {photos.length}</span>
          <button type="button" className={`${g.btn} ${g.close}`} onClick={close} aria-label="Close">✕</button>
          {photos.length > 1 && (
            <>
              <button type="button" className={`${g.btn} ${g.prev}`} onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous photo">←</button>
              <button type="button" className={`${g.btn} ${g.next}`} onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next photo">→</button>
            </>
          )}
        </div>
      )}

      {next && (
        <Link href={rd(`/work/${next.slug}`)} className={p.next}>
          <span className={`${s.display} ${p.nextTitle}`}>Next: {next.title}</span>
          {next.category && <span className={p.nextCat}>{next.category.split(',')[0]}</span>}
          <span className={p.nextArrow} aria-hidden>→</span>
        </Link>
      )}

      <CtaBand />
    </div>
  );
}
