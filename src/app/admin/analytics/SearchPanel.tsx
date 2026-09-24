'use client';

// Google search: the searches that showed the site, and which were clicked.
// Without Search Console credentials it explains how to connect it.

import { useState } from 'react';
import s from './analytics.module.css';
import type { SearchRow, SearchSection, SearchTotals } from '@/types/searchConsole';

const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;

function day(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Delta({ now, before, lowerIsBetter, points }: { now: number; before: number; lowerIsBetter?: boolean; points?: boolean }) {
  if (!before) return <p className={s.delta}>No earlier data</p>;
  const change = points ? now - before : (now - before) / before;
  const flat = Math.abs(change) < (points ? 0.05 : 0.01);
  const good = flat ? null : (change > 0) !== Boolean(lowerIsBetter);
  const text = points ? `${change > 0 ? '+' : ''}${change.toFixed(1)}` : `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`;
  return (
    <p className={`${s.delta} ${good === true ? s.deltaGood : good === false ? s.deltaBad : ''}`}>
      {flat ? 'No change' : <><span aria-hidden="true">{change > 0 ? '▲' : '▼'}</span> {text}</>} vs previous period
    </p>
  );
}

function Tiles({ totals, previous }: { totals: SearchTotals; previous: SearchTotals }) {
  return (
    <div className={s.tiles}>
      <div className={s.tile}>
        <p className={s.tileLabel}>Clicks from Google</p>
        <p className={s.tileValue}>{totals.clicks.toLocaleString()}</p>
        <Delta now={totals.clicks} before={previous.clicks} />
      </div>
      <div className={s.tile}>
        <p className={s.tileLabel}>Times shown in results</p>
        <p className={s.tileValue}>{totals.impressions.toLocaleString()}</p>
        <Delta now={totals.impressions} before={previous.impressions} />
      </div>
      <div className={s.tile}>
        <p className={s.tileLabel}>Click rate</p>
        <p className={s.tileValue}>{pct(totals.ctr)}</p>
        <Delta now={totals.ctr} before={previous.ctr} />
      </div>
      <div className={s.tile}>
        <p className={s.tileLabel}>Average position</p>
        <p className={s.tileValue}>{totals.position ? totals.position.toFixed(1) : '—'}</p>
        <Delta now={totals.position} before={previous.position} lowerIsBetter points />
      </div>
    </div>
  );
}

function RowsTable({ rows, label, limit }: { rows: SearchRow[]; label: string; limit: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r.impressions));
  if (rows.length === 0) return <p className={s.muted}>No data for this period.</p>;
  return (
    <>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{label}</th>
              <th className={s.num}>Clicks</th>
              <th className={s.num}>Shown</th>
              <th className={s.num}>Click rate</th>
              <th className={s.num}>Position</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key}>
                <td className={s.barCell}>
                  <span className={s.bar} style={{ width: `${(r.impressions / max) * 100}%` }} />
                  <span className={s.barLabel}>{r.key}</span>
                </td>
                <td className={s.num}>{r.clicks}</td>
                <td className={s.num}>{r.impressions.toLocaleString()}</td>
                <td className={s.num}>{pct(r.ctr)}</td>
                <td className={s.num}>{r.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button type="button" className={s.linkButton} style={{ marginTop: 8 }} onClick={() => setAll((v) => !v)}>
          {all ? `Show top ${limit}` : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}

export function SearchPanel({ search }: { search: SearchSection }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <h2 className={s.panelTitle}>Google search</h2>
          <p className={s.panelSub}>
            {search.status === 'ok'
              ? `What people searched when your site showed up, ${day(search.from)} – ${day(search.to)}. Google reports about two days behind.`
              : 'What people search on Google before they find you.'}
          </p>
        </div>
      </div>

      {search.status === 'not_configured' && (
        <div className={s.evidence}>
          <p style={{ margin: '0 0 8px' }}>Connect Google Search Console to see this. About ten minutes, once:</p>
          <ol className={s.actions}>
            <li>In <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Search Console</a>, add thrivecreativestudios.org as a property if it is not there yet (the Domain option), and submit <code>/sitemap.xml</code> under Sitemaps.</li>
            <li>In <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud</a>, create a project, enable the <strong>Google Search Console API</strong>, then create a <strong>service account</strong> and download a JSON key for it.</li>
            <li>Back in Search Console, open Settings → Users and permissions, and add the service account&apos;s email (it ends in <code>iam.gserviceaccount.com</code>) as a user with Restricted access.</li>
            <li>In Vercel, add two environment variables: <code>GSC_SERVICE_ACCOUNT_JSON</code> with the whole JSON key, and <code>GSC_SITE_URL</code> as <code>sc-domain:thrivecreativestudios.org</code> (or the exact URL if you added a URL-prefix property). Then redeploy.</li>
          </ol>
        </div>
      )}

      {search.status === 'error' && (
        <p className={s.evidence} style={{ color: '#b91c1c' }}>Search Console could not be read: {search.message}</p>
      )}

      {search.status === 'ok' && (
        <>
          <Tiles totals={search.totals} previous={search.previous} />
          <h3 className={s.panelTitle} style={{ fontSize: 14, margin: '4px 0 8px' }}>Searches</h3>
          <RowsTable rows={search.queries} label="Search" limit={15} />
          <h3 className={s.panelTitle} style={{ fontSize: 14, margin: '18px 0 8px' }}>Pages</h3>
          <RowsTable rows={search.pages} label="Page" limit={10} />
        </>
      )}
    </section>
  );
}
