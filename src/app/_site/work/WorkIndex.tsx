'use client';

// The redesigned portfolio: a giant heading with the project count, filter
// pills in each service's colour, a bento grid of every project (one cover
// per project, real work only), one case study, and the closing band.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { projectCoverThumb } from '@/lib/storage';
import CtaBand from '../CtaBand';
import { rd } from '../links';
import { useReveal } from '../useReveal';
import s from '../redesign.module.css';
import w from './work.module.css';

export type WorkProject = { id: string; title: string; slug: string; category: string | null; tagline: string | null };
export type WorkCaseStudy = { title: string; slug: string; category: string | null; problem: string; solution: string; results: string };

// Filter tags as stored in projects.category. "Digital Design" there means
// graphics work, not the web service — the label stays as it is.
const FILTERS = [
  { label: 'All', tone: s.bBlack },
  { label: 'Brand Design', tone: s.bBlue },
  { label: 'Digital Design', tone: s.bMagenta },
  { label: 'UX Design', tone: s.bOrange },
  { label: 'Social Media', tone: s.bMint },
  { label: 'Photography', tone: s.bPurple },
];
// Hover colour per tile, round the brand palette.
const TONES = [s.bMagenta, s.bOrange, s.bBlue, s.bMint, s.bPurple];

const parts = (category: string | null) => (category ?? '').split(',').map((x) => x.trim()).filter(Boolean);
/** The first part of the category reads as what was made: "Website · Nonprofit". */
const kind = (category: string | null) => parts(category)[0] ?? '';
const matches = (category: string | null, filter: string) => filter === 'All' || parts(category).includes(filter);

// The mosaic: 6 columns, rows of equal height, filled in blocks that are
// each exactly 6 × 2, so the grid packs edge to edge with no holes:
//   A: one big tile beside two stacked     (3 tiles; mirrored when it follows another A)
//   B: big, two stacked, big               (4 tiles)
//   C: two stacked, big, two stacked       (5 tiles)
// Within a block the order is the one CSS auto-placement needs to stack the
// small tiles. A last, short block uses the pattern that fits its count.
type Span = { c: number; r: number };
const BIG2: Span = { c: 2, r: 2 };
const SMALL2: Span = { c: 2, r: 1 };
const BLOCKS: Record<number, Span[]> = {
  1: [{ c: 6, r: 2 }],
  2: [{ c: 3, r: 2 }, { c: 3, r: 2 }],
  3: [{ c: 3, r: 2 }, { c: 3, r: 1 }, { c: 3, r: 1 }],
  4: [BIG2, SMALL2, BIG2, SMALL2],
  5: [SMALL2, BIG2, SMALL2, SMALL2, SMALL2],
};
/** Block A mirrored: the big tile on the right. */
const A_FLIPPED: Span[] = [{ c: 3, r: 1 }, { c: 3, r: 2 }, { c: 3, r: 1 }];
function mosaic(n: number): Span[] {
  const out: Span[] = [];
  for (let b = 0; out.length < n; b++) {
    const left = n - out.length;
    // Five or fewer left: one block that ends the grid exactly. Six: two blocks
    // of three (never a lone full-width tile). Otherwise the next block in turn.
    const size = left <= 5 ? left : left === 6 ? 3 : [3, 4, 5][b % 3];
    // Two A blocks in a row would repeat; every other one has its big tile on the right.
    const prev = out.length >= 3 ? out.slice(-3) : [];
    const lastWasA = prev.length === 3 && prev[0].c === 3 && prev[0].r === 2;
    out.push(...(size === 3 && lastWasA ? A_FLIPPED : BLOCKS[size]));
  }
  return out;
}

export default function WorkIndex({ projects, caseStudy }: { projects: WorkProject[]; caseStudy: WorkCaseStudy | null }) {
  const [filter, setFilter] = useState('All');
  const shown = useMemo(() => projects.filter((p) => matches(p.category, filter)), [projects, filter]);
  const tiles = mosaic(shown.length);
  const root = useReveal<HTMLDivElement>([filter]);

  return (
    <div ref={root}>
      <section className={w.hero}>
        <h1 className={`${s.display} ${w.title}`}>
          Our Work<sup className={w.count}>{projects.length}</sup>
        </h1>
        <p className={`${s.leadText} ${w.lede}`}>Brands, websites, apps and content we’ve made, every one built to stand out, never to fit in.</p>
        <div className={w.filters} role="group" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <button key={f.label} type="button" aria-pressed={filter === f.label}
              className={`${s.pill} ${w.filter} ${filter === f.label ? f.tone : w.filterOff}`} onClick={() => setFilter(f.label)}>
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className={w.gridWrap} aria-label="Projects">
        {shown.length === 0 ? <p className={w.empty}>Nothing here yet.</p> : (
          <ul className={w.grid}>
            {shown.map((p, i) => (
              <li key={p.id} className={`${w.cell} ${s.rise}`} style={{ '--c': tiles[i].c, '--r': tiles[i].r, '--d': `${(i % 4) * 60}ms` } as React.CSSProperties}>
                <Link href={rd(`/work/${p.slug}`)} className={w.tile} aria-label={`${p.title}${kind(p.category) ? `, ${kind(p.category)}` : ''}`}>
                  <img src={projectCoverThumb(p.slug, tiles[i].c >= 3 ? 1400 : 800)} alt="" loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />
                  <span className={w.label}>{p.title}</span>
                  <span className={`${w.hover} ${TONES[i % TONES.length]}`} aria-hidden>
                    <span className={w.hoverName}>{p.title}</span>
                    {kind(p.category) && <span className={w.hoverKind}>{kind(p.category)}</span>}
                    {p.tagline && <span className={w.hoverText}>{p.tagline}</span>}
                    <span className={w.hoverCue}>View project →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {caseStudy && (
        <section className={w.study}>
          <div className={w.studyHead}>
            <h2 className={`${s.display} ${w.studyTitle} ${s.rise}`}>{caseStudy.title}</h2>
            <Link href={rd(`/work/${caseStudy.slug}`)} className={`${s.pill} ${s.pillBig}`}>Read the case study</Link>
          </div>
          <div className={w.studyCols}>
            {[
              { label: 'The problem', text: caseStudy.problem, tone: s.bMagenta },
              { label: 'What we did', text: caseStudy.solution, tone: s.bBlue },
              { label: 'The result', text: caseStudy.results, tone: s.bMint },
            ].map((c, i) => (
              <div key={c.label} className={`${w.studyCard} ${c.tone} ${s.rise}`} style={{ '--d': `${i * 90}ms` } as React.CSSProperties}>
                <h3 className={w.studyLabel}>{c.label}</h3>
                <p className={w.studyText}>{c.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <CtaBand />
    </div>
  );
}
