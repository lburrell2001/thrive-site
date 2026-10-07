"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectCoverThumb } from "@/lib/storage";
import type { ReelProject } from "@/lib/workReel";
import s from "./WorkReel.module.css";

// A slow, looping strip of real project covers, each linking to its case
// study. Server pages pass `projects` (from loadReelProjects); client pages
// leave it out and the strip loads them from /api/work-reel.

const CHIP_COLORS = ["#e50586", "#3b43af", "#ea6b2c", "#861dc5", "#18c964"];

type Props = {
  projects?: ReelProject[];
  eyebrow?: string;
  title?: string;
  tone?: "light" | "dark";
  /** Leave this project out (e.g. the one being viewed). */
  exclude?: string;
};

export default function WorkReel({ projects: given, eyebrow = "Recent work", title, tone = "light", exclude }: Props) {
  const [loaded, setLoaded] = useState<ReelProject[] | null>(given ?? null);

  useEffect(() => {
    if (given) return;
    let live = true;
    fetch("/api/work-reel")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d: { projects?: ReelProject[] }) => { if (live) setLoaded(d.projects ?? []); })
      .catch(() => { if (live) setLoaded([]); });
    return () => { live = false; };
  }, [given]);

  const items = (loaded ?? []).filter((p) => p.slug !== exclude);
  if (loaded && items.length === 0) return null;

  // Two copies back to back so the strip loops seamlessly.
  const loop = [...items, ...items];

  return (
    <section className={`${s.reel} ${tone === "dark" ? s.dark : ""}`} aria-label={title ?? eyebrow}>
      {(eyebrow || title) && (
        <div className={s.head}>
          {eyebrow && <p className={s.eyebrow}>{eyebrow}</p>}
          {title && <h2 className={s.title}>{title}</h2>}
        </div>
      )}
      <div className={s.viewport}>
        <ul className={s.track} style={{ animationDuration: `${Math.max(items.length, 4) * 7}s` }}>
          {loaded === null
            ? Array.from({ length: 6 }, (_, i) => <li key={i} className={`${s.card} ${s.skeleton}`} aria-hidden />)
            : loop.map((p, i) => (
                <li
                  key={`${p.slug}-${i}`}
                  className={s.card}
                  style={{ ["--tilt" as string]: `${i % 2 ? 1.6 : -1.6}deg` }}
                  aria-hidden={i >= items.length || undefined}
                >
                  <Link href={`/work/${p.slug}`} tabIndex={i >= items.length ? -1 : undefined}>
                    <span className={s.imgWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={projectCoverThumb(p.slug)} alt={`${p.title} cover`} loading="lazy" decoding="async" />
                      {p.category && (
                        <span className={s.chip} style={{ background: CHIP_COLORS[i % CHIP_COLORS.length] }}>
                          {p.category.split(/[,·/]/)[0].trim()}
                        </span>
                      )}
                    </span>
                    <span className={s.name}>{p.title}</span>
                  </Link>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
