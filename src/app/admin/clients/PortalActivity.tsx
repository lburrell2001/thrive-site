'use client';

// Portal activity (migration 059): when this client was last in their portal,
// how often they sign in and visit, how long they spend, which pages hold
// their attention, and what they did on each recent visit.

import { useEffect, useState } from 'react';
import w from '../crm/workspace.module.css';
import { apiGet } from '../proposals/adminApi';

type Visit = { session_id: string; started_at: string; ended_at: string; ms: number; pages: string[]; actions: string[]; signed_in: boolean };
type Usage = { days: number; last_seen: string | null; sign_ins: number; visits: number; total_ms: number; pages: { name: string; views: number; ms: number }[]; recent: Visit[] };

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function ago(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function PortalActivity({ clientId }: { clientId: string }) {
  const [usage, setUsage] = useState<Usage | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ usage: Usage | null }>(`/api/portal-usage?client=${clientId}`).then((r) => { if (!cancelled) setUsage(r.usage); }).catch(() => { if (!cancelled) setUsage(null); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (usage === undefined) return null;
  if (usage === null) return <p className={w.muted} style={{ margin: 0, fontSize: 12.5 }}>Run migration 059 in Supabase to see what they do in their portal.</p>;

  const maxMs = Math.max(1, ...usage.pages.map((p) => p.ms));
  return (
    <section style={{ border: '1px solid var(--a-border, #e6e6e6)', borderRadius: 22, padding: '16px 18px', background: '#fff' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.065em', wordSpacing: '0.1em' }}>Portal activity</h3>
        <span className={w.muted} style={{ fontSize: 12.5 }}>
          {usage.last_seen ? `Last in ${ago(usage.last_seen)}` : 'Hasn’t been in their portal yet'} · last {usage.days} days
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, margin: '12px 0' }}>
        {[['Sign-ins', String(usage.sign_ins)], ['Visits', String(usage.visits)], ['Time in portal', duration(usage.total_ms)], ['Per visit', usage.visits ? duration(usage.total_ms / usage.visits) : '—']].map(([label, value]) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: 14, background: '#f5f5f5' }}>
            <div style={{ fontSize: 12, color: '#6b6b6b' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.05em' }}>{value}</div>
          </div>
        ))}
      </div>
      {usage.pages.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {usage.pages.slice(0, 6).map((pg) => (
            <div key={pg.name} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{pg.name}</span>
              <span style={{ height: 8, borderRadius: 999, background: '#f0f0f0', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.max(4, (pg.ms / maxMs) * 100)}%`, background: '#e50586', borderRadius: 999 }} /></span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{duration(pg.ms)} <span className={w.muted} style={{ fontWeight: 500 }}>· {pg.views} view{pg.views === 1 ? '' : 's'}</span></span>
            </div>
          ))}
        </div>
      )}
      {usage.recent.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} style={{ marginTop: 12, border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
            {open ? 'Hide recent visits' : `Recent visits (${usage.recent.length})`}
          </button>
          {open && (
            <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }}>
              {usage.recent.map((v) => (
                <li key={v.session_id} style={{ padding: '10px 12px', borderRadius: 14, background: '#f5f5f5', fontSize: 13 }}>
                  <strong>{when(v.started_at)}</strong> · {duration(v.ms)}{v.signed_in ? ' · signed in' : ''}
                  <div className={w.muted} style={{ fontSize: 12.5, marginTop: 2 }}>{v.pages.join(' → ') || '—'}</div>
                  {v.actions.length > 0 && <div style={{ fontSize: 12.5, marginTop: 2 }}>{v.actions.join(' · ')}</div>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
