"use client";

// /portfolio: an editorial grid of every project (big and small tiles on a
// black band), filter pills, a case study teaser and the closing ask. Real
// projects only — tiles show a colour block until their cover loads.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bungee, Bai_Jamjuree } from "next/font/google";
import PublicLayout from "../components/PublicLayout";
import ScrollReveal from "../components/ScrollReveal";
import { projectCoverThumb } from "@/lib/storage";
import s from "./Portfolio.module.css";

const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee", display: "swap" });
const baiJamjuree = Bai_Jamjuree({ weight: ["400", "600", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-bai", display: "swap" });

type Project = { id: string; title: string; slug: string; category: string | null; tagline: string | null };
type CaseStudy = { title: string; slug: string; category: string | null; problem: string; solution: string; results: string };

// Filter tags as stored in projects.category. "Digital Design" there means
// graphics work, not the web service — keep the label as it is.
const CATEGORIES = ["All", "Brand Design", "Digital Design", "UX Design", "Social Media", "Photography"];

// Palette for tiles and overlays; text colour picked for contrast on each.
const PALETTE = [
  { bg: "#d22e84", fg: "#fff" },
  { bg: "#eb6b2c", fg: "#000" },
  { bg: "#3b43b0", fg: "#fff" },
  { bg: "#71f182", fg: "#000" },
  { bg: "#871dc6", fg: "#fff" },
];
const PILL_COLORS: Record<string, string> = {
  "Brand Design": "#3b43b0", "Digital Design": "#d22e84", "UX Design": "#eb6b2c", "Social Media": "#71f182", Photography: "#871dc6",
};

const parts = (category: string | null) => (category ?? "").split(",").map((x) => x.trim()).filter(Boolean);
/** The first part of the category reads as what we made: "Branding · Music". */
const servicesLine = (category: string | null) => parts(category)[0] ?? "";
const matches = (category: string | null, filter: string) => filter === "All" || parts(category).includes(filter);

// Desktop layout, 6 columns: rows of [4+2 tall], [2+2+2], [3+3 tall], repeating.
// A last row that isn't full shares the six columns evenly.
const ROWS = [{ cols: [4, 2], tall: true }, { cols: [2, 2, 2], tall: false }, { cols: [3, 3], tall: true }];
function layout(n: number) {
  const out: { col: number; tall: boolean }[] = [];
  let r = 0;
  while (out.length < n) {
    const row = ROWS[r % ROWS.length];
    const left = n - out.length;
    const cols = left >= row.cols.length ? row.cols : Array(left).fill(6 / left);
    cols.forEach((col) => out.push({ col, tall: row.tall }));
    r++;
  }
  return out;
}

export default function PortfolioClient({ projects, caseStudy }: { projects: Project[]; caseStudy: CaseStudy | null }) {
  const [filter, setFilter] = useState("All");
  const shown = useMemo(() => projects.filter((p) => matches(p.category, filter)), [projects, filter]);
  const spans = layout(shown.length);

  return (
    <PublicLayout>
      <div className={`${bungee.variable} ${baiJamjuree.variable} ${s.page}`}>
        <ScrollReveal />

        {/* ── HEADER ── */}
        <section className={s.hero}>
          <span className={s.ghost} aria-hidden>WORK</span>
          <h1 className={s.h1}>
            Work that refuses to <span className={s.beige}>blend in.</span>
          </h1>
          <p className={s.lede}>Brands, websites, apps and content we&apos;ve made — every one built to stand out, never to fit in.</p>

          <div className={s.filters} role="group" aria-label="Filter projects">
            {CATEGORIES.map((cat) => {
              const on = filter === cat;
              const color = PILL_COLORS[cat] ?? "#000";
              const dark = color === "#71f182" || color === "#eb6b2c";
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={on}
                  className={`${s.pill} ${on ? s.pillOn : ""}`}
                  style={on ? { background: color, color: cat === "All" ? "#fff" : dark ? "#000" : "#fff" } : undefined}
                  onClick={() => setFilter(cat)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── GRID ── */}
        <section className={s.gridBand} aria-label="Projects">
          {shown.length === 0 ? (
            <p className={s.empty}>Nothing here yet.</p>
          ) : (
            <ul className={s.grid}>
              {shown.map((p, i) => {
                const tone = PALETTE[i % PALETTE.length];
                const { col, tall } = spans[i];
                return (
                  <li
                    key={p.id}
                    className={s.cell}
                    data-wide={col >= 4 || undefined}
                    data-reveal
                    style={{ "--col": col, "--rows": tall ? 2 : 1, "--reveal-delay": `${(i % 3) * 80}ms` } as React.CSSProperties}
                  >
                    <Link href={`/work/${p.slug}`} className={s.tile} style={{ "--tone": tone.bg, "--tone-fg": tone.fg } as React.CSSProperties}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={projectCoverThumb(p.slug, col >= 4 ? 1400 : 900)} alt={`${p.title} — ${servicesLine(p.category) || "project"}`} loading={i < 3 ? "eager" : "lazy"} />
                      <span className={s.info}>
                        <span className={s.tileName}>{p.title}</span>
                        {servicesLine(p.category) && <span className={s.tileServices}>{servicesLine(p.category)}</span>}
                      </span>
                      <span className={s.overlay} aria-hidden>
                        <span className={s.overlayName}>{p.title}</span>
                        {p.tagline && <span className={s.overlayText}>{p.tagline}</span>}
                        <span className={s.overlayCue}>View project →</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── CASE STUDY TEASER ── */}
        {caseStudy && (
          <section className={s.case} data-reveal>
            <Link href={`/work/${caseStudy.slug}`} className={s.caseMedia} aria-label={`${caseStudy.title} case study`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={projectCoverThumb(caseStudy.slug, 1400)} alt="" loading="lazy" />
              <span className={s.caseStar} aria-hidden>✦</span>
            </Link>
            <div className={s.caseBody}>
              <h2 className={s.caseTitle}>{caseStudy.title}</h2>
              {servicesLine(caseStudy.category) && <p className={s.caseServices}>{servicesLine(caseStudy.category)}</p>}
              <ol className={s.steps}>
                <li><h3>The problem</h3><p>{caseStudy.problem}</p></li>
                <li><h3>What we made</h3><p>{caseStudy.solution}</p></li>
                <li><h3>The result</h3><p>{caseStudy.results}</p></li>
              </ol>
              <Link href={`/work/${caseStudy.slug}`} className={s.caseBtn}>Read the case study →</Link>
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <section className={s.cta}>
          <h2 className={s.ctaH} data-reveal>
            Want your brand <span className={s.ctaChip}>in here?</span>
          </h2>
          <p className={s.ctaP} data-reveal>Tell us your story — we&apos;ll show you what it looks like in full color.</p>
          <Link href="/contact" className={s.ctaBtn}>Start a project →</Link>
          <a href="mailto:hello@thrivecreativestudios.org" className={s.ctaMail}>or email hello@thrivecreativestudios.org</a>
        </section>
      </div>
    </PublicLayout>
  );
}
