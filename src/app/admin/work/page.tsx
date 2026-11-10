'use client';

// Clients → Work in progress (migration 052): every project with a checklist
// or a social media package, how far along it is, and what needs doing next —
// starting stats for a new social package, the completion report at the end.

import { useEffect, useState } from 'react';
import w from '../crm/workspace.module.css';
import k from './work.module.css';
import { apiGet } from '../proposals/adminApi';
import { WorkLine, type WorkRow } from './WorkLine';

export default function WorkPage() {
  const [rows, setRows] = useState<WorkRow[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<{ ready: boolean; projects: WorkRow[] }>('/api/work')
      .then((d) => { setRows(d.projects); setReady(d.ready); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);

  const active = (rows ?? []).filter((r) => !r.completed_at);
  const finished = (rows ?? []).filter((r) => r.completed_at);

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Work in progress</h1>
          <p className={w.sub}>Accepted estimates and signed proposals become checklists. Tick things off as you go; clients see the progress bar move. When it’s done, send the completion report.</p>
        </div>
      </div>
      {error && <p className={k.error}>{error}</p>}
      {!ready && <div className={w.empty}>Run <code>supabase/migrations/052_project_work.sql</code> in Supabase to start tracking work.</div>}
      {rows === null && !error && <p className={w.muted}>Loading…</p>}
      {rows && ready && rows.length === 0 && (
        <div className={w.empty}>Nothing yet. When a client accepts an estimate or signs a proposal, its checklist shows up here.</div>
      )}
      {active.length > 0 && <div className={k.list}>{active.map((r) => <WorkLine key={r.id} row={r} />)}</div>}
      {finished.length > 0 && (
        <>
          <h2 className={k.sectionTitle}>Finished</h2>
          <div className={k.list}>{finished.map((r) => <WorkLine key={r.id} row={r} />)}</div>
        </>
      )}
    </div>
  );
}
