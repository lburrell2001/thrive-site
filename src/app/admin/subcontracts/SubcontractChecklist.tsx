'use client';

// One subcontract job's protocol (migration 076): the end client, the 14 steps
// by phase (auto ones tick themselves from estimates, invoices and the portal;
// any step can be ticked by hand), notes, and the emails with Copy filled in
// for this prime. Used on the deal in the contact panel and on Subcontracts.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiSend } from '../proposals/adminApi';
import { PHASES, STEPS, TEMPLATES, type StepKey } from '@/lib/subcontract';
import type { SubcontractJob } from '@/lib/subcontractRepo';

export type Job = SubcontractJob;

export function progressBar(done: number, total: number) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ background: '#f0f0f0', borderRadius: 999, height: 5 }} aria-label={`${done} of ${total} steps done`}>
      <div style={{ height: 5, borderRadius: 999, background: '#0cf574', width: `${pct}%` }} />
    </div>
  );
}

export default function SubcontractChecklist({ job, onChange, notify, compact = false }: {
  job: Job;
  onChange: (job: Job | null) => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
  compact?: boolean;
}) {
  const [endClient, setEndClient] = useState(job.end_client ?? '');
  const [notes, setNotes] = useState(job.notes ?? '');
  const [busy, setBusy] = useState<string>('');
  const [showEmails, setShowEmails] = useState(false);

  async function patch(body: Record<string, unknown>, key: string, ok?: string) {
    setBusy(key);
    try {
      const r = await apiSend<{ job: Job | null }>(`/api/subcontracts/${job.deal_id}`, 'PATCH', body);
      onChange(r.job);
      if (ok) notify(ok);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save', 'error');
    }
    setBusy('');
  }

  async function stop() {
    if (!window.confirm(`Stop treating “${job.deal_title}” as subcontract work? Its checklist ticks and notes are removed; the deal itself stays.`)) return;
    try {
      await apiSend(`/api/subcontracts/${job.deal_id}`, 'DELETE');
      onChange(null);
      notify('No longer a subcontract job.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); notify(`${what} copied.`); }
    catch { notify('Could not copy — select the text instead.', 'error'); }
  }

  const vars = {
    first: job.prime_name.split(/\s+/)[0] || 'there',
    endClient: job.end_client || '[End client]',
    work: job.deal_title,
  };
  const small: React.CSSProperties = { fontSize: 12, color: 'var(--a-muted)' };

  return (
    <div style={{ display: 'grid', gap: 12, fontFamily: 'var(--a-font)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 600, flex: '1 1 200px' }}>
          End client (who the work is for)
          <input className={p.input} value={endClient} maxLength={160} placeholder="e.g. Eagles 4031"
            onChange={(e) => setEndClient(e.target.value)}
            onBlur={() => { if ((job.end_client ?? '') !== endClient.trim()) void patch({ end_client: endClient.trim() || null }, 'end', 'End client saved.'); }} />
        </label>
        <span style={{ ...small, paddingBottom: 10 }}>Prime: <strong style={{ color: '#0a0a0a' }}>{job.prime_company || job.prime_name}</strong>{job.prime_company ? ` · ${job.prime_name}` : ''}{job.portal_client_id ? '' : ' · no portal login yet'}</span>
      </div>

      {PHASES.map((phase) => (
        <div key={phase}>
          <div style={{ fontSize: 12, fontWeight: 800, margin: '0 0 4px' }}>{phase}</div>
          <div style={{ display: 'grid', gap: 2 }}>
            {STEPS.filter((s) => s.phase === phase).map((s) => {
              const st = job.steps.find((x) => x.key === s.key)!;
              const autoDone = st.by === 'auto';
              return (
                <label key={s.key} title={s.help} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', cursor: autoDone ? 'default' : 'pointer', fontSize: 13.5 }}>
                  <input type="checkbox" checked={st.done} disabled={autoDone || busy === s.key} style={{ marginTop: 3 }}
                    onChange={(e) => void patch({ step: { key: s.key as StepKey, done: e.target.checked } }, s.key)} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: st.done ? 500 : 600, color: st.done ? 'var(--a-muted)' : '#0a0a0a' }}>{s.label}</span>
                    {!compact && !st.done && <span style={{ ...small, display: 'block' }}>{s.help}</span>}
                  </span>
                  {s.auto && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', background: autoDone ? '#0cf574' : '#ffffff', color: '#0a0a0a', border: autoDone ? 'none' : '1px solid var(--a-border)' }}
                      title={autoDone ? 'Ticked from what’s in the system' : 'Ticks itself when it happens; tick it by hand if it happened another way'}>
                      {autoDone ? 'Done' : 'Auto'}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <label style={{ display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 600 }}>
        Notes (approver, white label or not, portfolio rules, payment terms agreed)
        <textarea className={p.input} rows={compact ? 2 : 3} value={notes} maxLength={4000}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if ((job.notes ?? '') !== notes.trim()) void patch({ notes: notes.trim() || null }, 'notes', 'Notes saved.'); }} />
      </label>

      <div>
        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setShowEmails((v) => !v)} aria-expanded={showEmails}>
          {showEmails ? 'Hide emails' : 'Emails to the prime'}
        </button>
        {showEmails && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {TEMPLATES.map((t) => {
              const body = t.body(vars);
              return (
                <div key={t.key} style={{ border: '1px solid var(--a-border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13, flex: 1 }}>{t.name}</strong>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => copy(body, 'Email')}>Copy email</button>
                    {job.prime_email && (
                      <a className={`${p.btn} ${p.btnSmall}`} href={`mailto:${job.prime_email}?subject=${encodeURIComponent(t.subject(vars))}&body=${encodeURIComponent(body)}`}>Open in mail</a>
                    )}
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, margin: '6px 0 0', color: '#333' }}>{body}</pre>
                </div>
              );
            })}
            <p style={{ ...small, margin: 0 }}>Fill in the [brackets] before sending.</p>
          </div>
        )}
      </div>

      <div>
        <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={stop}>Not subcontract work</button>
      </div>
    </div>
  );
}
