'use client';

// The live security dashboard at the top of /admin/security. The checks run
// on the server each time the page loads (src/lib/securityReport.ts).

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import type { CheckStatus, SecurityReport } from '@/lib/securityReport';

const TONE: Record<CheckStatus, { bg: string; fg: string; label: string }> = {
  pass: { bg: '#e8f8ef', fg: '#1a7a45', label: 'OK' },
  warn: { bg: '#fff4e5', fg: '#a65b00', label: 'Check' },
  fail: { bg: '#fde8f1', fg: '#b0045f', label: 'Fix' },
};

function Pill({ status }: { status: CheckStatus }) {
  const t = TONE[status];
  return (
    <span style={{ display: 'inline-block', minWidth: 44, textAlign: 'center', padding: '3px 8px', borderRadius: 999, background: t.bg, color: t.fg, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
      {t.label}
    </span>
  );
}

const h2 = { margin: '0 0 4px', fontSize: 16 } as const;
const sub = { margin: '0 0 14px', fontSize: 13, color: '#777', lineHeight: 1.5 } as const;
const cell = { padding: '8px 10px', borderTop: '1px solid #eee', fontSize: 13, verticalAlign: 'top' } as const;

export default function SecurityDashboard({ version }: { version: number }) {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiGet<SecurityReport>('/api/security')
      .then((r) => { if (!cancelled) { setReport(r); setError(''); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not run the checks'); })
      .finally(() => { if (!cancelled) setRunning(false); });
    return () => { cancelled = true; };
  }, [version, tick]);

  const run = useCallback(() => { setRunning(true); setTick((n) => n + 1); }, []);

  async function toggle(id: string, confirmed: boolean) {
    try {
      await apiSend('/api/security', 'POST', { id, confirmed });
      run();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  if (!report) {
    return <p className={p.empty}>{error || 'Running security checks…'}</p>;
  }

  const { score } = report;
  const checklistDone = report.checklist.filter((c) => !c.stale).length;
  const overall: CheckStatus = score.fail ? 'fail' : score.warn || checklistDone < report.checklist.length ? 'warn' : 'pass';
  const headline = {
    pass: 'Everything checks out.',
    warn: 'Mostly protected — a few things to look at.',
    fail: 'Action needed — something is exposed or not set up.',
  }[overall];
  const groups = [...new Set(report.checks.map((c) => c.group))];
  // Problems first within each group.
  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
      {error && <p style={{ color: '#c40473', fontSize: 14, margin: 0 }}>{error}</p>}

      {/* Summary */}
      <section className={p.card} style={{ borderLeft: `6px solid ${TONE[overall].fg}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ ...h2, fontSize: 20 }}>{headline}</h2>
            <p style={{ ...sub, margin: 0 }}>
              {score.pass} passing · {score.warn} to check · {score.fail} to fix · checklist {checklistDone}/{report.checklist.length} confirmed
              <br />Checked {new Date(report.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <button type="button" className={p.btn} onClick={run} disabled={running}>{running ? 'Checking…' : 'Run checks again'}</button>
        </div>
      </section>

      {/* Automatic checks */}
      <section className={p.card}>
        <h2 style={h2}>Automatic checks</h2>
        <p style={sub}>Run live against the database, storage and website. The “public” checks use the same key every visitor’s browser has, so they show exactly what an outsider could reach.</p>
        {groups.map((g) => (
          <div key={g} style={{ marginTop: 14 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>{g}</h3>
            {report.checks.filter((c) => c.group === g).sort((a, b) => order[a.status] - order[b.status]).map((c) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, padding: '10px 0', borderTop: '1px solid #eee' }}>
                <div><Pill status={c.status} /></div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 2, lineHeight: 1.5 }}>{c.detail}</div>
                  {c.fix && <div style={{ fontSize: 13, color: TONE[c.status].fg, marginTop: 4, lineHeight: 1.5 }}><b>How to fix:</b> {c.fix}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Manual checklist */}
      <section className={p.card}>
        <h2 style={h2}>Your checklist</h2>
        <p style={sub}>Things the site can’t check for you. Tick each one when it’s true; it asks again after 90 days.</p>
        {report.checklist.map((c) => (
          <label key={c.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'start', padding: '10px 0', borderTop: '1px solid #eee', cursor: 'pointer' }}>
            <input type="checkbox" checked={!c.stale} onChange={(e) => toggle(c.id, e.target.checked)} style={{ width: 18, height: 18, marginTop: 1 }} />
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{c.title}</span>
              <span style={{ fontSize: 13, color: '#666' }}>{c.detail}</span>
            </span>
            <span style={{ fontSize: 12, color: c.stale ? '#a65b00' : '#888', whiteSpace: 'nowrap' }}>
              {c.confirmedAt ? (c.stale ? `Due again (confirmed ${formatDate(c.confirmedAt)})` : `Confirmed ${formatDate(c.confirmedAt)}`) : 'Not confirmed'}
            </span>
          </label>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Activity */}
        <section className={p.card}>
          <h2 style={h2}>Recent activity</h2>
          <p style={sub}>From the rate limiter. A spike in wrong passcodes or sign-in codes means someone is trying to get in.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...cell, borderTop: 0, textAlign: 'left', color: '#888' }}></th><th style={{ ...cell, borderTop: 0, textAlign: 'right', color: '#888' }}>24 h</th><th style={{ ...cell, borderTop: 0, textAlign: 'right', color: '#888' }}>7 days</th></tr></thead>
            <tbody>
              {report.activity.map((a) => (
                <tr key={a.label}>
                  <td style={cell}>{a.label}</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{a.last24h}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{a.last7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Admins */}
        <section className={p.card}>
          <h2 style={h2}>Admin accounts</h2>
          <p style={sub}>Everyone who can open admin. There should only be people you know here.</p>
          {report.admins.length === 0 && <p style={{ fontSize: 13, color: '#888', margin: 0 }}>None yet — admin still uses the shared passcode.</p>}
          {report.admins.map((a) => (
            <div key={a.email} style={{ padding: '8px 0', borderTop: '1px solid #eee', fontSize: 13 }}>
              <b>{a.email}</b>
              <div style={{ color: '#666' }}>
                {a.authenticator ? 'Authenticator paired' : 'Authenticator not paired'} · {a.lastSignIn ? `last sign-in ${formatDate(a.lastSignIn)}` : 'never signed in'}
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Data inventory */}
      <section className={p.card}>
        <h2 style={h2}>Personal data you hold</h2>
        <p style={sub}>What’s stored, so you know what you’re responsible for. Card numbers are never stored here — Stripe holds them.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {report.inventory.map((i) => (
              <tr key={i.label}>
                <td style={{ ...cell, fontWeight: 600, width: '34%' }}>{i.label}</td>
                <td style={{ ...cell, color: '#666' }}>{i.note}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{i.count ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Vault access log */}
      <section className={p.card}>
        <h2 style={h2}>Vault passwords opened (last 30 days)</h2>
        <p style={sub}>Each time a saved client login is revealed in admin. Anything you don’t recognise is a reason to change that password and your own.</p>
        {report.vaultViews.length === 0 ? (
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>None in the last 30 days.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {report.vaultViews.map((v, i) => (
                <tr key={i}>
                  <td style={{ ...cell, fontWeight: 600 }}>{v.label}</td>
                  <td style={cell}>{v.client}</td>
                  <td style={{ ...cell, color: '#666' }}>{v.viewedBy ?? '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', color: '#666', whiteSpace: 'nowrap' }}>{formatDate(v.viewedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* If something goes wrong */}
      <section className={p.card}>
        <h2 style={h2}>If you think something went wrong</h2>
        <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: '#444', lineHeight: 1.7 }}>
          <li>Sign out everywhere: change your admin password, and in Supabase → Authentication → Users remove any admin you don’t recognise.</li>
          <li>Rotate keys in Supabase (API settings) and Vercel, then redeploy. Don’t rotate PORTAL_CREDENTIALS_KEY — saved vault logins would become unreadable; change the client passwords themselves instead.</li>
          <li>Write down what happened and when, and which clients’ data could be affected.</li>
          <li>Tell affected clients promptly. Laws in Texas and other states set deadlines for notifying people whose personal information was exposed — get advice from a lawyer on what applies.</li>
        </ol>
      </section>
    </div>
  );
}
