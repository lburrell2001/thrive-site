'use client';

// On a deal in the contact panel: "Subcontract work" turns on the protocol
// (migration 076); once on, a line with progress and the next step opens the
// checklist (SubcontractChecklist).

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import SubcontractChecklist, { progressBar, type Job } from './SubcontractChecklist';

export default function DealSubcontract({ dealId, notify }: { dealId: string; notify: (m: string, tone?: 'ok' | 'error') => void }) {
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    apiGet<{ job: Job | null }>(`/api/subcontracts/${dealId}`)
      .then((r) => { if (!off) setJob(r.job); })
      .catch(() => { if (!off) setJob(null); });
    return () => { off = true; };
  }, [dealId]);

  async function turnOn() {
    setBusy(true);
    try {
      const r = await apiSend<{ job: Job | null }>('/api/subcontracts', 'POST', { deal_id: dealId, end_client: null });
      setJob(r.job);
      setOpen(true);
      notify('Subcontract protocol on for this deal.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not turn it on', 'error');
    }
    setBusy(false);
  }

  if (job === undefined) return null;
  if (!job) {
    return (
      <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginTop: 8 }} disabled={busy} onClick={turnOn}
        title="Working under another company for their client: turns on the subcontract checklist for this deal">
        Subcontract work?
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--a-border)', borderRadius: 12, padding: '10px 12px', background: '#fff' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 6, width: '100%' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#9409ce', color: '#fff' }}>Subcontract</span>
          <strong>{job.end_client ? `For ${job.end_client}` : 'Add the end client'}</strong>
          <span style={{ color: 'var(--a-muted)' }}>{job.done} of {job.total}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--a-muted)', fontSize: 12 }}>{open ? 'Hide' : 'Checklist'}</span>
        </span>
        {progressBar(job.done, job.total)}
        {!open && job.next && <span style={{ fontSize: 12, color: 'var(--a-muted)' }}>Next: {job.next.label}</span>}
      </button>
      {open && <div style={{ marginTop: 10 }}><SubcontractChecklist job={job} compact onChange={(j) => { setJob(j); if (!j) setOpen(false); }} notify={notify} /></div>}
    </div>
  );
}
