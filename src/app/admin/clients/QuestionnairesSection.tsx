'use client';

// A portal client's questionnaires, on the Client tab of the contact panel:
// assign one or more (About You is pre-checked), optionally for a project,
// switching on any optional sections for this client; then each assignment's
// status and progress, with Remind, Responses, Reopen and Remove.
// Server: /api/admin/questionnaires/assignments (questionnaireRepo.ts).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { lastRemindedLabel } from '../ReminderDialog';
import type { ReminderTarget } from '@/lib/reminders';
import { STATUS_LABELS, SERVICE_TYPES, type AssignmentStatus, type ServiceType } from '@/lib/questionnaires';

type Optional = { id: string; title: string; label: string };
type Available = { id: string; slug: string; title: string; service_type: ServiceType; is_active: boolean; questions: number; optional: Optional[] };
type Assigned = {
  id: string; questionnaire_id: string; title: string; status: AssignmentStatus; project_id: string | null; project_name: string | null;
  include_optional_sections: string[]; optional: Optional[]; answered: number; total: number;
  assigned_at: string; submitted_at: string | null;
};

const FONT = 'var(--a-font)';
const STATUS_COLOR: Record<AssignmentStatus, { bg: string; fg: string }> = {
  not_started: { bg: '#f1f0ef', fg: '#4a4a4a' },
  in_progress: { bg: '#fff3e8', fg: '#a14000' },
  reopened: { bg: '#fff0f8', fg: '#b0005f' },
  submitted: { bg: '#e6fff0', fg: '#0a7a3a' },
};

