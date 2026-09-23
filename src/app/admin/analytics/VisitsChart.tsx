'use client';

// Visits per day: one series, columns from a single baseline. Hovering (or
// focusing) a day shows that day's visits, page views and inquiries; the
// hit target is the whole day's band, not just the bar.

import { useEffect, useRef, useState } from 'react';
import s from './analytics.module.css';
import type { DailyPoint } from '@/types/analytics';

const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 36 };
const BAR = '#e40586';
const GRID = '#efedeb';
const AXIS_TEXT = '#8a8a8a';

function niceMax(n: number) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * pow >= n) return step * pow;
  }
  return 10 * pow;
}

function label(date: string, long = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', long
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric' });
}

export function VisitsChart({ daily }: { daily: DailyPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...daily.map((d) => d.visits)));
  const ticks = [0, max / 2, max].map((v) => Math.round(v));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = daily.length ? plotW / daily.length : 0;
  // Cap at 24px, and leave a 2px gap between neighbours.
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  // First, middle and last day: enough to read the range without crowding.
  const labelled = daily.length > 2 ? [0, Math.floor((daily.length - 1) / 2), daily.length - 1] : daily.map((_, i) => i);
  const point = hover != null ? daily[hover] : null;

  return (
    <div ref={wrap} className={s.chart} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`Visits per day, ${daily.length} days`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
                {t.toLocaleString()}
              </text>
            </g>
          ))}

          {daily.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const h = Math.max(0, y(0) - y(d.visits));
            const r = Math.min(4, barW / 2, h);
            const x0 = cx - barW / 2;
            const top = y(0) - h;
            return (
              <g key={d.date}>
                {h > 0 && (
                  // Rounded at the data end, square at the baseline.
                  <path
                    d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`}
                    fill={BAR}
                    opacity={hover == null || hover === i ? 1 : 0.45}
                  />
                )}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${label(d.date, true)}: ${d.visits} visits, ${d.inquiries} inquiries`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}

          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#d8d5d2" strokeWidth={1} />
          {labelled.map((i) => (
            <text
              key={i}
              x={PAD.left + band * i + band / 2}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill={AXIS_TEXT}
            >
              {label(daily[i].date)}
            </text>
          ))}
        </svg>
      )}

      {point && hover != null && (
        <div
          className={s.tooltip}
          style={{
            left: Math.min(Math.max(PAD.left + band * hover + band / 2, 80), width - 80),
            top: Math.max(y(point.visits) - 8, 60),
          }}
        >
          <div style={{ fontWeight: 700 }}>{label(point.date, true)}</div>
          <div><strong>{point.visits}</strong> visit{point.visits === 1 ? '' : 's'} · <strong>{point.pageviews}</strong> page view{point.pageviews === 1 ? '' : 's'}</div>
          {point.inquiries > 0 && <div><strong>{point.inquiries}</strong> inquir{point.inquiries === 1 ? 'y' : 'ies'}</div>}
        </div>
      )}
    </div>
  );
}

export function DailyTable({ daily }: { daily: DailyPoint[] }) {
  return (
    <div className={s.tableWrap} style={{ maxHeight: 260, overflowY: 'auto' }}>
      <table className={s.table}>
        <thead>
          <tr><th>Day</th><th className={s.num}>Visits</th><th className={s.num}>Page views</th><th className={s.num}>Inquiries</th></tr>
        </thead>
        <tbody>
          {daily.toReversed().map((d) => (
            <tr key={d.date}>
              <td>{label(d.date, true)}</td>
              <td className={s.num}>{d.visits}</td>
              <td className={s.num}>{d.pageviews}</td>
              <td className={s.num}>{d.inquiries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
