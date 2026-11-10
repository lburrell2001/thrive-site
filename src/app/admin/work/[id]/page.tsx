'use client';

// One project's work (migration 052): the checklist (ticking moves the
// client's progress bar), social growth — starting stats when it opens,
// ending stats at the end, the change worked out — and the completion report.

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../../proposals/proposals.module.css';
import w from '../../crm/workspace.module.css';
import k from '../work.module.css';
import { apiGet, apiSend, formatDate } from '../../proposals/adminApi';
import { Toast, useToast } from '../../proposals/Toast';
import { DEFAULT_METRICS, PLATFORMS, growth, hasEndingStats, hasStartingStats, type Metric, type ProjectTask, type SocialAccount } from '@/lib/projectWork';
import { changeText, type ReportData } from '@/lib/reportPDF';
import { formatLineMoney } from '@/lib/lineItems';

type Data = {
  project: { id: string; name: string; kind: string | null; status: string; progress: number; completed_at: string | null; crm_deal_id: string | null; created_at: string };
  client: { id: string; full_name: string; company_name: string; email: string | null };
  tasks: ProjectTask[];
  accounts: SocialAccount[];
  reports: { id: string; sent_at: string; sent_to: string | null }[];
  invoices: { id: string; invoice_number: string; amount_cents: number; status: string; paid_cents: number }[];
  estimates: { id: string; estimate_number: string; title: string; total_cents: number; status: string; accepted_at: string | null; lines: number }[];
  deal: { id: string; title: string; stage: string; closed_at: string | null; monthly_cents: number | null } | null;
  started_at: string;
};

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const toNum = (v: string): number | null => {
  const n = Number.parseFloat(v.replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export default function ProjectWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ email: string; note: string; next: string; close: boolean } | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const d = await apiGet<Data>(`/api/work/${id}`);
      setData(d);
      setReport((cur) => cur ?? {
        email: d.client.email ?? '',
        note: '',
        next: d.project.kind === 'social'
          ? 'Keep the momentum going: staying on monthly social keeps your growth compounding. Reply to this email and we’ll keep your calendar full.'
          : 'Keep your site fast, secure and up to date with a Thrive care plan (from $100 a month). Reply to this email and we’ll set it up.',
        close: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    apiGet<Data>(`/api/work/${id}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setReport({
          email: d.client.email ?? '',
          note: '',
          next: d.project.kind === 'social'
            ? 'Keep the momentum going: staying on monthly social keeps your growth compounding. Reply to this email and we’ll keep your calendar full.'
            : 'Keep your site fast, secure and up to date with a Thrive care plan (from $100 a month). Reply to this email and we’ll set it up.',
          close: true,
        });
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load'); });
    return () => { cancelled = true; };
  }, [id]);

  async function act(body: Record<string, unknown>, done?: string) {
    setBusy(true);
    try {
      await apiSend(`/api/work/${id}`, 'POST', body);
      if (done) show(done);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
    }
    setBusy(false);
  }

  if (error) return <div className={w.page}><p className={k.error}>{error}</p><Link href="/admin/work" className={k.back}>← Work in progress</Link></div>;
  if (!data || !report) return <div className={w.page}><p className={w.muted}>Loading…</p></div>;

  const { project, client, tasks, accounts } = data;
  const done = tasks.filter((t) => t.done_at).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : project.progress;
  const social = project.kind === 'social';
  const clientName = client.company_name || client.full_name || 'Client';
  const invoiced = data.invoices.reduce((n, i) => n + i.amount_cents, 0);
  const paid = data.invoices.reduce((n, i) => n + i.paid_cents, 0);
  const unusedEstimates = data.estimates.filter((e) => e.lines > 0 && !tasks.some((t) => t.estimate_id === e.id));

  function reportData(): ReportData {
    return {
      project: project.name,
      client: clientName,
      started_on: data!.started_at.slice(0, 10),
      finished_on: today(),
      items: tasks.map((t) => ({ title: t.title, done_on: t.done_at ? t.done_at.slice(0, 10) : null })),
      social: social ? accounts.map((a) => ({ platform: a.platform, handle: a.handle, start_on: a.start_captured_on, end_on: a.end_captured_on, metrics: a.metrics })) : [],
      invoiced_cents: invoiced,
      paid_cents: paid,
      next_step: report!.next,
      note: report!.note,
    };
  }

  async function previewReport() {
    const { generateReportPDF } = await import('@/lib/reportPDF');
    await generateReportPDF(reportData());
  }

  async function sendReport() {
    if (!report) return;
    const left = tasks.length - done;
    if (left > 0 && !window.confirm(`${left} item${left === 1 ? ' is' : 's are'} not ticked off. They’ll show as in progress on the report. Send it anyway?`)) return;
    if (!window.confirm(`Email the completion report to ${report.email}? The project will be marked complete${report.close && data!.deal?.stage === 'won' && !data!.deal.closed_at ? ' and the deal closed (work finished)' : ''}.`)) return;
    setBusy(true);
    try {
      const { generateReportPDF } = await import('@/lib/reportPDF');
      const d = reportData();
      const pdf = await generateReportPDF(d, { output: 'base64' });
      await apiSend(`/api/work/${id}`, 'POST', { action: 'send_report', email: report.email, note: report.note, pdf, data: d, close_deal: report.close });
      show(`Completion report sent to ${report.email}.`);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not send it', 'error');
    }
    setBusy(false);
  }

  return (
    <div className={w.page}>
      <Link href="/admin/work" className={k.back}>← Work in progress</Link>
      <div className={k.top}>
        <h1 className={w.title}>{project.name}</h1>
        <p className={w.sub}>
          <Link href={`/admin/clients?client=${client.id}`}>{clientName}</Link>
          {' · started '}{formatDate(data.started_at)}
          {project.completed_at ? ` · finished ${formatDate(project.completed_at)}` : ''}
        </p>
        <div className={k.topBar}>
          <span className={k.bar}><span style={{ width: `${pct}%` }} /></span>
          <span className={k.count}>{tasks.length ? `${done} of ${tasks.length} done` : `${pct}%`}</span>
        </div>
      </div>

      <div className={k.grid}>
        <section className={k.card}>
          <div className={k.cardHead}>
            <h2 className={k.cardTitle}>Checklist</h2>
            <span className={w.muted}>The client sees the progress bar move</span>
          </div>
          {tasks.length === 0 && <p className={w.muted}>No checklist yet. Add items below, or fill it from an estimate.</p>}
          <ul className={k.tasks}>
            {tasks.map((t) => (
              <li key={t.id} className={`${k.task} ${t.done_at ? k.taskDone : ''}`}>
                <input type="checkbox" checked={!!t.done_at} disabled={busy} aria-label={`Done: ${t.title}`}
                  onChange={(e) => act({ action: 'update_task', task_id: t.id, done: e.target.checked })} />
                <span className={k.taskText}>
                  <strong>{t.title}</strong>
                  {t.description && <span>{t.description}</span>}
                  {t.done_at && <span>Done {formatDate(t.done_at)}</span>}
                </span>
                <button type="button" className={k.iconBtn} aria-label={`Remove ${t.title}`} disabled={busy}
                  onClick={() => { if (window.confirm(`Remove “${t.title}” from the checklist?`)) void act({ action: 'delete_task', task_id: t.id }); }}>×</button>
              </li>
            ))}
          </ul>
          <form className={k.addRow} onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) { void act({ action: 'add_task', title: newTask.trim() }); setNewTask(''); } }}>
            <input className={p.input} value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task, e.g. Collect logo files" aria-label="New task" />
            <button type="submit" className={`${p.btn} ${p.btnSmall}`} disabled={busy || !newTask.trim()}>Add</button>
          </form>
          {unusedEstimates.length > 0 && (
            <div className={k.addRow} style={{ marginTop: 10 }}>
              <select className={p.select} defaultValue="" aria-label="Fill from an estimate"
                onChange={(e) => { if (e.target.value) void act({ action: 'from_estimate', estimate_id: e.target.value }, 'Added the estimate’s items.'); e.target.value = ''; }}>
                <option value="">Fill from an estimate…</option>
                {unusedEstimates.map((e) => <option key={e.id} value={e.id}>{e.estimate_number} · {e.title || 'Untitled'} · {formatLineMoney(e.total_cents)}</option>)}
              </select>
            </div>
          )}
        </section>

        <section className={k.card}>
          <div className={k.cardHead}>
            <h2 className={k.cardTitle}>Social growth</h2>
            <label className={k.check}>
              <input type="checkbox" checked={social} disabled={busy} onChange={(e) => act({ action: 'set_social', social: e.target.checked })} />
              Social media project
            </label>
          </div>
          {!social ? (
            <p className={w.muted}>For a social media package, tick this to track each account’s starting and ending stats. The completion report shows the growth.</p>
          ) : (
            <>
              {!hasStartingStats(accounts) && <p className={k.prompt}>Get the starting analytics now, before the work moves the numbers: followers, average views, engagement and anything else you want to show growth on.</p>}
              {accounts.map((a) => <AccountCard key={a.id} account={a} busy={busy} onSave={(body) => act({ action: 'save_account', account_id: a.id, ...body }, 'Saved.')} onDelete={() => act({ action: 'delete_account', account_id: a.id })} />)}
              <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy} onClick={() => act({ action: 'add_account' })}>+ Add an account</button>
            </>
          )}
        </section>
      </div>

      <section className={k.card} style={{ marginTop: 16 }}>
        <div className={k.cardHead}>
          <h2 className={k.cardTitle}>Completion report</h2>
          {data.reports[0] && <span className={k.flagDone}>Sent {formatDate(data.reports[0].sent_at)}</span>}
        </div>
        <div className={k.summary}>
          <span><strong>{done}</strong> of {tasks.length} items delivered</span>
          {invoiced > 0 && <span><strong>{formatLineMoney(paid)}</strong> of {formatLineMoney(invoiced)} paid</span>}
          {social && <span>{hasEndingStats(accounts) ? 'Ending stats are in' : <strong style={{ color: '#fd6100' }}>Add the ending stats for the growth section</strong>}</span>}
        </div>
        <div className={k.reportFields}>
          <label>
            <span className={p.label}>What’s next (shown on the report)</span>
            <textarea className={p.textarea} rows={3} value={report.next} onChange={(e) => setReport({ ...report, next: e.target.value })} />
          </label>
          <label>
            <span className={p.label}>A note from you (optional)</span>
            <textarea className={p.textarea} rows={3} value={report.note} placeholder="Thank you for trusting us with…" onChange={(e) => setReport({ ...report, note: e.target.value })} />
          </label>
          <label>
            <span className={p.label}>Send to</span>
            <input className={p.input} type="email" value={report.email} onChange={(e) => setReport({ ...report, email: e.target.value })} />
          </label>
          {data.deal?.stage === 'won' && !data.deal.closed_at && (
            <label className={k.check}>
              <input type="checkbox" checked={report.close} onChange={(e) => setReport({ ...report, close: e.target.checked })} />
              Close the deal too (the work is finished): it leaves the pipeline and stays Won
            </label>
          )}
          <div className={k.reportActions}>
            <button type="button" className={p.btn} onClick={previewReport}>Preview PDF</button>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(report.email.trim())} onClick={sendReport}>
              {busy ? 'Working…' : data.reports.length ? 'Send it again' : 'Send completion report'}
            </button>
          </div>
        </div>
        {data.reports.length > 0 && (
          <p className={k.sent}>{data.reports.map((r) => `Sent ${formatDate(r.sent_at)}${r.sent_to ? ` to ${r.sent_to}` : ''}`).join(' · ')}. The client can download it from My Projects in their portal.</p>
        )}
      </section>
      <Toast toast={toast} />
    </div>
  );
}

/** One social account: platform, handle, the dates, and each stat's start and end with the change. */
function AccountCard({ account, busy, onSave, onDelete }: {
  account: SocialAccount; busy: boolean;
  onSave: (body: { platform: string; handle: string; metrics: Metric[]; start_captured_on: string | null; end_captured_on: string | null }) => void;
  onDelete: () => void;
}) {
  const [platform, setPlatform] = useState(account.platform);
  const [handle, setHandle] = useState(account.handle);
  const [startOn, setStartOn] = useState(account.start_captured_on ?? '');
  const [endOn, setEndOn] = useState(account.end_captured_on ?? '');
  const [rows, setRows] = useState(() => (account.metrics.length ? account.metrics : DEFAULT_METRICS).map((m) => ({
    ...m, startText: m.start === null ? '' : String(m.start), endText: m.end === null ? '' : String(m.end),
  })));

  const metrics: Metric[] = rows.map(({ startText, endText, ...m }) => ({ ...m, start: toNum(startText), end: toNum(endText) }));
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className={k.account}>
      <div className={k.accountHead}>
        <label>
          <span className={p.label}>Platform</span>
          <select className={p.select} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Choose…</option>
            {PLATFORMS.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
          </select>
        </label>
        <label>
          <span className={p.label}>Handle</span>
          <input className={p.input} value={handle} placeholder="@theirbusiness" onChange={(e) => setHandle(e.target.value)} />
        </label>
        <button type="button" className={k.iconBtn} aria-label="Remove this account" onClick={() => { if (window.confirm('Remove this account and its stats?')) onDelete(); }}>×</button>
      </div>
      <div className={k.dates}>
        <label>
          <span className={p.label}>Starting stats taken</span>
          <input type="date" className={p.input} value={startOn} onChange={(e) => setStartOn(e.target.value)} />
        </label>
        <label>
          <span className={p.label}>Ending stats taken</span>
          <input type="date" className={p.input} value={endOn} onChange={(e) => setEndOn(e.target.value)} />
        </label>
      </div>
      <table className={k.metrics}>
        <thead><tr><th>Stat</th><th>Start</th><th>End</th><th>Change</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const m = metrics[i];
            const g = growth(m);
            return (
              <tr key={i}>
                <td><input className={p.input} value={r.label} aria-label="Stat" onChange={(e) => setRow(i, { label: e.target.value })} /></td>
                <td><input className={p.input} inputMode="decimal" value={r.startText} placeholder={r.unit === '%' ? '%' : '0'} aria-label={`${r.label} at the start`}
                  onChange={(e) => setRow(i, { startText: e.target.value })} onFocus={() => { if (!startOn) setStartOn(today()); }} /></td>
                <td><input className={p.input} inputMode="decimal" value={r.endText} placeholder={r.unit === '%' ? '%' : '0'} aria-label={`${r.label} at the end`}
                  onChange={(e) => setRow(i, { endText: e.target.value })} onFocus={() => { if (!endOn) setEndOn(today()); }} /></td>
                <td className={!g || g.diff === 0 ? k.flat : g.diff > 0 ? k.up : k.down}>{changeText(m)}</td>
                <td><button type="button" className={k.iconBtn} aria-label={`Remove ${r.label}`} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={k.accountActions}>
        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setRows((cur) => [...cur, { key: `custom_${Date.now()}`, label: 'New stat', unit: '', start: null, end: null, startText: '', endText: '' }])}>+ Add a stat</button>
        <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={busy}
          onClick={() => onSave({ platform, handle, metrics, start_captured_on: startOn || null, end_captured_on: endOn || null })}>Save account</button>
      </div>
    </div>
  );
}