export default function QuestionnairesSection({ clientId, projects, reminders, remind }: {
  clientId: string;
  projects: { id: string; name: string }[];
  reminders?: { target_type: string; target_id: string | null; created_at: string }[];
  remind: (target: ReminderTarget, title: string) => void;
}) {
  const [assigned, setAssigned] = useState<Assigned[] | null>(null);
  const [available, setAvailable] = useState<Available[]>([]);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Record<string, string[]>>({}); // questionnaire id → optional sections on
  const [projectId, setProjectId] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let off = false;
    Promise.all([
      apiGet<{ assignments: Assigned[] }>(`/api/admin/questionnaires/assignments?client=${clientId}`),
      apiGet<{ questionnaires: Available[] }>('/api/admin/questionnaires'),
    ]).then(([a, q]) => {
      if (off) return;
      setAssigned(a.assignments);
      setAvailable(q.questionnaires.filter((x) => x.is_active));
    }).catch((e) => {
      if (off) return;
      setAssigned([]);
      setMsg({ text: e instanceof Error ? e.message : 'Could not load questionnaires (has migration 046 been run?)', tone: 'error' });
    });
    return () => { off = true; };
  }, [clientId, tick]);

  function startPicking() {
    // About You is pre-checked for every new assignment.
    const about = available.find((x) => x.service_type === 'about_you');
    setPicked(about ? { [about.id]: [] } : {});
    setProjectId('');
    setNotify(true);
    setPicking(true);
    setMsg(null);
  }

  const toggle = (id: string) => setPicked((cur) => {
    const next = { ...cur };
    if (id in next) delete next[id]; else next[id] = [];
    return next;
  });
  const toggleOptional = (qid: string, sid: string) => setPicked((cur) => ({
    ...cur, [qid]: cur[qid]?.includes(sid) ? cur[qid].filter((x) => x !== sid) : [...(cur[qid] ?? []), sid],
  }));

  async function assign() {
    const items = Object.entries(picked).map(([questionnaireId, optional]) => ({ questionnaireId, optional }));
    if (!items.length) return;
    setBusy('assign');
    try {
      const r = await apiSend<{ notified: string | null }>('/api/admin/questionnaires/assignments', 'POST', { clientId, projectId: projectId || null, items, notify });
      setPicking(false);
      setMsg({ text: `Assigned ${items.length} questionnaire${items.length === 1 ? '' : 's'}.${r.notified ? ` ${r.notified}.` : ''}`, tone: 'ok' });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not assign', tone: 'error' });
    }
    setBusy('');
  }

  async function setOptional(a: Assigned, sid: string, on: boolean) {
    const sections = on ? [...a.include_optional_sections, sid] : a.include_optional_sections.filter((x) => x !== sid);
    setAssigned((cur) => cur?.map((x) => (x.id === a.id ? { ...x, include_optional_sections: sections } : x)) ?? cur);
    try { await apiSend(`/api/admin/questionnaires/assignments/${a.id}`, 'PATCH', { action: 'optional', sections }); await load(); }
    catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not update', tone: 'error' }); load(); }
  }

  async function reopen(a: Assigned) {
    if (!window.confirm(`Reopen “${a.title}” so the client can change their answers?`)) return;
    setBusy(a.id);
    try { await apiSend(`/api/admin/questionnaires/assignments/${a.id}`, 'PATCH', { action: 'reopen' }); setMsg({ text: `Reopened “${a.title}”.`, tone: 'ok' }); await load(); }
    catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not reopen', tone: 'error' }); }
    setBusy('');
  }

  async function remove(a: Assigned) {
    const warn = a.answered ? ` Their ${a.answered} answer${a.answered === 1 ? '' : 's'} and any uploaded files will be deleted.` : '';
    if (!window.confirm(`Remove “${a.title}” from this client?${warn} This can’t be undone.`)) return;
    setBusy(a.id);
    try { await apiSend(`/api/admin/questionnaires/assignments/${a.id}`, 'DELETE'); await load(); }
    catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not remove', tone: 'error' }); }
    setBusy('');
  }

  const box: React.CSSProperties = { border: '1px solid var(--a-border)', borderRadius: 10, padding: '12px 14px' };
  const small: React.CSSProperties = { fontFamily: FONT, fontSize: 12, color: 'var(--a-muted)' };

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 4px' }}>Questionnaires</h3>
          {assigned && assigned.length > 0 && <div style={small}>{assigned.filter((a) => a.status === 'submitted').length} of {assigned.length} submitted</div>}
        </div>
        {!picking && <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={startPicking} disabled={!assigned}>+ Assign</button>}
      </div>

      {msg && <p style={{ fontSize: 13, margin: '0 0 10px', color: msg.tone === 'error' ? 'var(--a-danger)' : '#1a8a4a' }}>{msg.text}</p>}

      {picking && (
        <div style={{ ...box, background: 'var(--a-surface-2)', marginBottom: 12, display: 'grid', gap: 10 }}>
          {available.length === 0 && <p style={small}>No active questionnaires. Create one under Clients → Questionnaires.</p>}
          {available.map((q) => {
            const on = q.id in picked;
            return (
              <div key={q.id}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(q.id)} />
                  {q.title} <span style={small}>· {SERVICE_TYPES[q.service_type]} · {q.questions} questions</span>
                </label>
                {on && q.optional.map((sec) => (
                  <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 0 26px', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={picked[q.id]?.includes(sec.id) ?? false} onChange={() => toggleOptional(q.id, sec.id)} />
                    Include {sec.label || sec.title}
                  </label>
                ))}
              </div>
            );
          })}
          {projects.length > 0 && (
            <label style={{ display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 600 }}>
              For project (optional)
              <select className={p.select} value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 320 }}>
                <option value="">No specific project</option>
                {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </select>
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Email the client that it’s ready (and text them if they’ve opted in)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!Object.keys(picked).length || busy === 'assign'} onClick={assign}>{busy === 'assign' ? 'Assigning…' : `Assign ${Object.keys(picked).length || ''}`}</button>
            <button type="button" className={p.btn} onClick={() => setPicking(false)}>Cancel</button>
          </div>
        </div>
      )}

      {assigned === null && <p style={small}>Loading…</p>}
      {assigned && assigned.length === 0 && !picking && <p style={{ fontSize: 14, color: '#bfbfbf', margin: 0 }}>None assigned yet.</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {assigned?.map((a) => {
          const pct = a.total ? Math.round((a.answered / a.total) * 100) : 0;
          const c = STATUS_COLOR[a.status];
          const reminded = a.status !== 'submitted' ? lastRemindedLabel(reminders, 'questionnaire', a.id) : null;
          return (
            <div key={a.id} style={box}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>{a.title}</strong>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.fg }}>{STATUS_LABELS[a.status]}</span>
                <span style={small}>{a.answered} of {a.total} answered{a.project_name ? ` · ${a.project_name}` : ''}{reminded ? ` · ${reminded}` : ''}</span>
              </div>
              <div style={{ background: '#f0f0f0', borderRadius: 999, height: 5, margin: '8px 0' }}>
                <div style={{ height: 5, borderRadius: 999, background: '#0cf574', width: `${pct}%` }} />
              </div>
              {a.optional.map((sec) => (
                <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, margin: '0 0 6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={a.include_optional_sections.includes(sec.id)} onChange={(e) => setOptional(a, sec.id, e.target.checked)} />
                  Include {sec.label || sec.title}
                </label>
              ))}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Link href={`/admin/questionnaires/responses/${a.id}`} className={`${p.btn} ${p.btnSmall}`}>{a.status === 'submitted' ? 'Responses' : 'View answers'}</Link>
                {a.status !== 'submitted' && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => remind({ kind: 'questionnaire', id: a.id }, `Remind about ${a.title}`)}>Remind</button>}
                {a.status === 'submitted' && <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy === a.id} onClick={() => reopen(a)}>Reopen</button>}
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} disabled={busy === a.id} onClick={() => remove(a)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
