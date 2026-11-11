'use client';

// A client's questionnaire: one section at a time (Back/Next, or jump from the
// section list), answers saved as they type, required questions checked
// before submitting, then read-only until Thrive reopens it.
// Server: /api/portal/questionnaires/[id] (src/lib/questionnaireRepo.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabasePortal } from '@/lib/supabasePortal';
import { portalApi, PortalApiError } from '@/lib/portalApi';
import {
  MAX_UPLOAD_BYTES, STATUS_LABELS, isAnswered, isEditable, missingRequired, progressOf,
  type AnswerValue, type AssignmentStatus, type Question, type Questionnaire,
} from '@/lib/questionnaires';
import QuestionField from '@/components/questionnaire/QuestionField';
import s from '@/components/questionnaire/questionnaire.module.css';
import { portalTrack } from '@/lib/portalTrack';

type Assignment = { id: string; title: string; status: AssignmentStatus; include_optional_sections: string[]; project_name: string | null };
type Detail = { assignment: Assignment; questionnaire: Questionnaire; answers: Record<string, AnswerValue> };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const TEXT_DELAY = 800;

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [section, setSection] = useState(0);
  const [save, setSave] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, AnswerValue>());
  const inFlight = useRef(0);

  const load = useCallback(async () => {
    try {
      const d = await portalApi<Detail>(`/api/portal/questionnaires/${id}`);
      setDetail(d);
      setAnswers(d.answers);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load this questionnaire');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // On phones the section list scrolls sideways: keep the current one in view.
  useEffect(() => {
    document.querySelector('[aria-current="step"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [section]);

  // Send one answer now.
  const send = useCallback(async (questionId: string, value: AnswerValue) => {
    inFlight.current++;
    setSave('saving');
    try {
      await portalApi(`/api/portal/questionnaires/${id}`, { body: { action: 'answer', questionId, value } });
      setSaveError('');
      if (--inFlight.current === 0 && pending.current.size === 0) setSave('saved');
    } catch (e) {
      inFlight.current--;
      setSave('error');
      setSaveError(e instanceof Error ? e.message : 'Not saved');
    }
  }, [id]);

  const flush = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    const all = [...pending.current.entries()];
    pending.current.clear();
    return Promise.all(all.map(([q, v]) => send(q, v)));
  }, [send]);

  // Leaving the page with unsaved typing: save it and warn.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current.size || inFlight.current) { flush(); e.preventDefault(); }
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); flush(); };
  }, [flush]);

  function change(q: Question, value: AnswerValue, typed: boolean) {
    setAnswers((a) => ({ ...a, [q.id]: value }));
    setMissing((m) => (isAnswered(value) ? m.filter((x) => x !== q.id) : m));
    const prev = timers.current.get(q.id);
    if (prev) clearTimeout(prev);
    if (!typed) { pending.current.delete(q.id); send(q.id, value); return; }
    pending.current.set(q.id, value);
    setSave('saving');
    timers.current.set(q.id, setTimeout(() => {
      timers.current.delete(q.id);
      const v = pending.current.get(q.id);
      pending.current.delete(q.id);
      send(q.id, v ?? null);
    }, TEXT_DELAY));
  }

  async function upload(q: Question, list: FileList | null) {
    if (!list?.length) return;
    setUploading(q.id);
    setSaveError('');
    try {
      for (const file of Array.from(list)) {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is over 10 MB.`);
        const meta = { name: file.name, size: file.size, type: file.type || 'application/octet-stream' };
        const { upload: u } = await portalApi<{ upload: { path: string; token: string; bucket: string } }>(
          `/api/portal/questionnaires/${id}`, { body: { action: 'upload_url', questionId: q.id, file: meta } });
        const { error } = await supabasePortal.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, file, { contentType: meta.type });
        if (error) throw new Error(`${file.name} didn’t upload. Try again.`);
        await portalApi(`/api/portal/questionnaires/${id}`, { body: { action: 'attach', questionId: q.id, file: { ...meta, path: u.path } } });
      }
      await load();
      setSave('saved');
    } catch (e) {
      setSave('error');
      setSaveError(e instanceof Error ? e.message : 'Upload failed');
    }
    setUploading(null);
  }

  async function removeUpload(q: Question, path: string) {
    setUploading(q.id);
    try {
      await portalApi(`/api/portal/questionnaires/${id}`, { body: { action: 'remove_file', questionId: q.id, path } });
      await load();
    } catch (e) {
      setSave('error');
      setSaveError(e instanceof Error ? e.message : 'Could not remove that file');
    }
    setUploading(null);
  }

  if (loadError) return <div className={s.wrap}><p className={s.err}>{loadError}</p><Link href="/portal/onboarding" className={s.btn} style={{ alignSelf: 'start', textDecoration: 'none' }}>← All questionnaires</Link></div>;
  if (!detail) return <div className={s.wrap}><p className={s.muted}>Loading…</p></div>;

  const { questionnaire: qn, assignment } = detail;
  const sections = qn.sections;
  const editable = isEditable(assignment.status) && !justSubmitted;
  const optional = assignment.include_optional_sections;
  const progress = progressOf(sections, optional, answers);
  const pct = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;
  const current = sections[Math.min(section, sections.length - 1)];
  const last = section >= sections.length - 1;
  const missingIn = (sec: typeof current) => sec.questions.filter((q) => missing.includes(q.id)).length;

  function go(i: number) {
    flush();
    setSection(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function trySubmit() {
    await flush();
    const left = missingRequired(sections, optional, answers);
    if (left.length) {
      setMissing(left);
      const first = sections.findIndex((sec) => sec.questions.some((q) => left.includes(q.id)));
      if (first >= 0) go(first);
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    setSubmitting(true);
    try {
      await portalApi(`/api/portal/questionnaires/${id}`, { body: { action: 'submit' } });
      void portalTrack('action', { label: 'Submitted a questionnaire' });
      setConfirming(false);
      setJustSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setConfirming(false);
      if (e instanceof PortalApiError && Array.isArray(e.body.missing)) setMissing(e.body.missing as string[]);
      setSave('error');
      setSaveError(e instanceof Error ? e.message : 'Could not submit');
    }
    setSubmitting(false);
  }

  if (justSubmitted) {
    return (
      <div className={s.wrap}>
        <div className={`${s.card} ${s.thanks}`}>
          <h2 className={s.h2}>Thank You!</h2>
          <p className={s.muted} style={{ fontSize: 15, maxWidth: 440, margin: '8px auto 20px' }}>
            Your {qn.title} answers are in. We’ll read through them and reach out with any questions. Need to change something? Let us know and we’ll reopen it for you.
          </p>
          <Link href="/portal/onboarding" className={`${s.btn} ${s.btnDark}`} style={{ display: 'inline-block', textDecoration: 'none' }}>Back to onboarding</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.top}>
          <div>
            <Link href="/portal/onboarding" className={s.muted} style={{ textDecoration: 'none' }}>← Onboarding</Link>
            <h1 className={s.h2} style={{ marginTop: 6 }}>{qn.title}</h1>
            {qn.description && <p className={s.muted}>{qn.description}</p>}
          </div>
          {editable
            ? <span className={`${s.saveState} ${save === 'saving' ? s.saving : ''} ${save === 'error' ? s.saveError : ''}`} aria-live="polite">
                {save === 'saving' ? 'Saving…' : save === 'error' ? (saveError || 'Not saved') : save === 'saved' ? 'Saved' : 'Saves as you type'}
              </span>
            : <span className={`${s.pill} ${s.pill_submitted}`}>{STATUS_LABELS.submitted}</span>}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            <span>{progress.answered} of {progress.total} answered</span><span>{pct}%</span>
          </div>
          <div className={s.bar}><div className={s.barFill} style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      {!editable && <p className={s.lockNote}>You’ve submitted this questionnaire, so your answers are locked. Need to change something? Message us and we’ll reopen it.</p>}
      {assignment.status === 'reopened' && editable && <p className={s.lockNote} style={{ background: '#f5f5f5', borderColor: '#e50586' }}>We’ve reopened this so you can make changes. Submit again when you’re done.</p>}

      <div className={s.layout}>
        <nav className={s.side} aria-label="Sections">
          <ul className={s.secList}>
            {sections.map((sec, i) => {
              const p = progressOf([sec], optional, answers);
              const miss = missingIn(sec);
              return (
                <li key={sec.id}>
                  <button type="button" className={`${s.secBtn} ${i === section ? s.secOn : ''}`} onClick={() => go(i)} aria-current={i === section ? 'step' : undefined}>
                    <span>{sec.title}</span>
                    <span className={`${s.secCount} ${miss ? s.secMissing : ''}`}>{miss ? `${miss} needed` : `${p.answered}/${p.total}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section>
          <div className={s.card}>
            <p className={s.muted} style={{ marginBottom: 4 }}>Section {section + 1} of {sections.length}</p>
            <h2 className={s.secHead}>{current.title}</h2>
            {current.description && <p className={s.muted}>{current.description}</p>}
          </div>
          <div className={s.questions}>
            {current.questions.map((q) => (
              <QuestionField key={q.id} q={q} value={answers[q.id] ?? null} disabled={!editable} missing={missing.includes(q.id)}
                uploading={uploading === q.id} onChange={(v, typed) => change(q, v, typed)}
                onUpload={(files) => upload(q, files)} onRemove={(path) => removeUpload(q, path)} />
            ))}
          </div>
          <div className={s.nav}>
            <button type="button" className={s.btn} disabled={section === 0} onClick={() => go(section - 1)}>← Back</button>
            {!last && <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(section + 1)}>Next →</button>}
            {last && editable && <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={trySubmit}>Submit</button>}
          </div>
          {missing.length > 0 && <p className={s.missingNote} role="alert">{missing.length} required question{missing.length === 1 ? '' : 's'} still need{missing.length === 1 ? 's' : ''} an answer — they’re marked in pink.</p>}
        </section>
      </div>

      {confirming && (
        <div className={s.confirm} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className={s.confirmBox}>
            <h2 id="confirm-title" className={s.h2}>Submit Your Answers?</h2>
            <p className={s.muted} style={{ fontSize: 14, margin: '8px 0 18px' }}>
              You’ve answered {progress.answered} of {progress.total} questions. After you submit, your answers are locked unless we reopen them for you.
            </p>
            <div className={s.nav} style={{ marginTop: 0 }}>
              <button type="button" className={s.btn} onClick={() => setConfirming(false)} disabled={submitting}>Keep editing</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
