'use client';

// The Growth section of a social media case study: each account's numbers
// (start → end with the change and a before/after bar), who the activity came
// from (followers vs non-followers, start vs end of the contract), a line chart
// per measure over time, and the analytics screenshots in phone frames. Data
// comes from the case study (admin → Portfolio → Growth); nothing here is
// computed beyond changes and shares.

import { useEffect, useId, useRef, useState } from 'react';
import type { CaseGrowth, GrowthAccount, GrowthSeries, GrowthSplit, GrowthStat } from '../../work/caseStudies';
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

function Stat({ st, i, startLabel, endLabel }: { st: GrowthStat; i: number; startLabel: string; endLabel: string }) {
  const c = change(st);
  const lead = st.lead ?? (c.pct ? 'percent' : 'gain');
  const big = lead === 'end' ? fmt(st.end, st.unit) : lead === 'percent' && c.pct ? c.pct : c.amount;
  const label = lead === 'gain' && st.end > st.start && st.unit !== '%' ? `${st.label} gained` : st.label;
  const second = lead === 'percent' && c.pct ? c.amount : c.pct;
  const max = Math.max(st.start, st.end, 1);
  return (
    <div className={`${p.number} ${TONES[i % TONES.length]} ${s.rise}`}>
      <span className={p.growthPct}>{big}</span>
      <span className={p.growthLabel}>{label}{second ? <span className={p.growthSecond}> {second}</span> : null}</span>
      <div className={p.miniBars} aria-label={`${st.label}: ${fmt(st.start, st.unit)} at the ${startLabel.toLowerCase()}, ${fmt(st.end, st.unit)} at the ${endLabel.toLowerCase()}`} role="img">
        <span className={p.miniRow}><span className={p.miniName}>{startLabel}</span><span className={p.miniTrack}><span className={p.miniStart} style={{ width: `${Math.max(2, (st.start / max) * 100)}%` }} /></span><span className={p.miniVal}>{fmt(st.start, st.unit)}</span></span>
        <span className={p.miniRow}><span className={p.miniName}>{endLabel}</span><span className={p.miniTrack}><span className={p.miniEnd} style={{ width: `${Math.max(2, (st.end / max) * 100)}%` }} /></span><span className={p.miniVal}>{fmt(st.end, st.unit)}</span></span>
      </div>
    </div>
  );
}

const share = (x: { followers: number; nonFollowers: number }) => {
  const t = x.followers + x.nonFollowers;
  return { f: (x.followers / t) * 100, n: (x.nonFollowers / t) * 100 };
};
const pct0 = (v: number) => `${Math.round(v)}%`;

/** Followers vs non-followers, start and end of the contract, as two 100% bars. */
function Split({ sp, startLabel, endLabel }: { sp: GrowthSplit; startLabel: string; endLabel: string }) {
  const a = share(sp.start), b = share(sp.end);
  const counts = sp.unit !== '%';
  const what = sp.label.toLowerCase();
  const rows = [{ name: startLabel, sh: a, raw: sp.start }, { name: endLabel, sh: b, raw: sp.end }];
  const nDiff = Math.round(b.n) - Math.round(a.n);
  const takeaway = nDiff === 0
    ? `Non-followers made up ${pct0(b.n)} of ${what} at both ends.`
    : `Non-followers went from ${pct0(a.n)} to ${pct0(b.n)} of ${what}${counts ? ` (${fmt(sp.start.nonFollowers)} → ${fmt(sp.end.nonFollowers)})` : ''}.`;
  return (
    <figure className={`${p.split2} ${s.rise}`}>
      <figcaption className={p.chartTitle}>{sp.label}: followers vs non-followers</figcaption>
      <div className={p.legend} aria-hidden>
        <span><i className={p.swF} />Followers</span>
        <span><i className={p.swN} />Non-followers</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className={p.splitRow}>
          <span className={p.splitName}>{r.name}</span>
          <div className={p.splitBar} role="img" aria-label={`${r.name}: followers ${pct0(r.sh.f)}, non-followers ${pct0(r.sh.n)}`}>
            {r.sh.f > 0 && (
              <span className={p.segF} style={{ width: `${r.sh.f}%` }} title={`Followers: ${pct0(r.sh.f)}${counts ? ` (${fmt(r.raw.followers)})` : ''}`}>
                {r.sh.f >= 14 ? pct0(r.sh.f) : ''}
              </span>
            )}
            {r.sh.n > 0 && (
              <span className={p.segN} style={{ width: `${r.sh.n}%` }} title={`Non-followers: ${pct0(r.sh.n)}${counts ? ` (${fmt(r.raw.nonFollowers)})` : ''}`}>
                {r.sh.n >= 14 ? pct0(r.sh.n) : ''}
              </span>
            )}
          </div>
        </div>
      ))}
      <p className={p.splitTake}>{takeaway}</p>
      <details className={p.chartTable}>
        <summary>See the numbers</summary>
        <table>
          <thead><tr><th /><th scope="col">Followers</th><th scope="col">Non-followers</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.name}><th scope="row">{r.name}</th>
              <td>{counts ? `${fmt(r.raw.followers)} (${pct0(r.sh.f)})` : pct0(r.sh.f)}</td>
              <td>{counts ? `${fmt(r.raw.nonFollowers)} (${pct0(r.sh.n)})` : pct0(r.sh.n)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
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

function Account({ a }: { a: GrowthAccount }) {
  const startLabel = a.startLabel || 'Start of contract';
  const endLabel = a.endLabel || 'End of contract';
  return (
    <div className={p.account}>
      <div className={p.accountHead}>
        <h3 className={p.smallTitle}>{a.platform}{a.handle ? <span className={p.accountHandle}> @{a.handle}</span> : null}</h3>
        {a.period && <span className={p.accountPeriod}>{a.period}</span>}
      </div>
      {a.stats.length ? (
        <div className={p.growthStats}>{a.stats.map((st, i) => <Stat key={st.label} st={st} i={i} startLabel={startLabel} endLabel={endLabel} />)}</div>
      ) : null}
      {a.splits?.length ? (
        <div className={p.splits}>{a.splits.map((sp) => <Split key={sp.label} sp={sp} startLabel={startLabel} endLabel={endLabel} />)}</div>
      ) : null}
      {a.series?.length ? <div className={p.charts}>{a.series.map((se) => <LineChart key={se.label} series={se} />)}</div> : null}
    </div>
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
      {growth.accounts.map((a) => <Account key={a.platform + (a.handle ?? '')} a={a} />)}
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
