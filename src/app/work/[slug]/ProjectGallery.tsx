"use client";

import { useEffect, useState } from "react";
import styles from "./ProjectPage.module.css";

type Item = {
  url: string;
  alt: string;
};

export default function ProjectGallery({ items, title }: { items: Item[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);

  // Esc to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight" && active !== null) {
        setActive((prev) => (prev === null ? null : (prev + 1) % items.length));
      }
      if (e.key === "ArrowLeft" && active !== null) {
        setActive((prev) =>
          prev === null ? null : (prev - 1 + items.length) % items.length
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, items.length]);

  if (!items.length) return null;

  return (
    <>
      <div className={styles.gallery}>
        {items.map((img, i) => (
          <button
            key={img.url}
            type="button"
            className={styles.shot}
            onClick={() => setActive(i)}
            aria-label="Open image"
          >
            <img src={img.url} alt={img.alt} className={styles.shotImg} loading="lazy" />
          </button>
        ))}
      </div>

      {active !== null ? (
        <div className={styles.lightbox} onClick={() => setActive(null)} role="dialog" aria-modal="true">
          <div className={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxBar}>
              <div className={styles.lightboxTitle}>
                {title} • {active + 1}/{items.length}
              </div>
              <button className={styles.lightboxClose} onClick={() => setActive(null)}>
                Close
              </button>
            </div>

            <div className={styles.lightboxImgWrap}>
              <img
                src={items[active].url}
                alt={items[active].alt}
                className={styles.lightboxImg}
                decoding="async"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
