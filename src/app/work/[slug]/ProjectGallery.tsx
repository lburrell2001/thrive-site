"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./ProjectPage.module.css";

type Item = { url: string; alt: string };

export default function ProjectGallery({ items, title }: { items: Item[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  // Phone screenshots (tall and narrow) get a phone frame, like the case studies.
  const [phones, setPhones] = useState<Set<string>>(new Set());
  const check = (url: string, el: HTMLImageElement | null) => {
    if (!el?.complete) return;
    const { naturalWidth: w, naturalHeight: h } = el;
    if (w && h / w >= 1.6) setPhones((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  };
  // An image already loaded before hydration never fires onLoad, so check on mount too.
  const onLoad = (url: string) => (e: React.SyntheticEvent<HTMLImageElement>) => check(url, e.currentTarget);

  const close = useCallback(() => setActive(null), []);
  const prev = useCallback(() => setActive(i => i === null ? null : (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setActive(i => i === null ? null : (i + 1) % items.length), [items.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (active === null) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, prev, next]);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = active !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  if (!items.length) return null;

  return (
    <>
      {/* Full-size image stack — click any to open shadowbox */}
      <div className={styles.galleryStack}>
        {items.map((img, i) => (
          <button
            key={img.url}
            type="button"
            className={`${styles.galleryStackItem} ${phones.has(img.url) ? styles.galleryStackPhone : ''}`}
            onClick={() => setActive(i)}
            aria-label={`Open photo ${i + 1}`}
          >
            {phones.has(img.url) ? (
              <span className={styles.galleryPhone}>
                <img src={img.url} alt={img.alt} loading="lazy" />
              </span>
            ) : (
              <img src={img.url} alt={img.alt} className={styles.galleryStackImg} loading="lazy" onLoad={onLoad(img.url)} ref={(el) => check(img.url, el)} />
            )}
          </button>
        ))}
      </div>

      {/* Shadowbox */}
      {active !== null && (
        <div className={styles.shadowbox} onClick={close} role="dialog" aria-modal="true" aria-label="Image gallery">
          <div className={styles.shadowboxInner} onClick={e => e.stopPropagation()}>

            {/* Top bar */}
            <div className={styles.shadowboxBar}>
              <span className={styles.shadowboxTitle}>{title} — {active + 1} / {items.length}</span>
              <button className={styles.shadowboxClose} onClick={close} aria-label="Close">✕</button>
            </div>

            {/* Image */}
            <div className={styles.shadowboxImgWrap}>
              <img
                key={items[active].url}
                src={items[active].url}
                alt={items[active].alt}
                className={styles.shadowboxImg}
                decoding="async"
              />
            </div>

            {/* Arrows */}
            {items.length > 1 && (
              <>
                <button className={`${styles.shadowboxArrow} ${styles.shadowboxArrowLeft}`} onClick={prev} aria-label="Previous">‹</button>
                <button className={`${styles.shadowboxArrow} ${styles.shadowboxArrowRight}`} onClick={next} aria-label="Next">›</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
