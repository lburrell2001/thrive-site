'use client';

// The questionnaire editor: details, then sections and their questions.
// Drag (or ↑/↓) to reorder sections and questions, drag a question into
// another section or use "Move to"; options for choice questions are added,
// removed and reordered inline. The right side previews what the client sees.
// Nothing is stored until Save; the server then deletes what was removed, or
// archives it if a client has already answered it (questionnaireRepo.ts).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import p from '../../proposals/proposals.module.css';
import w from '../../crm/workspace.module.css';
import { apiGet, apiSend } from '../../proposals/adminApi';
import QuestionField from '@/components/questionnaire/QuestionField';
import qs from '@/components/questionnaire/questionnaire.module.css';
import {
  QUESTION_TYPES, SERVICE_TYPES, isChoice,
  type AnswerValue, type Question, type Questionnaire, type QuestionType, type ServiceType,
} from '@/lib/questionnaires';
import q from '../questionnaires.module.css';

type EQ = Omit<Question, 'id' | 'sort_order'> & { id: string; isNew?: boolean };
type ES = { id: string; isNew?: boolean; title: string; description: string; is_optional: boolean; optional_label: string; questions: EQ[] };
type Draft = { title: string; description: string; service_type: ServiceType; is_active: boolean; sections: ES[] };
type DragItem = { kind: 'section'; si: number } | { kind: 'question'; si: number; qi: number };

let seq = 0;
const tempId = () => `new-${Date.now().toString(36)}-${seq++}`;

function toDraft(qn: Questionnaire): Draft {
  return {
    title: qn.title, description: qn.description, service_type: qn.service_type, is_active: qn.is_active,
    sections: qn.sections.map((s) => ({
      id: s.id, title: s.title, description: s.description, is_optional: s.is_optional, optional_label: s.optional_label,
      questions: s.questions.map((x) => ({ id: x.id, prompt: x.prompt, help_text: x.help_text, type: x.type, options: x.options, is_required: x.is_required })),
    })),
  };
}

function toPayload(d: Draft) {
  return {
    ...d,
    sections: d.sections.map((s) => ({
      id: s.isNew ? null : s.id, title: s.title, description: s.description, is_optional: s.is_optional, optional_label: s.optional_label,
      questions: s.questions.map((x) => ({
        id: x.isNew ? null : x.id, prompt: x.prompt, help_text: x.help_text, type: x.type,
        options: isChoice(x.type) ? x.options.map((o) => o.trim()).filter(Boolean) : [], is_required: x.is_required,
      })),
    })),
  };
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
};

