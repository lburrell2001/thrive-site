'use client';

// One client's questionnaire answers, grouped by section, with the question
// text they actually saw (a note shows when it's been edited since). Reopen
// for edits, export a PDF, copy everything as plain text.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import p from '../../../proposals/proposals.module.css';
import w from '../../../crm/workspace.module.css';
import { apiGet, apiSend } from '../../../proposals/adminApi';
import {
  STATUS_LABELS, SERVICE_TYPES, answerText, isAnswered, responsesText,
  type AnswerValue, type AssignmentStatus, type Questionnaire, type UploadedFile,
} from '@/lib/questionnaires';
import q from '../../questionnaires.module.css';

type Detail = {
  assignment: {
    id: string; client_id: string; title: string; status: AssignmentStatus; project_name: string | null;
    assigned_at: string; submitted_at: string | null; reopened_at: string | null; answered: number; total: number;
    include_optional_sections: string[];
  };
  questionnaire: Questionnaire;
  answers: Record<string, { value: AnswerValue; snapshot: string; updated_at: string }>;
  client: { name: string; company: string; crm_contact_id: string | null };
};

const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) : '—');

export default function QuestionnaireResponses() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => apiGet<Detail>(`/api/admin/questionnaires/assignments/${id}`).then(setD).catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <div className={w.page}><p className={error ? q.error : w.muted}>{error || 'Loading…'}</p></div>;

  const who = d.client.company || d.client.name || 'Client';
  const clientLine = d.client.company && d.client.name ? `${d.client.name} · ${d.client.company}` : who;
  const turnedOn = new Set(d.assignment.include_optional_sections);
  const text = () => responsesText(d.questionnaire, d.answers, `${d.questionnaire.title} — ${clientLine}\n${SERVICE_TYPES[d.questionnaire.service_type]} · ${d.assignment.answered} of ${d.assignment.total} answered`);

  async function reopen() {
    if (!window.confirm(`Reopen “${d!.questionnaire.title}” so ${who} can change their answers? They’ll need to submit again.`)) return;
    setBusy(true);
    try { await apiSend(`/api/admin/questionnaires/assignments/${id}`, 'PATCH', { action: 'reopen' }); setToast('Reopened. The client can edit and submit again.'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not reopen'); }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text()); setToast('Copied all answers as plain text.'); }
    catch { setError('Could not copy — your browser blocked the clipboard.'); }
  }

  async function pdf() {
    setBusy(true);
    try {
      const { generateQuestionnairePDF } = await import('@/lib/questionnairePDF');
      await generateQuestionnairePDF({
        questionnaire: d!.questionnaire, answers: d!.answers, clientName: clientLine, status: d!.assignment.status,
        submittedAt: d!.assignment.submitted_at, answered: d!.assignment.answered, total: d!.assignment.total,
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not make the PDF'); }
    setBusy(false);
  }

  const status = d.assignment.status;
  return (
    <div className={w.page}>
      <Link href={`/admin/clients?client=${d.assignment.client_id}`} className={w.muted} style={{ fontSize: 13, textDecoration: 'none' }}>← {who}</Link>
      <div className={q.respHead} style={{ marginTop: 6 }}>
        <div>
          <h1 className={w.title} style={{ margin: 0 }}>{d.questionnaire.title}</h1>
          <p className={w.sub}>
            {clientLine}{d.assignment.project_name ? ` · ${d.assignment.project_name}` : ''} · {d.assignment.answered} of {d.assignment.total} answered
          </p>
          <p className={w.muted} style={{ fontSize: 13, margin: '4px 0 0' }}>
            <span className={w.pill}>{STATUS_LABELS[status]}</span>{' '}
            Assigned {when(d.assignment.assigned_at)}
            {d.assignment.submitted_at && <> · Submitted {when(d.assignment.submitted_at)}</>}
            {d.assignment.reopened_at && <> · Reopened {when(d.assignment.reopened_at)}</>}
          </p>
        </div>
        <div className={w.headActions}>
          {status === 'submitted' && <button type="button" className={p.btn} disabled={busy} onClick={reopen}>Reopen for edits</button>}
          <button type="button" className={p.btn} onClick={copy}>Copy as text</button>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={busy} onClick={pdf}>Export PDF</button>
        </div>
      </div>
      {error && <p className={q.error}>{error}</p>}
      {toast && <p className={q.ok}>{toast}</p>}

      {d.questionnaire.sections.map((s) => {
        const off = s.is_optional && !turnedOn.has(s.id);
        return (
          <section key={s.id} className={`${w.card} ${q.respSection}`} style={{ padding: 16, opacity: off ? 0.6 : 1 }}>
            <h2>
              {s.title}
              {s.is_optional && <span className={q.archivedTag}>{off ? 'Optional · off for this client' : 'Optional · on'}</span>}
              {s.is_archived && <span className={q.archivedTag}>Removed section</span>}
            </h2>
            {s.questions.map((x) => {
              const a = d.answers[x.id];
              const edited = a && a.snapshot && a.snapshot !== x.prompt;
              const files = Array.isArray(a?.value) && a!.value.length && typeof a!.value[0] === 'object' ? (a!.value as UploadedFile[]) : null;
              return (
                <div key={x.id} className={q.answer}>
                  <p className={q.answerQ}>
                    {a?.snapshot || x.prompt}
                    {x.is_required && <span className={q.reqDot}> *</span>}
                    {x.is_archived && <span className={q.archivedTag}>Removed question</span>}
                  </p>
                  {files
                    ? <ul className={q.files}>{files.map((f) => <li key={f.path}><a href={f.url} target="_blank" rel="noreferrer">{f.name}</a></li>)}</ul>
                    : <p className={`${q.answerA} ${isAnswered(a?.value) ? '' : q.answerBlank}`}>{answerText(a?.value)}</p>}
                  {edited && <span className={q.edited}>You’ve edited this question since they answered. It now reads: “{x.prompt}”</span>}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
