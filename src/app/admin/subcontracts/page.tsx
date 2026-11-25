'use client';

// Sales → Subcontracts (migration 076): work Thrive does under another company
// (the prime) for their client. Jobs: every subcontract deal with its protocol
// progress and next step, opened in place; "+ Subcontract job" marks a deal.
// Protocol: the rules, fit-check questions, red flags, agreement terms and the
// emails — the same as the "Subcontracting Protocol" doc.

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { useCrm } from '../crm/CrmContext';
import { AGREEMENT_TERMS, FIT_QUESTIONS, RED_FLAGS, RULES, TEMPLATES } from '@/lib/subcontract';
import SubcontractChecklist, { progressBar, type Job } from './SubcontractChecklist';

type OpenDeal = { id: string; title: string; stage: string; contact: string };
type Tab = 'jobs' | 'protocol';

export default function SubcontractsPage() {
  const { openContact, notify, version } = useCrm();
  const [tab, setTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [deals, setDeals] = useState<OpenDeal[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dealId, setDealId] = useState('');
  const [endClient, setEndClient] = useState('');
  const [showDone, setShowDone] = useState(false);

  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let off = false;
    apiGet<{ jobs: Job[]; deals: OpenDeal[] }>('/api/subcontracts')
      .then((r) => { if (!off) { setJobs(r.jobs); setDeals(r.deals); setError(''); } })
      .catch((e) => { if (!off) { setJobs([]); setError(e instanceof Error ? e.message : 'Could not load'); } });
    return () => { off = true; };
  }, [tick, version]);

  async function add() {
    if (!dealId) return;
    try {
      const r = await apiSend<{ job: Job | null }>('/api/subcontracts', 'POST', { deal_id: dealId, end_client: endClient.trim() || null });
      setAdding(false); setDealId(''); setEndClient('');
      if (r.job) setOpen(r.job.deal_id);
      notify('Subcontract job added.');
      reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not add', 'error');
    }
  }

  const replace = (id: string, job: Job | null) => {
    setJobs((cur) => (job ? cur?.map((j) => (j.deal_id === id ? job : j)) : cur?.filter((j) => j.deal_id !== id)) ?? cur);
    if (!job) reload();
  };

  const active = jobs?.filter((j) => !j.closed_at && j.stage !== 'lost') ?? [];
  const finished = jobs?.filter((j) => j.closed_at || j.stage === 'lost') ?? [];
  const waitingDeposit = active.filter((j) => !j.steps.find((s) => s.key === 'deposit_paid')?.done).length;
  const waitingBalance = active.filter((j) => j.steps.find((s) => s.key === 'deposit_paid')?.done && !j.steps.find((s) => s.key === 'balance_paid')?.done).length;

  const row = (j: Job) => {
    const expanded = open === j.deal_id;
    return (
      <div key={j.deal_id} className={w.card} style={{ padding: '14px 16px' }}>
        <button type="button" onClick={() => setOpen(expanded ? null : j.deal_id)} aria-expanded={expanded}
          style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 8, width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>{j.prime_company || j.prime_name}</strong>
            <span className={w.muted}>→ {j.end_client || 'end client?'}</span>
            <span className={w.muted}>· {j.deal_title}</span>
            <span className={w.muted} style={{ marginLeft: 'auto' }}>{j.done} of {j.total}</span>
          </span>
          {progressBar(j.done, j.total)}
          <span className={w.muted} style={{ fontSize: 13 }}>{j.next ? `Next: ${j.next.label}` : 'Every step done'}</span>
        </button>
        {expanded && (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <div>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => openContact(j.contact_id, j.deal_id)}>Open {j.prime_name} and the deal</button>
            </div>
            <SubcontractChecklist job={j} onChange={(next) => replace(j.deal_id, next)} notify={notify} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Subcontracts</h1>
          <p className={w.sub}>Work for agencies and other companies. The company hiring you is the client; everything runs through them.</p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => { setTab('jobs'); setAdding(true); }} disabled={!jobs}>+ Subcontract job</button>
        </div>
      </div>

      <div className={w.tabs} role="tablist">
        {(['jobs', 'protocol'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${w.tab} ${tab === t ? w.tabOn : ''}`} onClick={() => setTab(t)}>
            {t === 'jobs' ? `Jobs${active.length ? ` (${active.length})` : ''}` : 'Protocol'}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {error && <p style={{ color: 'var(--a-danger)', margin: 0 }}>{error}</p>}
          {jobs && jobs.length > 0 && (
            <div className={w.statRow}>
              <div className={w.stat}><p className={w.statLabel}>Active</p><p className={w.statValue}>{active.length}</p></div>
              <div className={w.stat}><p className={w.statLabel}>Waiting on a deposit</p><p className={w.statValue}>{waitingDeposit}</p><p className={w.statNote}>No work before it’s paid</p></div>
              <div className={w.stat}><p className={w.statLabel}>Balance to collect</p><p className={w.statValue}>{waitingBalance}</p></div>
              <div className={w.stat}><p className={w.statLabel}>Finished</p><p className={w.statValue}>{finished.length}</p></div>
            </div>
          )}

          {adding && (
            <div className={w.card} style={{ padding: 16, display: 'grid', gap: 10 }}>
              <strong>Which deal is subcontract work?</strong>
              <p className={w.muted} style={{ margin: 0, fontSize: 13 }}>The deal’s contact is the prime (the company hiring you). No deal yet? Add the prime as a contact and make a New deal named “Prime — End client — work” first.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select className={p.select} value={dealId} onChange={(e) => setDealId(e.target.value)} style={{ flex: '1 1 260px' }}>
                  <option value="">Pick a deal…</option>
                  {deals.map((d) => <option key={d.id} value={d.id}>{d.contact ? `${d.contact} — ` : ''}{d.title}</option>)}
                </select>
                <input className={p.input} value={endClient} onChange={(e) => setEndClient(e.target.value)} placeholder="End client (optional)" maxLength={160} style={{ flex: '1 1 200px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!dealId} onClick={add}>Add</button>
                <button type="button" className={p.btn} onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          )}

          {jobs === null && <p className={w.muted}>Loading…</p>}
          {jobs && jobs.length === 0 && !adding && !error && (
            <div className={w.empty}>
              No subcontract jobs yet. Turn one on from a deal (“Subcontract work?” in the contact panel) or with + Subcontract job. Read the Protocol tab before the first call.
            </div>
          )}
          {active.map(row)}
          {finished.length > 0 && (
            <>
              <button type="button" className={p.btn} style={{ justifySelf: 'start' }} onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide' : 'Show'} finished ({finished.length})</button>
              {showDone && finished.map(row)}
            </>
          )}
        </div>
      )}

      {tab === 'protocol' && <Protocol notify={notify} />}
    </div>
  );
}

function Protocol({ notify }: { notify: (m: string, tone?: 'ok' | 'error') => void }) {
  const vars = { first: '[Name]', endClient: '[End client]', work: '[work]' };
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); notify('Copied.'); } catch { notify('Could not copy', 'error'); }
  }
  const h: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 10px' };
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
      <section className={w.card} style={{ padding: 18 }}>
        <h2 style={h}>The rules</h2>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14 }}>
          {RULES.map((r) => <li key={r}>{r}</li>)}
        </ol>
      </section>

      <section className={w.card} style={{ padding: 18 }}>
        <h2 style={h}>Fit-check call: ask before you quote</h2>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, fontSize: 14 }}>
          {FIT_QUESTIONS.map((q) => <li key={q.q}><strong>{q.q}</strong> <span className={w.muted}>{q.why}</span></li>)}
        </ol>
      </section>

      <section className={w.card} style={{ padding: 18 }}>
        <h2 style={h}>Red flags: walk away or ask for a bigger deposit</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14 }}>
          {RED_FLAGS.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>

      <section className={w.card} style={{ padding: 18 }}>
        <h2 style={h}>Subcontractor agreement: what you want it to say</h2>
        <table className={w.table}>
          <thead><tr><th style={{ textAlign: 'left' }}>Term</th><th style={{ textAlign: 'left' }}>What you want</th></tr></thead>
          <tbody>{AGREEMENT_TERMS.map((t) => <tr key={t.term}><td style={{ fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{t.term}</td><td>{t.want}</td></tr>)}</tbody>
        </table>
        <p className={w.muted} style={{ fontSize: 13, margin: '10px 0 0' }}>Also keep ready: your W-9, and a certificate of insurance if a larger agency asks. Not legal advice: have a lawyer review your agreement template once.</p>
      </section>

      <section className={w.card} style={{ padding: 18 }}>
        <h2 style={h}>Emails</h2>
        <p className={w.muted} style={{ fontSize: 13, margin: '0 0 10px' }}>On a job’s checklist these fill in the prime’s name, the end client and the work for you.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {TEMPLATES.map((t) => {
            const body = t.body(vars);
            return (
              <div key={t.key} style={{ border: '1px solid var(--a-border)', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ flex: 1, fontSize: 14 }}>{t.name}</strong>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => copy(body)}>Copy</button>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: '6px 0 0', color: '#333' }}>{body}</pre>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
