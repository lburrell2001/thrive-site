'use client';

// Clients → Questionnaires: every questionnaire, with its service, number of
// questions and an active switch (inactive ones can't be assigned). Create,
// edit, duplicate, delete — a questionnaire a client already has is archived
// instead, so their answers stay. Assign them from a client's Client tab.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { SERVICE_TYPES, type ServiceType } from '@/lib/questionnaires';
import q from './questionnaires.module.css';

type Row = {
  id: string; title: string; description: string; service_type: ServiceType; is_active: boolean;
  sections: number; questions: number; assigned: number; waiting: number;
};

export default function QuestionnairesAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [service, setService] = useState<ServiceType>('custom');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');

  const load = () => apiGet<{ questionnaires: Row[] }>('/api/admin/questionnaires')
    .then((d) => setRows(d.questionnaires))
    .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) return;
    setBusy('create');
    try {
      const { id } = await apiSend<{ id: string }>('/api/admin/questionnaires', 'POST', { action: 'create', title: title.trim(), service_type: service });
      router.push(`/admin/questionnaires/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create'); setBusy(''); }
  }

  async function duplicate(r: Row) {
    setBusy(r.id);
    try {
      const { id } = await apiSend<{ id: string }>('/api/admin/questionnaires', 'POST', { action: 'duplicate', id: r.id });
      router.push(`/admin/questionnaires/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not duplicate'); setBusy(''); }
  }

  async function toggle(r: Row) {
    setRows((cur) => cur?.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x)) ?? cur);
    try { await apiSend(`/api/admin/questionnaires/${r.id}`, 'PATCH', { is_active: !r.is_active }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update'); load(); }
  }

  async function remove(r: Row) {
    const msg = r.assigned
      ? `“${r.title}” has been assigned to ${r.assigned} client${r.assigned === 1 ? '' : 's'}. It will be archived: hidden here and from new assignments, but their answers stay. Continue?`
      : `Delete “${r.title}” and all its questions? This can’t be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(r.id);
    try {
      const { result } = await apiSend<{ result: 'deleted' | 'archived' }>(`/api/admin/questionnaires/${r.id}`, 'DELETE');
      setToast(result === 'archived' ? `Archived “${r.title}”.` : `Deleted “${r.title}”.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete'); }
    setBusy('');
  }

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Questionnaires</h1>
          <p className={w.sub}>Onboarding questionnaires clients fill out in their portal. Assign them from a client’s Client tab.</p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setCreating((v) => !v)}>New questionnaire</button>
        </div>
      </div>
      {error && <p className={q.error}>{error}</p>}
      {toast && <p className={q.ok}>{toast}</p>}

      {creating && (
        <div className={w.card} style={{ padding: 16, marginBottom: 16 }}>
          <div className={q.createRow}>
            <label className={q.grow}>
              <span className={p.label}>Title</span>
              <input className={p.input} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="e.g. Event Branding" />
            </label>
            <label>
              <span className={p.label}>Service</span>
              <select className={p.select} value={service} onChange={(e) => setService(e.target.value as ServiceType)}>
                {Object.entries(SERVICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!title.trim() || busy === 'create'} onClick={create}>{busy === 'create' ? 'Creating…' : 'Create and edit'}</button>
          </div>
        </div>
      )}

      {!rows && !error && <p className={w.muted}>Loading…</p>}
      {rows && rows.length === 0 && <div className={w.empty}>No questionnaires yet. Run migration 046 to add the starter set, or create one.</div>}
      {rows && rows.length > 0 && (
        <div className={w.table}>
          <div className={`${w.row} ${w.rowHead} ${q.cols}`}>
            <span>Questionnaire</span><span>Service</span><span>Questions</span><span>Clients</span><span>Active</span><span />
          </div>
          {rows.map((r) => (
            <div key={r.id} className={`${w.row} ${q.cols}`}>
              <Link href={`/admin/questionnaires/${r.id}`} className={q.titleLink}>
                <strong>{r.title}</strong>
                {r.description && <span className={w.muted}>{r.description}</span>}
              </Link>
              <span>{SERVICE_TYPES[r.service_type]}</span>
              <span>{r.questions} <span className={w.muted}>· {r.sections} section{r.sections === 1 ? '' : 's'}</span></span>
              <span>{r.assigned ? <>{r.assigned}{r.waiting ? <span className={w.muted}> · {r.waiting} waiting</span> : null}</> : <span className={w.muted}>—</span>}</span>
              <span>
                <button type="button" role="switch" aria-checked={r.is_active} aria-label={`${r.title} active`} className={`${q.switch} ${r.is_active ? q.switchOn : ''}`} onClick={() => toggle(r)}><span /></button>
              </span>
              <span className={q.actions}>
                <Link href={`/admin/questionnaires/${r.id}`} className={`${p.btn} ${p.btnSmall}`}>Edit</Link>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy === r.id} onClick={() => duplicate(r)}>Duplicate</button>
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} disabled={busy === r.id} onClick={() => remove(r)}>{r.assigned ? 'Archive' : 'Delete'}</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
