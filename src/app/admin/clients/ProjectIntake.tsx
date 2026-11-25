'use client';

// Inside a project on the Client tab: the questionnaires and file requests
// filed under it — answers one click away, files sent shown right here — and
// any of the client's that aren't filed under a project yet, with "File here".
// Reads the same routes as the Profile cards (QuestionnairesSection,
// AssetRequestsSection); filing is their PATCH 'project' / 'edit' actions.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { STATUS_LABELS, type AssignmentStatus } from '@/lib/questionnaires';
import { STATUS_LABEL, fileSize, progressOf, type AssetRequest, type AssetStatus } from '@/lib/assetRequests';

type Assigned = { id: string; title: string; status: AssignmentStatus; project_id: string | null; answered: number; total: number; submitted_at: string | null };

const Q_PILL: Record<AssignmentStatus, { bg: string; fg: string }> = {
  not_started: { bg: '#0a0a0a', fg: '#fff' },
  in_progress: { bg: '#fd6100', fg: '#fff' },
  reopened: { bg: '#e50586', fg: '#fff' },
  submitted: { bg: '#0cf574', fg: '#0a0a0a' },
};
const A_PILL: Record<AssetStatus, { bg: string; fg: string }> = {
  open: { bg: '#fd6100', fg: '#fff' },
  submitted: { bg: '#0cf574', fg: '#0a0a0a' },
  received: { bg: '#0a0a0a', fg: '#fff' },
};

const pill = (c: { bg: string; fg: string }, text: string) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{text}</span>
);
const day = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ProjectIntake({ clientId, projectId, projectName }: { clientId: string; projectId: string; projectName: string }) {
  const [qs, setQs] = useState<Assigned[] | null>(null);
  const [reqs, setReqs] = useState<AssetRequest[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let off = false;
    Promise.all([
      apiGet<{ assignments: Assigned[] }>(`/api/admin/questionnaires/assignments?client=${clientId}`).catch(() => ({ assignments: [] as Assigned[] })),
      apiGet<{ requests: AssetRequest[] }>(`/api/admin/asset-requests?client=${clientId}`).catch(() => ({ requests: [] as AssetRequest[] })),
    ]).then(([a, r]) => { if (!off) { setQs(a.assignments); setReqs(r.requests); } });
    return () => { off = true; };
  }, [clientId, tick]);

  async function file(kind: 'q' | 'a', id: string) {
    setBusy(id); setErr('');
    try {
      if (kind === 'q') await apiSend(`/api/admin/questionnaires/assignments/${id}`, 'PATCH', { action: 'project', projectId });
      else await apiSend(`/api/admin/asset-requests/${id}`, 'PATCH', { action: 'edit', projectId });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not file it'); }
    setBusy('');
  }

  if (!qs) return null;
  const mineQ = qs.filter((a) => a.project_id === projectId);
  const mineA = reqs.filter((r) => r.project_id === projectId);
  const looseQ = qs.filter((a) => !a.project_id);
  const looseA = reqs.filter((r) => !r.project_id);

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--a-border)' };
  const small: React.CSSProperties = { fontSize: 12, color: 'var(--a-muted)' };

  return (
    <div style={{ fontFamily: 'var(--a-font)' }}>
      <h4 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 6px' }}>Questionnaires &amp; File Requests</h4>
      {err && <p style={{ fontSize: 12.5, color: 'var(--a-danger)', margin: '0 0 6px' }}>{err}</p>}
      {!mineQ.length && !mineA.length && <p style={{ ...small, margin: '0 0 6px' }}>Nothing filed under {projectName} yet.</p>}

      {mineQ.map((a) => (
        <div key={a.id} style={row}>
          <strong style={{ fontSize: 13.5 }}>{a.title}</strong>
          {pill(Q_PILL[a.status], STATUS_LABELS[a.status])}
          <span style={small}>{a.answered} of {a.total} answered{a.submitted_at && a.status === 'submitted' ? ` · ${day(a.submitted_at)}` : ''}</span>
          <Link href={`/admin/questionnaires/responses/${a.id}`} className={`${p.btn} ${p.btnSmall} ${a.status === 'submitted' ? p.btnPrimary : ''}`} style={{ marginLeft: 'auto' }}>
            {a.status === 'submitted' ? 'Read answers' : 'View answers'}
          </Link>
        </div>
      ))}

      {mineA.map((r) => {
        const pr = progressOf(r.items);
        const files = r.items.flatMap((i) => i.files.map((f) => ({ ...f, item: i.label })));
        const links = r.items.filter((i) => i.link);
        return (
          <div key={r.id} style={{ ...row, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13.5 }}>{r.title}</strong>
                {pill(A_PILL[r.status], STATUS_LABEL[r.status])}
                <span style={small}>{pr.done} of {pr.total} sent</span>
              </div>
              {(files.length > 0 || links.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {files.map((f) => (
                    <a key={f.path} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" title={`${f.item} · ${fileSize(f.size)}`}
                      style={{ fontSize: 12, border: '1px solid var(--a-border)', borderRadius: 999, padding: '3px 10px', color: '#0a0a0a', textDecoration: 'none', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </a>
                  ))}
                  {links.map((i) => (
                    <a key={i.id} href={i.link!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, border: '1px solid #3943b7', borderRadius: 999, padding: '3px 10px', color: '#3943b7', textDecoration: 'none' }}>
                      {i.label} link ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className={`${p.btn} ${p.btnSmall}`}
              onClick={() => document.getElementById('client-asset-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              title="Notes, “doesn’t have it”, Remind and Mark received are on the Files Requested card">All details</button>
          </div>
        );
      })}

      {(looseQ.length > 0 || looseA.length > 0) && (
        <div style={{ marginTop: 8, background: 'var(--a-surface-2)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ ...small, fontWeight: 700 }}>Not filed under a project yet</div>
          {looseQ.map((a) => (
            <div key={a.id} style={{ ...row, borderTop: 'none', padding: '6px 0' }}>
              <span style={{ fontSize: 13 }}>{a.title}</span>
              {pill(Q_PILL[a.status], STATUS_LABELS[a.status])}
              <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginLeft: 'auto' }} disabled={busy === a.id} onClick={() => file('q', a.id)}>File here</button>
            </div>
          ))}
          {looseA.map((r) => (
            <div key={r.id} style={{ ...row, borderTop: 'none', padding: '6px 0' }}>
              <span style={{ fontSize: 13 }}>{r.title}</span>
              {pill(A_PILL[r.status], STATUS_LABEL[r.status])}
              <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginLeft: 'auto' }} disabled={busy === r.id} onClick={() => file('a', r.id)}>File here</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
