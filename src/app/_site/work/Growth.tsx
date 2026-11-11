'use client';

// The Growth section of a social media case study: each account's numbers
// (start → end with the change), a line chart per measure over time, and the
// analytics screenshots in phone frames. Data comes from the case study
// (admin → Portfolio → Growth); nothing here is computed beyond the change.

import { useEffect, useId, useRef, useState } from 'react';
import type { CaseGrowth, GrowthSeries, GrowthStat } from '../../work/caseStudies';
import s from '../redesign.module.css';
import p from './project.module.css';

const TONES = [s.bMagenta, s.bOrange, s.bBlue, s.bMint, s.bPurple];

export function fmt(n: number, unit?: string) {
  const abs = Math.abs(n);
  const body = abs >= 100_000 ? `${(n / 1000).toFixed(0)}K`
    : abs >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
    : Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (!unit) return body;
  return unit === '$' ? `$${body}` : unit === '%' ? `${body}%` : `${body} ${unit}`;
}

function change(st: GrowthStat) {
  const d = st.end - st.start;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  const amount = st.unit === '%' ? `${sign}${fmt(Math.abs(d))} pts` : `${sign}${fmt(Math.abs(d), st.unit)}`;
  const pct = st.start > 0 && st.unit !== '%' ? `${sign}${Math.round(Math.abs(d / st.start) * 100).toLocaleString('en-US')}%` : null;
  return { amount, pct };
}

function Stat({ st, i }: { st: GrowthStat; i: number }) {
  const c = change(st);
  return (
    <div className={`${p.number} ${TONES[i % TONES.length]} ${s.rise}`}>
      <span className={p.growthPct}>{c.pct ?? c.amount}</span>
      <span className={p.growthLabel}>{st.label}</span>
      <span className={p.growthFrom}>{fmt(st.start, st.unit)} → {fmt(st.end, st.unit)}{c.pct ? ` (${c.amount})` : ''}</span>
    </div>
  );
}

const H = 260, L = 44, R = 18, T = 18, B = 34;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

export function LineChart({ series }: { series: GrowthSeries }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the box's real width so the axis text stays readable on phones.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pts = series.points;
  const vals = pts.map((x) => x.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  // Start at zero unless that would flatten the line into the top of the chart.
  const yMin = lo > 0 && lo > hi * 0.5 ? Math.floor(lo * 0.8) : Math.min(0, lo);
  const yMax = niceMax(hi === yMin ? hi + 1 : hi);
  const x = (i: number) => L + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const path = pts.map((pt, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pt.value).toFixed(1)}`).join(' ');
  const ticks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  const step = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((W - L - R) / 70))));
  const last = pts.length - 1;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * last);
    setHover(Math.max(0, Math.min(last, i)));
  }

  const h = hover ?? null;
  return (
    <figure className={p.chart}>
      <figcaption className={p.chartTitle} id={`${id}-t`}>{series.label}</figcaption>
      <div className={p.chartBox} ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={p.chartGrid} />
              <text x={L - 8} y={y(t)} className={p.chartAxis} textAnchor="end" dominantBaseline="middle">{fmt(Math.round(t), series.unit === '%' ? '%' : undefined)}</text>
            </g>
          ))}
          {pts.map((pt, i) => (i % step === 0 || i === last) && (i === last || last - i >= step / 2) ? (
            <text key={pt.when + i} x={x(i)} y={H - 10} className={p.chartAxis} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>{pt.when}</text>
          ) : null)}
          <path d={path} className={p.chartLine} />
          <circle cx={x(last)} cy={y(pts[last].value)} r={5} className={p.chartDot} />
          {h !== null && (
            <g>
              <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} className={p.chartCross} />
              <circle cx={x(h)} cy={y(pts[h].value)} r={6} className={p.chartDot} />
            </g>
          )}
        </svg>
        {h !== null && (
          <div className={p.chartTip} style={{ left: `${(x(h) / W) * 100}%`, top: `${(y(pts[h].value) / H) * 100}%` }}>
            <strong>{fmt(pts[h].value, series.unit)}</strong>
            <span>{pts[h].when}</span>
          </div>
        )}
      </div>
      <details className={p.chartTable}>
        <summary>See the numbers</summary>
        <table>
          <tbody>{pts.map((pt, i) => <tr key={pt.when + i}><th scope="row">{pt.when}</th><td>{fmt(pt.value, series.unit)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

export default function Growth({ growth, Phone }: {
  growth: CaseGrowth;
  Phone: (props: { img: { src: string; alt: string } }) => React.ReactNode;
}) {
  return (
    <section id="growth" className={p.section}>
      <h2 className={`${s.display} ${p.sectionTitle} ${s.rise}`}>The growth</h2>
      {growth.intro && <p className={`${s.leadText} ${p.intro}`}>{growth.intro}</p>}
      {growth.accounts.map((a) => (
        <div key={a.platform + (a.handle ?? '')} className={p.account}>
          <div className={p.accountHead}>
            <h3 className={p.smallTitle}>{a.platform}{a.handle ? <span className={p.accountHandle}> @{a.handle}</span> : null}</h3>
            {a.period && <span className={p.accountPeriod}>{a.period}</span>}
          </div>
          {a.stats.length ? <div className={p.growthStats}>{a.stats.map((st, i) => <Stat key={st.label} st={st} i={i} />)}</div> : null}
          {a.series?.length ? <div className={p.charts}>{a.series.map((se) => <LineChart key={se.label} series={se} />)}</div> : null}
        </div>
      ))}
      {growth.screenshots?.length ? (
        <div className={p.growthShots}>
          {growth.screenshotsText && <p className={`${p.bodyText} ${p.intro}`}>{growth.screenshotsText}</p>}
          <div className={p.phones}>
            {growth.screenshots.map((img) => (
              <figure key={img.src} className={p.phoneFig}>
                <Phone img={img} />
                {img.caption && <figcaption>{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
