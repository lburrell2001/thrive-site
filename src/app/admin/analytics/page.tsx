'use client';

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './analytics.module.css';
import { apiGet, formatMoneyCents } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { isBrowserExcluded, markThisBrowserAsAdmin } from '../../components/SiteTracker';
import { CHANNEL_LABEL } from '@/lib/trafficSource';
import type { AnalyticsReport, BreakdownRow, Insight } from '@/types/analytics';
import { DailyTable, VisitsChart } from './VisitsChart';
import { LinkBuilder } from './LinkBuilder';
import { SearchPanel } from './SearchPanel';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

const TONE: Record<Insight['tone'], { label: string; icon: string; chip: string; card: string }> = {
  opportunity: { label: 'Opportunity', icon: '↗', chip: s.toneOpportunity, card: s.insightOpportunity },
  warning: { label: 'Needs attention', icon: '!', chip: s.toneWarning, card: s.insightWarning },
  win: { label: 'Working', icon: '✓', chip: s.toneWin, card: s.insightWin },
  info: { label: 'Note', icon: 'i', chip: s.toneInfo, card: s.insightInfo },
};

const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;

function duration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

function compact(n: number) {
  return n >= 10_000 ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n) : n.toLocaleString();
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  // The report remembers which range it is for, so a range change shows the
  // old numbers dimmed until the new ones arrive.
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const [allPages, setAllPages] = useState(false);
  // Admin renders only in the browser (the layout gates on sessionStorage),
  // so reading localStorage here is safe.
  const [excluded, setExcluded] = useState(() => isBrowserExcluded());
  const { toast, show } = useToast();

  useEffect(() => {
    let cancelled = false;
    apiGet<AnalyticsReport>(`/api/analytics?days=${days}`)
      .then((data) => { if (!cancelled) { setReport(data); setFailed(false); } })
      .catch((error) => {
        if (cancelled) return;
        setFailed(true);
        show(error instanceof Error ? error.message : 'Could not load analytics', 'error');
      });
    return () => { cancelled = true; };
  }, [days, show]);

  const r = report;
  const loading = !failed && r?.days !== days;
  const pages = r ? (allPages ? r.pages : r.pages.slice(0, 10)) : [];
  const maxSourceVisits = Math.max(1, ...(r?.sources.map((x) => x.visits) ?? [1]));
  const maxPageViews = Math.max(1, ...(r?.pages.map((x) => x.views) ?? [1]));

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>Analytics</h1>
            <p className={p.pageSub}>
              Visits to the public site, where they came from, and which ones turned into inquiries and clients.
              {' '}
              {excluded ? 'Your visits from this browser are not counted.' : 'This browser’s visits are being counted.'}
              {' '}
              <button
                type="button"
                className={s.linkButton}
                onClick={() => { markThisBrowserAsAdmin(!excluded); setExcluded(!excluded); }}
              >
                {excluded ? 'Count them' : 'Stop counting them'}
              </button>
            </p>
          </div>
          <div className={p.filters} style={{ marginBottom: 0 }} role="group" aria-label="Date range">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                aria-pressed={days === range.days}
                className={`${p.filterChip} ${days === range.days ? p.filterChipOn : ''}`}
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {!r ? (
          <p className={p.empty}>{loading ? 'Loading…' : 'No report.'}</p>
        ) : (
          <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
            <div className={s.tiles}>
              <Tile label="Visits" value={compact(r.totals.visits)} now={r.totals.visits} before={r.previous.visits} report={r} />
              <Tile label="Daily visitors (sum)" value={compact(r.totals.visitors)} now={r.totals.visitors} before={r.previous.visitors} report={r} />
              <Tile label="Inquiries" value={String(r.totals.inquiries)} now={r.totals.inquiries} before={r.previous.inquiries} report={r} />
              <Tile label="Visits → inquiry" value={pct(r.totals.conversionRate)} now={r.totals.conversionRate} before={r.previous.conversionRate} report={r} rate />
              <Tile label="Bounce rate" value={pct(r.totals.bounceRate)} now={r.totals.bounceRate} before={r.previous.bounceRate} report={r} rate downIsGood />
              <Tile label="Time per visit" value={duration(r.totals.avgEngagedSec)} now={r.totals.avgEngagedSec} before={r.previous.avgEngagedSec} report={r} />
            </div>

            <section className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <h2 className={s.panelTitle}>Visits per day</h2>
                  <p className={s.panelSub}>
                    {r.trackingSince
                      ? `Counting since ${new Date(r.trackingSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Days are Dallas time.`
                      : 'No visits recorded yet — tracking started with this update.'}
                  </p>
                </div>
                <button type="button" className={s.linkButton} onClick={() => setAsTable((v) => !v)}>
                  {asTable ? 'Show chart' : 'Show as table'}
                </button>
              </div>
              {asTable ? <DailyTable daily={r.daily} /> : <VisitsChart daily={r.daily} />}
            </section>

            <section className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <h2 className={s.panelTitle}>How to grow traffic</h2>
                  <p className={s.panelSub}>Worked out from this period’s numbers, most important first.</p>
                </div>
              </div>
              <div className={s.insights}>
                {r.insights.length === 0 && <p className={s.muted}>Nothing stands out — the site is in good shape for this period.</p>}
                {r.insights.map((insight) => {
                  const tone = TONE[insight.tone];
                  return (
                    <article key={insight.id} className={`${s.insight} ${tone.card}`}>
                      <div className={s.insightHead}>
                        <span className={`${s.tone} ${tone.chip}`}><span aria-hidden="true">{tone.icon}</span>{tone.label}</span>
                        <h3 className={s.insightTitle}>{insight.title}</h3>
                      </div>
                      <p className={s.evidence}>{insight.evidence}</p>
                      {insight.actions.length > 0 && (
                        <ul className={s.actions}>
                          {insight.actions.map((a) => <li key={a}>{a}</li>)}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <h2 className={s.panelTitle}>Where visitors come from</h2>
                  <p className={s.panelSub}>Inquiries and won work are matched through the CRM.</p>
                </div>
              </div>
              <div className={s.channelChips}>
                {r.channels.map((c) => (
                  <span key={c.channel} className={s.channelChip}>
                    {CHANNEL_LABEL[c.channel]} <strong>{pct(c.visits / Math.max(1, r.totals.visits))}</strong>
                  </span>
                ))}
              </div>
              {r.sources.length === 0 ? <p className={s.muted}>No visits yet.</p> : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Type</th>
                        <th className={s.num}>Visits</th>
                        <th className={s.num}>Bounce</th>
                        <th className={s.num}>Inquiries</th>
                        <th className={s.num}>Won</th>
                        <th className={s.num}>Won value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.sources.map((row) => (
                        <tr key={`${row.channel}|${row.source}`}>
                          <td className={s.barCell}>
                            <span className={s.bar} style={{ width: `${(row.visits / maxSourceVisits) * 100}%` }} />
                            <span className={s.barLabel}>{row.source}</span>
                          </td>
                          <td className={s.muted}>{CHANNEL_LABEL[row.channel]}</td>
                          <td className={s.num}>{row.visits}</td>
                          <td className={s.num}>{row.visits ? pct(row.bounceRate) : '—'}</td>
                          <td className={s.num}>{row.inquiries}</td>
                          <td className={s.num}>{row.won || '—'}</td>
                          <td className={s.num}>{row.wonValueCents ? formatMoneyCents(row.wonValueCents) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <SearchPanel search={r.search} />

            <section className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <h2 className={s.panelTitle}>Pages</h2>
                  <p className={s.panelSub}>Bounce is for visits that started on the page. Inquiries counts visits that saw the page and then wrote in.</p>
                </div>
                {r.pages.length > 10 && (
                  <button type="button" className={s.linkButton} onClick={() => setAllPages((v) => !v)}>
                    {allPages ? 'Show top 10' : `Show all ${r.pages.length}`}
                  </button>
                )}
              </div>
              {pages.length === 0 ? <p className={s.muted}>No page views yet.</p> : (
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th className={s.num}>Views</th>
                        <th className={s.num}>Entrances</th>
                        <th className={s.num}>Bounce</th>
                        <th className={s.num}>Avg time</th>
                        <th className={s.num}>Inquiries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.map((row) => (
                        <tr key={row.path}>
                          <td className={s.barCell}>
                            <span className={s.bar} style={{ width: `${(row.views / maxPageViews) * 100}%` }} />
                            <a className={s.barLabel} href={row.path} target="_blank" rel="noreferrer" style={{ color: '#111' }}>{row.path}</a>
                          </td>
                          <td className={s.num}>{row.views}</td>
                          <td className={s.num}>{row.landings}</td>
                          <td className={s.num}>{row.bounceRate == null ? '—' : pct(row.bounceRate)}</td>
                          <td className={s.num}>{row.avgEngagedSec ? duration(row.avgEngagedSec) : '—'}</td>
                          <td className={s.num}>{row.inquiries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {r.unseenPages.length > 0 && r.totals.visits > 0 && (
                <p className={s.panelSub} style={{ marginTop: 10 }}>
                  No visits this period: {r.unseenPages.join(', ')}
                </p>
              )}
            </section>

            {r.campaigns.length > 0 && (
              <section className={s.panel}>
                <div className={s.panelHead}><h2 className={s.panelTitle}>Tagged links</h2></div>
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr><th>Campaign</th><th>Source</th><th className={s.num}>Visits</th><th className={s.num}>Inquiries</th></tr>
                    </thead>
                    <tbody>
                      {r.campaigns.map((c) => (
                        <tr key={`${c.campaign}|${c.source}`}>
                          <td>{c.campaign}</td>
                          <td className={s.muted}>{c.source}</td>
                          <td className={s.num}>{c.visits}</td>
                          <td className={s.num}>{c.inquiries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className={s.twoCol} style={{ marginBottom: 16 }}>
              <Breakdown title="Devices" rows={r.devices} capitalize />
              <Breakdown title="Locations" rows={r.locations} />
            </div>

            <section className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <h2 className={s.panelTitle}>Link builder</h2>
                  <p className={s.panelSub}>
                    Use these links wherever you share the site, so each bio link, story, post and email shows up by name instead of as “Direct”.
                  </p>
                </div>
              </div>
              <LinkBuilder pages={r.pages.map((x) => x.path).concat(r.unseenPages)} />
            </section>
          </div>
        )}
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function Tile({ label, value, now, before, report, rate, downIsGood }: {
  label: string;
  value: string;
  now: number;
  before: number;
  report: AnalyticsReport;
  /** A 0–1 rate: compared in percentage points, and 0 before is a real value. */
  rate?: boolean;
  downIsGood?: boolean;
}) {
  const days = report.days;
  let delta: React.ReactNode = <p className={s.delta}>No earlier data</p>;
  if (report.previous.visits > 0 && (rate || before > 0)) {
    const change = rate ? now - before : (now - before) / before;
    const flat = Math.abs(change) < (rate ? 0.005 : 0.01);
    const good = flat ? null : (change > 0) !== Boolean(downIsGood);
    const text = rate
      ? `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)} pts`
      : `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`;
    delta = (
      <p className={`${s.delta} ${good === true ? s.deltaGood : good === false ? s.deltaBad : ''}`}>
        {flat ? 'No change' : <><span aria-hidden="true">{change > 0 ? '▲' : '▼'}</span> {text}</>} vs previous {days} days
      </p>
    );
  }
  return (
    <div className={s.tile}>
      <p className={s.tileLabel}>{label}</p>
      <p className={s.tileValue}>{value}</p>
      {delta}
    </div>
  );
}

function Breakdown({ title, rows, capitalize }: { title: string; rows: BreakdownRow[]; capitalize?: boolean }) {
  const total = rows.reduce((sum, r) => sum + r.visits, 0) || 1;
  return (
    <section className={s.panel}>
      <div className={s.panelHead}><h2 className={s.panelTitle}>{title}</h2></div>
      {rows.length === 0 ? <p className={s.muted}>No data yet.</p> : (
        <table className={s.table}>
          <thead><tr><th>{title.replace(/s$/, '')}</th><th className={s.num}>Visits</th><th className={s.num}>Bounce</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className={s.barCell}>
                  <span className={s.bar} style={{ width: `${(row.visits / total) * 100}%` }} />
                  <span className={s.barLabel} style={capitalize ? { textTransform: 'capitalize' } : undefined}>{row.label}</span>
                </td>
                <td className={s.num}>{row.visits}</td>
                <td className={s.num}>{pct(row.bounceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
