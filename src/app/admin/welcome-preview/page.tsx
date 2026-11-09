'use client';

// Preview the portal welcome a new client sees (src/app/portal/(app)/welcome),
// right here in admin, with the real questionnaires in it. Nothing is saved.
// With ?client=<portal id>&name=… it uses that client's name and their open
// questionnaires (and answers so far); otherwise About You and Website
// Development as a sample.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet } from '../proposals/adminApi';
import { visibleSections, type AnswerValue, type Questionnaire } from '@/lib/questionnaires';
import WelcomeFlow, { type WelcomePreview, type WelcomeQuestionnaire } from '@/app/portal/(app)/welcome/WelcomeFlow';

type ListRow = { id: string; title: string; service_type: string; is_active: boolean };
type Assigned = { id: string; status: string; include_optional_sections: string[] };
type Detail = { assignment: { title: string; include_optional_sections: string[] }; questionnaire: Questionnaire; answers: Record<string, { value: AnswerValue }> };

/** Only what a client would see: no archived parts, optional sections only if switched on. */
const forClient = (q: Questionnaire, optional: string[]): Questionnaire => ({
  ...q,
  sections: visibleSections(q.sections, optional)
    .map((s) => ({ ...s, questions: s.questions.filter((x) => !x.is_archived) }))
    .filter((s) => s.questions.length > 0),
});

async function sampleQuestionnaires(): Promise<WelcomeQuestionnaire[]> {
  const { questionnaires } = await apiGet<{ questionnaires: ListRow[] }>('/api/admin/questionnaires');
  const picks = ['about_you', 'website'].map((t) => questionnaires.find((q) => q.service_type === t && q.is_active)).filter((q): q is ListRow => Boolean(q));
  return Promise.all(picks.map(async (row) => {
    const { questionnaire } = await apiGet<{ questionnaire: Questionnaire }>(`/api/admin/questionnaires/${row.id}`);
    return { id: row.id, title: row.title, questionnaire: forClient(questionnaire, []), answers: {} };
  }));
}

async function clientQuestionnaires(clientId: string): Promise<WelcomeQuestionnaire[]> {
  const { assignments } = await apiGet<{ assignments: Assigned[] }>(`/api/admin/questionnaires/assignments?client=${clientId}`);
  const open = assignments.filter((a) => a.status !== 'submitted');
  return Promise.all(open.map(async (a) => {
    const d = await apiGet<Detail>(`/api/admin/questionnaires/assignments/${a.id}`);
    return {
      id: a.id,
      title: d.assignment.title,
      questionnaire: forClient(d.questionnaire, d.assignment.include_optional_sections),
      answers: Object.fromEntries(Object.entries(d.answers).map(([k, v]) => [k, v.value])),
    };
  }));
}

export default function WelcomePreviewPage() {
  return <Suspense fallback={null}><Preview /></Suspense>;
}

function Preview() {
  const params = useSearchParams();
  const clientId = params.get('client');
  const [name, setName] = useState(params.get('name') ?? 'Maria Lopez');
  const [company, setCompany] = useState(params.get('company') ?? 'Lopez Bakery');
  const [withQs, setWithQs] = useState(true);
  const [questionnaires, setQuestionnaires] = useState<WelcomeQuestionnaire[] | null>(null);
  const [failed, setFailed] = useState('');
  const [run, setRun] = useState(0);

  useEffect(() => {
    (clientId ? clientQuestionnaires(clientId) : sampleQuestionnaires())
      .then(setQuestionnaires)
      .catch((e) => { setFailed(e instanceof Error ? e.message : 'Could not load questionnaires'); setQuestionnaires([]); });
  }, [clientId]);

  const preview: WelcomePreview = { name, company, projects: [], questionnaires: withQs ? questionnaires ?? [] : [] };

  return (
    <div className={`${w.page} ${w.pageWide}`}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Portal Welcome</h1>
          <p className={w.sub}>What a new client sees the first time they open the portal, questionnaires included. Click through it here — nothing is saved.</p>
        </div>
        <div className={w.headActions}>
          {clientId && <Link href={`/admin/clients?client=${clientId}`} className={p.btn}>← Back to client</Link>}
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setRun((n) => n + 1)}>Start over</button>
        </div>
      </div>
      <div className={w.toolbar}>
        <input className={p.input} style={{ maxWidth: 220 }} value={name} onChange={(e) => setName(e.target.value)} aria-label="Client name" placeholder="Client name" />
        <input className={p.input} style={{ maxWidth: 220 }} value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Business name" placeholder="Business name" />
        <div className={w.chips} role="group" aria-label="Questionnaires">
          <button type="button" className={`${w.chip} ${withQs ? w.chipOn : ''}`} onClick={() => { setWithQs(true); setRun((n) => n + 1); }}>With questionnaires</button>
          <button type="button" className={`${w.chip} ${!withQs ? w.chipOn : ''}`} onClick={() => { setWithQs(false); setRun((n) => n + 1); }}>Without</button>
        </div>
        {questionnaires && withQs && (
          <span className={w.muted} style={{ fontSize: 13 }}>
            {questionnaires.length ? questionnaires.map((q) => q.title).join(' + ') : clientId ? 'No open questionnaires for this client' : 'No active questionnaires'}
          </span>
        )}
        {failed && <span style={{ fontSize: 13, color: 'var(--a-danger)' }}>{failed}</span>}
      </div>
      {questionnaires === null
        ? <p className={w.muted}>Loading…</p>
        : <WelcomeFlow key={`${run}-${withQs}-${name}-${company}`} preview={preview} />}
    </div>
  );
}