export default function QuestionnaireEditor() {
  const { id } = useParams<{ id: string }>();
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [previewSection, setPreviewSection] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, AnswerValue>>({});
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    apiGet<{ questionnaire: Questionnaire }>(`/api/admin/questionnaires/${id}`)
      .then((d) => { const dr = toDraft(d.questionnaire); setSaved(dr); setDraft(dr); })
      .catch((e) => setFailed(e instanceof Error ? e.message : 'Could not load'));
  }, [id]);

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!draft) return <div className={w.page}><p className={w.muted}>{failed || 'Loading…'}</p></div>;

  const set = (fn: (d: Draft) => Draft) => { setDraft((d) => (d ? fn(d) : d)); setNote(null); };
  const setSection = (si: number, patch: Partial<ES>) => set((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const setQuestion = (si: number, qi: number, patch: Partial<EQ>) =>
    set((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, questions: s.questions.map((x, k) => (k === qi ? { ...x, ...patch } : x)) } : s)) }));

  function addSection() {
    const s: ES = { id: tempId(), isNew: true, title: 'New section', description: '', is_optional: false, optional_label: '', questions: [] };
    set((d) => ({ ...d, sections: [...d.sections, s] }));
    setPreviewSection(draft!.sections.length);
  }

  function removeSection(si: number) {
    const s = draft!.sections[si];
    if (draft!.sections.length <= 1) { setNote({ text: 'Keep at least one section.', tone: 'error' }); return; }
    if (!window.confirm(`Delete the section “${s.title}” and its ${s.questions.length} question${s.questions.length === 1 ? '' : 's'}? Questions clients have already answered are archived, so their answers stay. This happens when you save.`)) return;
    set((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }));
    setPreviewSection(0);
  }

  function addQuestion(si: number) {
    const x: EQ = { id: tempId(), isNew: true, prompt: '', help_text: '', type: 'long_text', options: [], is_required: false };
    setSection(si, { questions: [...draft!.sections[si].questions, x] });
    setOpen(x.id);
    setPreviewSection(si);
  }

  function removeQuestion(si: number, qi: number) {
    const x = draft!.sections[si].questions[qi];
    if (!window.confirm(`Delete “${x.prompt || 'this question'}”? If a client has answered it, it’s archived instead so their answer stays. This happens when you save.`)) return;
    setSection(si, { questions: draft!.sections[si].questions.filter((_, k) => k !== qi) });
  }

  function moveQuestionTo(si: number, qi: number, toSi: number, toQi?: number) {
    set((d) => {
      const sections = d.sections.map((s) => ({ ...s, questions: [...s.questions] }));
      const [x] = sections[si].questions.splice(qi, 1);
      const target = sections[toSi].questions;
      target.splice(toQi === undefined ? target.length : Math.min(toQi, target.length), 0, x);
      return { ...d, sections };
    });
    setPreviewSection(toSi);
  }

  function dropOnSection(si: number) {
    if (!drag) return;
    if (drag.kind === 'section' && drag.si !== si) set((d) => ({ ...d, sections: move(d.sections, drag.si, si) }));
    if (drag.kind === 'question' && drag.si !== si) moveQuestionTo(drag.si, drag.qi, si);
    setDrag(null); setOver(null);
  }

  function dropOnQuestion(si: number, qi: number) {
    if (!drag || drag.kind !== 'question') return;
    if (drag.si === si) { if (drag.qi !== qi) setSection(si, { questions: move(draft!.sections[si].questions, drag.qi, qi) }); }
    else moveQuestionTo(drag.si, drag.qi, si, qi);
    setDrag(null); setOver(null);
  }

  async function save() {
    const blank = draft!.sections.flatMap((s) => s.questions).find((x) => !x.prompt.trim());
    if (blank) { setOpen(blank.id); setNote({ text: 'Every question needs a prompt.', tone: 'error' }); return; }
    setSaving(true); setNote(null);
    try {
      const r = await apiSend<{ questionnaire: Questionnaire }>(`/api/admin/questionnaires/${id}`, 'PUT', toPayload(draft!));
      const dr = toDraft(r.questionnaire);
      setSaved(dr); setDraft(dr); setOpen(null);
      setNote({ text: 'Saved. New and reopened questionnaires use this version.', tone: 'ok' });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'Could not save', tone: 'error' });
    }
    setSaving(false);
  }

  const pv = draft.sections[Math.min(previewSection, draft.sections.length - 1)];

  return (
    <div className={`${w.page} ${w.pageWide}`}>
      <div className={q.bar}>
        <div>
          <Link href="/admin/questionnaires" className={w.muted} style={{ fontSize: 13, textDecoration: 'none' }}>← Questionnaires</Link>
          <h1 className={w.title} style={{ margin: '4px 0 0' }}>{draft.title || 'Untitled'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`${q.saveNote} ${dirty ? q.dirty : ''}`} aria-live="polite">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {note && <p className={note.tone === 'error' ? q.error : q.ok} role={note.tone === 'error' ? 'alert' : undefined}>{note.text}</p>}

      <div className={q.editor}>
        <div>
          <div className={w.card} style={{ padding: 16, marginBottom: 14 }}>
            <div className={q.meta}>
              <label><span className={p.label}>Title</span><input className={p.input} value={draft.title} onChange={(e) => set((d) => ({ ...d, title: e.target.value }))} /></label>
              <label><span className={p.label}>Service</span>
                <select className={p.select} value={draft.service_type} onChange={(e) => set((d) => ({ ...d, service_type: e.target.value as ServiceType }))}>
                  {Object.entries(SERVICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 10 }}><span className={p.label}>Description (shown to the client)</span>
              <textarea className={p.textarea} rows={2} value={draft.description} onChange={(e) => set((d) => ({ ...d, description: e.target.value }))} />
            </label>
            <label className={q.check} style={{ marginTop: 10 }}>
              <input type="checkbox" checked={draft.is_active} onChange={(e) => set((d) => ({ ...d, is_active: e.target.checked }))} />
              Active (can be assigned to clients)
            </label>
          </div>

          {draft.sections.map((sec, si) => (
            <div key={sec.id} className={`${q.section} ${over === sec.id ? q.sectionDrop : ''}`}
              onDragOver={(e) => { if (drag && (drag.kind === 'section' || drag.si !== si)) { e.preventDefault(); setOver(sec.id); } }}
              onDragLeave={() => setOver((o) => (o === sec.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); dropOnSection(si); }}>
              <div className={q.sectionHead}>
                <span className={q.grip} draggable onDragStart={() => setDrag({ kind: 'section', si })} onDragEnd={() => { setDrag(null); setOver(null); }} title="Drag to reorder" aria-hidden>⠿</span>
                <input className={q.titleInput} value={sec.title} aria-label="Section title" onChange={(e) => setSection(si, { title: e.target.value })} onFocus={() => setPreviewSection(si)} />
                <button type="button" className={q.iconBtn} disabled={si === 0} onClick={() => set((d) => ({ ...d, sections: move(d.sections, si, si - 1) }))} aria-label="Move section up">↑</button>
                <button type="button" className={q.iconBtn} disabled={si === draft.sections.length - 1} onClick={() => set((d) => ({ ...d, sections: move(d.sections, si, si + 1) }))} aria-label="Move section down">↓</button>
                <button type="button" className={`${q.iconBtn} ${q.danger}`} onClick={() => removeSection(si)} aria-label="Delete section">✕</button>
              </div>
              <div className={q.sectionBody}>
                <input className={p.input} placeholder="Description (optional)" value={sec.description} onChange={(e) => setSection(si, { description: e.target.value })} />
                <div className={q.optRow}>
                  <label className={q.check}>
                    <input type="checkbox" checked={sec.is_optional} onChange={(e) => setSection(si, { is_optional: e.target.checked, optional_label: e.target.checked && !sec.optional_label ? `${sec.title} — only if your project includes it` : sec.optional_label })} />
                    Optional (off unless turned on for a client)
                  </label>
                  {sec.is_optional && <input type="text" className={p.input} placeholder="Label, e.g. App Development — only if your project includes an app" value={sec.optional_label} onChange={(e) => setSection(si, { optional_label: e.target.value })} />}
                </div>

                {sec.questions.length === 0 && <div className={q.empty}>No questions yet{drag?.kind === 'question' ? ' — drop one here' : ''}.</div>}
                {sec.questions.map((x, qi) => {
                  const on = open === x.id;
                  return (
                    <div key={x.id} className={`${q.qRow} ${on ? q.qRowOn : ''} ${over === x.id ? q.qDrop : ''}`}
                      onDragOver={(e) => { if (drag?.kind === 'question') { e.preventDefault(); e.stopPropagation(); setOver(x.id); } }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOnQuestion(si, qi); }}>
                      <div className={q.qHead} onClick={() => { setOpen(on ? null : x.id); setPreviewSection(si); }}>
                        <span className={q.grip} draggable onDragStart={(e) => { e.stopPropagation(); setDrag({ kind: 'question', si, qi }); }} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={(e) => e.stopPropagation()} title="Drag to reorder or move to another section" aria-hidden>⠿</span>
                        <span className={q.qPrompt}>{x.prompt || <em className={w.muted}>New question</em>}{x.is_required && <span className={q.reqDot}> *</span>}</span>
                        <span className={q.qType}>{QUESTION_TYPES[x.type]}</span>
                        <button type="button" className={q.iconBtn} disabled={qi === 0} onClick={(e) => { e.stopPropagation(); setSection(si, { questions: move(sec.questions, qi, qi - 1) }); }} aria-label="Move question up">↑</button>
                        <button type="button" className={q.iconBtn} disabled={qi === sec.questions.length - 1} onClick={(e) => { e.stopPropagation(); setSection(si, { questions: move(sec.questions, qi, qi + 1) }); }} aria-label="Move question down">↓</button>
                        <button type="button" className={`${q.iconBtn} ${q.danger}`} onClick={(e) => { e.stopPropagation(); removeQuestion(si, qi); }} aria-label="Delete question">✕</button>
                      </div>
                      {on && (
                        <div className={q.qBody}>
                          <label><span className={p.label}>Question</span>
                            <textarea className={p.textarea} rows={2} value={x.prompt} autoFocus={!x.prompt} onChange={(e) => setQuestion(si, qi, { prompt: e.target.value })} />
                          </label>
                          <label><span className={p.label}>Help text (optional)</span>
                            <input className={p.input} value={x.help_text} onChange={(e) => setQuestion(si, qi, { help_text: e.target.value })} />
                          </label>
                          <div className={q.two}>
                            <label><span className={p.label}>Type</span>
                              <select className={p.select} value={x.type} onChange={(e) => {
                                const type = e.target.value as QuestionType;
                                setQuestion(si, qi, { type, options: isChoice(type) && x.options.length === 0 ? ['Option 1', 'Option 2'] : x.options });
                              }}>
                                {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </label>
                            <label><span className={p.label}>Move to section</span>
                              <select className={p.select} value={si} onChange={(e) => moveQuestionTo(si, qi, Number(e.target.value))}>
                                {draft.sections.map((s2, k) => <option key={s2.id} value={k}>{s2.title}</option>)}
                              </select>
                            </label>
                          </div>
                          {isChoice(x.type) && (
                            <div>
                              <span className={p.label}>Options</span>
                              <div className={q.options}>
                                {x.options.map((o, oi) => (
                                  <div key={oi} className={q.option}>
                                    <input className={p.input} value={o} aria-label={`Option ${oi + 1}`} onChange={(e) => setQuestion(si, qi, { options: x.options.map((v, k) => (k === oi ? e.target.value : v)) })} />
                                    <button type="button" className={q.iconBtn} disabled={oi === 0} onClick={() => setQuestion(si, qi, { options: move(x.options, oi, oi - 1) })} aria-label="Move option up">↑</button>
                                    <button type="button" className={q.iconBtn} disabled={oi === x.options.length - 1} onClick={() => setQuestion(si, qi, { options: move(x.options, oi, oi + 1) })} aria-label="Move option down">↓</button>
                                    <button type="button" className={`${q.iconBtn} ${q.danger}`} onClick={() => setQuestion(si, qi, { options: x.options.filter((_, k) => k !== oi) })} aria-label="Remove option">✕</button>
                                  </div>
                                ))}
                                <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ justifySelf: 'start' }} onClick={() => setQuestion(si, qi, { options: [...x.options, `Option ${x.options.length + 1}`] })}>+ Add option</button>
                              </div>
                            </div>
                          )}
                          <label className={q.check}>
                            <input type="checkbox" checked={x.is_required} onChange={(e) => setQuestion(si, qi, { is_required: e.target.checked })} />
                            Required
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className={q.addRow}>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => addQuestion(si)}>+ Add question</button>
                </div>
              </div>
            </div>
          ))}
          <button type="button" className={p.btn} onClick={addSection}>+ Add section</button>
        </div>

        <aside className={q.previewWrap} aria-label="Client preview">
          <p className={p.label} style={{ marginBottom: 6 }}>Preview — what the client sees</p>
          <div className={q.previewTabs}>
            {draft.sections.map((s2, k) => (
              <button key={s2.id} type="button" className={`${w.chip} ${k === previewSection ? w.chipOn : ''}`} onClick={() => setPreviewSection(k)}>
                {s2.title}{s2.is_optional ? ' (optional)' : ''}
              </button>
            ))}
          </div>
          <div className={q.previewFrame}>
            {pv && (
              <div className={q.previewInner}>
                <div className={qs.card}>
                  <p className={qs.muted} style={{ marginBottom: 4 }}>{draft.title} · Section {previewSection + 1} of {draft.sections.length}</p>
                  <h2 className={qs.secHead}>{pv.title}</h2>
                  {pv.description && <p className={qs.muted}>{pv.description}</p>}
                  {pv.is_optional && <p className={qs.muted} style={{ marginTop: 6, fontWeight: 700 }}>Only shown to clients you turn it on for{pv.optional_label ? `: ${pv.optional_label}` : ''}.</p>}
                </div>
                {pv.questions.length === 0 && <p className={qs.muted}>No questions in this section yet.</p>}
                {pv.questions.map((x) => (
                  <QuestionField key={x.id} q={{ ...x, prompt: x.prompt || 'New question', sort_order: 0 }} value={previewAnswers[x.id] ?? null}
                    disabled={false} missing={false} uploading={false}
                    onChange={(v) => setPreviewAnswers((a) => ({ ...a, [x.id]: v }))} onUpload={() => {}} onRemove={() => {}} />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
