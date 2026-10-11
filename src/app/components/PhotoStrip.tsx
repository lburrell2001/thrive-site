// A band of real project photos as tilted, taped-down prints, each linking to
// its case study. Scrolls sideways on phones.
import type { WorkPhoto } from "@/lib/workPhotos";
import s from "./PhotoStrip.module.css";

type Props = {
  photos: WorkPhoto[];
  title?: string;
  /** Smaller prints and no heading padding, to sit inside a hero or beside a form. */
  compact?: boolean;
  tone?: "light" | "dark";
};

export default function PhotoStrip({ photos, title, compact, tone = "light" }: Props) {
  return (
    <section className={`${s.strip} ${compact ? s.compact : ""} ${tone === "dark" ? s.dark : ""}`}>
      {title && (
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
        </div>
      )}
      <div className={s.row}>
        {photos.map((p) => (
          <a key={p.src} href={p.href} className={s.print}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.alt} loading="lazy" style={p.position ? { objectPosition: p.position } : undefined} />
            <span className={s.caption}>{p.caption}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
