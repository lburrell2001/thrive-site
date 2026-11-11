'use client';

// "Set up the portal" for each new project (migration 057, src/lib/portalSetup.ts):
// invite them, assign questionnaires, add an estimate or invoice, add
// milestones. Each step ticks itself once it's done. A new client's first
// project must be set up (no skip; Home lists it). For an existing client
// it's optional: a slim prompt that opens the checklist, or "Not needed".
// Shown at the top of the client tab.

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';

// On the black card: white pills, magenta for the next thing to do.
const LIGHT: React.CSSProperties = { background: '#fff', color: '#141414' };
const PINK: React.CSSProperties = { background: '#e50586', color: '#fff' };

type Step = 'invite' | 'questionnaire' | 'billing' | 'milestones';
type Setup = {
  project_id: string; project_name: string; client_id: string; client_name: string;
  steps: Record<Step, boolean>; invited_at: string | null; signed_in: boolean; required?: boolean;
};

export default function PortalSetup({ clientId, version, onGo, notify }: {
  clientId: string;
  /** Changes when the client's data reloads, so the ticks catch up. */
  version: unknown;
  onGo: (where: 'questionnaires' | 'milestones', projectId: string) => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [busy, setBusy] = useState('');
  // Optional setups the admin has opened.
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    apiGet<{ setups: Setup[] }>(`/api/portal-setup?client=${clientId}`).then((r) => setSetups(r.setups)).catch(() => setSetups([]));
  }, [clientId]);

  useEffect(() => { load(); }, [load, version]);
  // Questionnaires and invoices are added elsewhere: check again when the tab comes back into view.
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again); };
  }, [load]);

  if (!setups.length) return null;

  async function invite(s: Setup) {
    if (!window.confirm(`Email ${s.client_name} that their client portal is ready${s.steps.invite ? ' (again)' : ''}? It has a button to sign in, and they get a text too if they've opted in.`)) return;
    setBusy(`invite-${s.project_id}`);
    try {
      const r = await apiSend<{ to: string; texted: boolean }>('/api/portal-setup', 'POST', { action: 'invite', client_id: s.client_id, project_name: s.project_name });
      notify(`Portal invite sent to ${r.to}${r.texted ? ' (and texted)' : ''}.`);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send it', 'error');
    }
    setBusy('');
  }

  async function skip(s: Setup) {
    if (!window.confirm(`Skip the portal setup for ${s.project_name}? ${s.client_name} already has their portal from earlier work.`)) return;
    try {
      await apiSend('/api/portal-setup', 'POST', { action: 'skip', project_id: s.project_id });
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not skip it', 'error');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {setups.map((s) => {
        const done = Object.values(s.steps).filter(Boolean).length;
        const href = (mode: 'estimate' | 'invoice') => `/admin/invoices?mode=${mode}&client=${s.client_id}&project=${encodeURIComponent(s.project_name)}`;
        const rows: { key: Step; title: string; detail: string; action: React.ReactNode }[] = [
          {
            key: 'invite', title: 'Send the portal invite',
            detail: s.signed_in ? 'They’ve signed in.' : s.invited_at ? `Sent ${formatDate(s.invited_at)}.` : 'An email (and text, if opted in) that their portal is ready, with a sign-in button.',
            action: <button type="button" className={`${p.btn} ${p.btnSmall}`} style={s.steps.invite ? LIGHT : PINK} disabled={busy !== ''} onClick={() => invite(s)}>{busy === `invite-${s.project_id}` ? 'Sending…' : s.steps.invite ? 'Send again' : 'Send invite'}</button>,
          },
          {
            key: 'questionnaire', title: 'Assign questionnaires',
            detail: 'About You, plus the one for the service.',
            action: <button type="button" className={`${p.btn} ${p.btnSmall}`} style={LIGHT} onClick={() => onGo('questionnaires', s.project_id)}>Assign</button>,
          },
          {
            key: 'billing', title: 'Add an estimate or invoice',
            detail: 'On this project, so it shows in their portal.',
            action: <span style={{ display: 'inline-flex', gap: 6 }}>
              <a className={`${p.btn} ${p.btnSmall}`} style={LIGHT} href={href('estimate')}>+ Estimate</a>
              <a className={`${p.btn} ${p.btnSmall}`} style={LIGHT} href={href('invoice')}>+ Invoice</a>
            </span>,
          },
          {
            key: 'milestones', title: 'Add milestones',
            detail: 'The dates they’ll see on the project.',
            action: <button type="button" className={`${p.btn} ${p.btnSmall}`} style={LIGHT} onClick={() => onGo('milestones', s.project_id)}>Add</button>,
          },
        ];
        // An existing client: optional, folded until opened.
        if (s.required === false && !opened.has(s.project_id)) {
          return (
            <section key={s.project_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', borderRadius: 16, border: '1.5px dashed #d4d4d4', fontSize: 13 }}>
              <span><strong>{s.project_name}</strong> is new. Set up its portal pieces? <span style={{ color: '#6b6b6b' }}>Optional for an existing client · {done} of 4 done</span></span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => skip(s)}>Not needed</button>
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} onClick={() => setOpened((cur) => new Set(cur).add(s.project_id))}>Set it up</button>
              </span>
            </section>
          );
        }
        return (
          <section key={s.project_id} style={{ padding: '16px 18px', borderRadius: 22, background: '#141414', color: '#fff' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.065em', wordSpacing: '0.1em' }}>Set up the portal for {s.project_name}</h3>
              <span style={{ fontSize: 12.5, color: '#d4d4d4' }}>
                {done} of 4 done
                {/* A new client's first project can't be skipped. */}
                {s.required === false && <> · <button type="button" onClick={() => skip(s)} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: '#d4d4d4', textDecoration: 'underline', cursor: 'pointer' }}>Not needed</button></>}
              </span>
            </div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {rows.map((r) => (
                <li key={r.key} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: s.steps[r.key] ? 'rgba(12, 245, 116, 0.14)' : 'rgba(255, 255, 255, 0.08)' }}>
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, background: s.steps[r.key] ? '#0cf574' : 'transparent', color: '#141414', boxShadow: s.steps[r.key] ? 'none' : 'inset 0 0 0 2px rgba(255,255,255,0.5)' }}>{s.steps[r.key] ? '✓' : ''}</span>
                  <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{r.title}</strong>
                    <span style={{ fontSize: 12.5, color: '#d4d4d4' }}>{r.detail}</span>
                  </span>
                  <span>{r.action}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
