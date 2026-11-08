// Service questionnaires, server side: every read and write for the admin
// editor, assignments, client answers, uploads and responses. Tables are in
// migration 046 (RLS on, no policies — only the service role gets here); the
// routes calling this check who's asking first. Shared rules and types:
// src/lib/questionnaires.ts.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { SITE_URL } from './seo';
import { BRAND, brandEmail, paragraph, rows } from './emailLayout';
import { deliver, portalContact } from './clientNotify';
import { DOC_BUCKET } from './clientDocs';
import {
  MAX_FILES_PER_QUESTION, MAX_UPLOAD_BYTES, UPLOAD_TYPES,
  isChoice, isEditable, missingRequired, progressOf, visibleSections,
  type AnswerValue, type AssignmentStatus, type Question, type Questionnaire, type QuestionType,
  type Section, type ServiceType, type UploadedFile,
} from './questionnaires';

export class QuestionnaireError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const LINK_SECONDS = 60 * 60;

// ------------------------------------------------------------ structure

type QRow = Omit<Questionnaire, 'sections'> & { is_archived: boolean };
type SRow = Omit<Section, 'questions'> & { questionnaire_id: string; is_archived: boolean };
type QuRow = Question & { section_id: string; is_archived: boolean };

const Q_COLS = 'id, slug, title, description, service_type, is_active, is_archived, sort_order';
const S_COLS = 'id, questionnaire_id, title, description, sort_order, is_optional, optional_label, is_archived';
const QU_COLS = 'id, section_id, prompt, help_text, type, options, is_required, sort_order, is_archived';

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** Questionnaires with their sections and questions. Archived parts only when asked (responses). */
export async function loadQuestionnaires(db: SupabaseClient, ids: string[], opts: { archived?: boolean } = {}): Promise<Map<string, Questionnaire>> {
  const out = new Map<string, Questionnaire>();
  if (ids.length === 0) return out;
  const { data: qs, error } = await db.from('questionnaires').select(Q_COLS).in('id', ids);
  if (error) throw new QuestionnaireError(error.message, 500);
  const { data: ss } = await db.from('questionnaire_sections').select(S_COLS).in('questionnaire_id', ids);
  const sections = ((ss ?? []) as SRow[]).filter((s) => opts.archived || !s.is_archived);
  const { data: qus } = sections.length
    ? await db.from('questionnaire_questions').select(QU_COLS).in('section_id', sections.map((s) => s.id))
    : { data: [] };
  const questions = ((qus ?? []) as QuRow[]).filter((q) => opts.archived || !q.is_archived);
  for (const q of (qs ?? []) as QRow[]) {
    out.set(q.id, {
      id: q.id, slug: q.slug, title: q.title, description: q.description, service_type: q.service_type,
      is_active: q.is_active, sort_order: q.sort_order,
      sections: sections.filter((s) => s.questionnaire_id === q.id).sort(bySort).map((s) => ({
        id: s.id, title: s.title, description: s.description, sort_order: s.sort_order,
        is_optional: s.is_optional, optional_label: s.optional_label, is_archived: s.is_archived,
        questions: questions.filter((x) => x.section_id === s.id).sort(bySort).map((x) => ({
          id: x.id, prompt: x.prompt, help_text: x.help_text, type: x.type, options: Array.isArray(x.options) ? x.options : [],
          is_required: x.is_required, sort_order: x.sort_order, is_archived: x.is_archived,
        })),
      })),
    });
  }
  return out;
}

export async function loadQuestionnaire(db: SupabaseClient, id: string, opts: { archived?: boolean } = {}) {
  const q = (await loadQuestionnaires(db, [id], opts)).get(id);
  if (!q) throw new QuestionnaireError('Questionnaire not found', 404);
  return q;
}

export type QuestionnaireSummary = {
  id: string; slug: string; title: string; description: string; service_type: ServiceType;
  is_active: boolean; sort_order: number; sections: number; questions: number; optional: { id: string; title: string; label: string }[];
  assigned: number; waiting: number;
};

/** The admin list: every questionnaire that isn't archived, with counts. */
export async function listQuestionnaires(db: SupabaseClient): Promise<QuestionnaireSummary[]> {
  const { data: qs, error } = await db.from('questionnaires').select(Q_COLS).eq('is_archived', false).order('sort_order').order('created_at');
  if (error) throw new QuestionnaireError(error.message, 500);
  const ids = ((qs ?? []) as QRow[]).map((q) => q.id);
  const full = await loadQuestionnaires(db, ids);
  const { data: assigns } = ids.length
    ? await db.from('client_questionnaires').select('questionnaire_id, status').in('questionnaire_id', ids)
    : { data: [] };
  return ((qs ?? []) as QRow[]).map((q) => {
    const f = full.get(q.id)!;
    const mine = (assigns ?? []).filter((a) => a.questionnaire_id === q.id);
    return {
      id: q.id, slug: q.slug, title: q.title, description: q.description, service_type: q.service_type,
      is_active: q.is_active, sort_order: q.sort_order,
      sections: f.sections.length,
      questions: f.sections.reduce((n, s) => n + s.questions.length, 0),
      optional: f.sections.filter((s) => s.is_optional).map((s) => ({ id: s.id, title: s.title, label: s.optional_label })),
      assigned: mine.length,
      waiting: mine.filter((a) => a.status !== 'submitted').length,
    };
  });
}

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'questionnaire';
}

async function freeSlug(db: SupabaseClient, title: string) {
  const base = slugify(title);
  const { data } = await db.from('questionnaires').select('slug').like('slug', `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function createQuestionnaire(db: SupabaseClient, input: { title: string; service_type: ServiceType; description?: string }) {
  const { data: last } = await db.from('questionnaires').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db.from('questionnaires').insert({
    slug: await freeSlug(db, input.title), title: input.title, description: input.description ?? '',
    service_type: input.service_type, sort_order: (last?.sort_order ?? 0) + 1,
  }).select('id').single();
  if (error) throw new QuestionnaireError(error.message, 500);
  // Start with one empty section so the editor has somewhere to add questions.
  await db.from('questionnaire_sections').insert({ questionnaire_id: data.id, title: input.title, sort_order: 1 });
  return data.id as string;
}

export async function duplicateQuestionnaire(db: SupabaseClient, id: string) {
  const src = await loadQuestionnaire(db, id);
  const newId = await createQuestionnaire(db, { title: `${src.title} (copy)`, service_type: src.service_type, description: src.description });
  await db.from('questionnaire_sections').delete().eq('questionnaire_id', newId);
  await db.from('questionnaires').update({ is_active: false }).eq('id', newId);
  for (const s of src.sections) {
    const { data: sec, error } = await db.from('questionnaire_sections').insert({
      questionnaire_id: newId, title: s.title, description: s.description, sort_order: s.sort_order,
      is_optional: s.is_optional, optional_label: s.optional_label,
    }).select('id').single();
    if (error) throw new QuestionnaireError(error.message, 500);
    if (s.questions.length) {
      await db.from('questionnaire_questions').insert(s.questions.map((q) => ({
        section_id: sec.id, prompt: q.prompt, help_text: q.help_text, type: q.type, options: q.options,
        is_required: q.is_required, sort_order: q.sort_order,
      })));
    }
  }
  return newId;
}

/** Question ids (of these) that have at least one answer. */
async function answeredQuestionIds(db: SupabaseClient, questionIds: string[]): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set();
  const { data } = await db.from('questionnaire_answers').select('question_id').in('question_id', questionIds);
  return new Set((data ?? []).map((r) => r.question_id as string));
}

export type StructureInput = {
  title: string;
  description: string;
  service_type: ServiceType;
  is_active: boolean;
  sections: {
    id?: string | null;
    title: string;
    description: string;
    is_optional: boolean;
    optional_label: string;
    questions: { id?: string | null; prompt: string; help_text: string; type: QuestionType; options: string[]; is_required: boolean }[];
  }[];
};

/**
 * Save the editor's whole questionnaire in one go. Sections and questions keep
 * their ids when they have one; new ones are inserted; order comes from the
 * arrays. Anything missing was deleted in the editor: removed for good when
 * nobody has answered it, archived when someone has.
 */
export async function saveStructure(db: SupabaseClient, id: string, input: StructureInput) {
  const current = await loadQuestionnaire(db, id);
  const { error } = await db.from('questionnaires').update({
    title: input.title, description: input.description, service_type: input.service_type,
    is_active: input.is_active, updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new QuestionnaireError(error.message, 500);

  const currentSections = new Set(current.sections.map((s) => s.id));
  const currentQuestions = new Set(current.sections.flatMap((s) => s.questions.map((q) => q.id)));
  const keptSections = new Set<string>();
  const keptQuestions = new Set<string>();
  const now = new Date().toISOString();

  for (const [si, s] of input.sections.entries()) {
    const sectionRow = {
      questionnaire_id: id, title: s.title, description: s.description, sort_order: si + 1,
      is_optional: s.is_optional, optional_label: s.is_optional ? s.optional_label : '',
    };
    let sectionId = s.id && currentSections.has(s.id) ? s.id : null;
    if (sectionId) {
      const { error: e } = await db.from('questionnaire_sections').update(sectionRow).eq('id', sectionId);
      if (e) throw new QuestionnaireError(e.message, 500);
    } else {
      const { data, error: e } = await db.from('questionnaire_sections').insert(sectionRow).select('id').single();
      if (e) throw new QuestionnaireError(e.message, 500);
      sectionId = data.id as string;
    }
    keptSections.add(sectionId);

    for (const [qi, q] of s.questions.entries()) {
      const row = {
        section_id: sectionId, prompt: q.prompt, help_text: q.help_text, type: q.type,
        options: isChoice(q.type) ? q.options : [], is_required: q.is_required, sort_order: qi + 1, updated_at: now,
      };
      if (q.id && currentQuestions.has(q.id)) {
        const { error: e } = await db.from('questionnaire_questions').update(row).eq('id', q.id);
        if (e) throw new QuestionnaireError(e.message, 500);
        keptQuestions.add(q.id);
      } else {
        const { error: e } = await db.from('questionnaire_questions').insert(row);
        if (e) throw new QuestionnaireError(e.message, 500);
      }
    }
  }

  // Removed in the editor: delete, or archive what has answers.
  const goneQuestions = [...currentQuestions].filter((q) => !keptQuestions.has(q));
  const answered = await answeredQuestionIds(db, goneQuestions);
  const toArchive = goneQuestions.filter((q) => answered.has(q));
  const toDelete = goneQuestions.filter((q) => !answered.has(q));
  if (toArchive.length) await db.from('questionnaire_questions').update({ is_archived: true, updated_at: now }).in('id', toArchive);
  if (toDelete.length) await db.from('questionnaire_questions').delete().in('id', toDelete);

  const goneSections = [...currentSections].filter((s) => !keptSections.has(s));
  for (const sid of goneSections) {
    // A removed section's questions that weren't moved elsewhere go with it.
    const { data: left } = await db.from('questionnaire_questions').select('id').eq('section_id', sid);
    const leftIds = (left ?? []).map((r) => r.id as string);
    const leftAnswered = await answeredQuestionIds(db, leftIds);
    if (leftAnswered.size > 0) {
      await db.from('questionnaire_questions').update({ is_archived: true, updated_at: now }).in('id', [...leftAnswered]);
      const unanswered = leftIds.filter((q) => !leftAnswered.has(q));
      if (unanswered.length) await db.from('questionnaire_questions').delete().in('id', unanswered);
      await db.from('questionnaire_sections').update({ is_archived: true }).eq('id', sid);
    } else {
      await db.from('questionnaire_sections').delete().eq('id', sid);
    }
  }
  return loadQuestionnaire(db, id);
}

/** Delete a questionnaire, or archive it if any client has it (their answers stay). */
export async function deleteQuestionnaire(db: SupabaseClient, id: string): Promise<'deleted' | 'archived'> {
  const { count } = await db.from('client_questionnaires').select('id', { count: 'exact', head: true }).eq('questionnaire_id', id);
  if ((count ?? 0) > 0) {
    await db.from('questionnaires').update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    return 'archived';
  }
  const { error } = await db.from('questionnaires').delete().eq('id', id);
  if (error) throw new QuestionnaireError(error.message, 500);
  return 'deleted';
}

// ------------------------------------------------------------ assignments

type ARow = {
  id: string; client_id: string; project_id: string | null; questionnaire_id: string;
  include_optional_sections: unknown; status: AssignmentStatus;
  assigned_at: string; submitted_at: string | null; reopened_at: string | null; updated_at: string;
};
const A_COLS = 'id, client_id, project_id, questionnaire_id, include_optional_sections, status, assigned_at, submitted_at, reopened_at, updated_at';

const optionalOf = (a: ARow) => (Array.isArray(a.include_optional_sections) ? (a.include_optional_sections as string[]) : []);

export type AssignmentSummary = {
  id: string; client_id: string; project_id: string | null; project_name: string | null;
  questionnaire_id: string; title: string; service_type: ServiceType; status: AssignmentStatus;
  include_optional_sections: string[]; optional: { id: string; title: string; label: string }[];
  assigned_at: string; submitted_at: string | null; reopened_at: string | null;
  answered: number; total: number;
  client_name?: string; company_name?: string;
};

async function answersFor(db: SupabaseClient, assignmentIds: string[]) {
  if (assignmentIds.length === 0) return [] as { client_questionnaire_id: string; question_id: string; value: AnswerValue }[];
  const { data } = await db.from('questionnaire_answers').select('client_questionnaire_id, question_id, value').in('client_questionnaire_id', assignmentIds);
  return (data ?? []) as { client_questionnaire_id: string; question_id: string; value: AnswerValue }[];
}

async function summarize(db: SupabaseClient, rows: ARow[], withClient = false): Promise<AssignmentSummary[]> {
  const qs = await loadQuestionnaires(db, [...new Set(rows.map((r) => r.questionnaire_id))]);
  const answers = await answersFor(db, rows.map((r) => r.id));
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
  const { data: projects } = projectIds.length ? await db.from('portal_projects').select('id, name').in('id', projectIds) : { data: [] };
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const { data: clients } = withClient && clientIds.length
    ? await db.from('portal_clients').select('id, full_name, company_name').in('id', clientIds)
    : { data: [] };
  return rows.flatMap((r) => {
    const q = qs.get(r.questionnaire_id);
    if (!q) return [];
    const mine = Object.fromEntries(answers.filter((a) => a.client_questionnaire_id === r.id).map((a) => [a.question_id, a.value]));
    const p = progressOf(q.sections, optionalOf(r), mine);
    const client = (clients ?? []).find((c) => c.id === r.client_id);
    return [{
      id: r.id, client_id: r.client_id, project_id: r.project_id,
      project_name: (projects ?? []).find((x) => x.id === r.project_id)?.name ?? null,
      questionnaire_id: r.questionnaire_id, title: q.title, service_type: q.service_type, status: r.status,
      include_optional_sections: optionalOf(r),
      optional: q.sections.filter((s) => s.is_optional).map((s) => ({ id: s.id, title: s.title, label: s.optional_label })),
      assigned_at: r.assigned_at, submitted_at: r.submitted_at, reopened_at: r.reopened_at,
      answered: p.answered, total: p.total,
      ...(withClient ? { client_name: client?.full_name ?? '', company_name: client?.company_name ?? '' } : {}),
    }];
  });
}

export async function clientAssignments(db: SupabaseClient, clientId: string) {
  const { data, error } = await db.from('client_questionnaires').select(A_COLS).eq('client_id', clientId).order('assigned_at');
  if (error) throw new QuestionnaireError(error.message, 500);
  return summarize(db, (data ?? []) as ARow[]);
}

/** Assigned but not submitted, every client — for admin Home. */
export async function waitingAssignments(db: SupabaseClient) {
  const { data, error } = await db.from('client_questionnaires').select(A_COLS).neq('status', 'submitted').order('assigned_at');
  if (error) throw new QuestionnaireError(error.message, 500);
  return summarize(db, (data ?? []) as ARow[], true);
}

async function getAssignment(db: SupabaseClient, id: string): Promise<ARow> {
  const { data, error } = await db.from('client_questionnaires').select(A_COLS).eq('id', id).maybeSingle();
  if (error) throw new QuestionnaireError(error.message, 500);
  if (!data) throw new QuestionnaireError('Questionnaire not found', 404);
  return data as ARow;
}

/** An assignment that belongs to this portal client, or a 404. */
export async function ownAssignment(db: SupabaseClient, id: string, clientId: string) {
  const a = await getAssignment(db, id);
  if (a.client_id !== clientId) throw new QuestionnaireError('Questionnaire not found', 404);
  return a;
}

/** Keep only section ids that are optional sections of this questionnaire. */
function cleanOptional(q: Questionnaire, ids: string[]) {
  const allowed = new Set(q.sections.filter((s) => s.is_optional).map((s) => s.id));
  return [...new Set(ids)].filter((s) => allowed.has(s));
}

export async function assignQuestionnaires(
  db: SupabaseClient,
  input: { clientId: string; projectId: string | null; items: { questionnaireId: string; optional: string[] }[]; notify: boolean },
) {
  const { data: client } = await db.from('portal_clients').select('id').eq('id', input.clientId).maybeSingle();
  if (!client) throw new QuestionnaireError('Client not found', 404);
  if (input.projectId) {
    const { data: p } = await db.from('portal_projects').select('id').eq('id', input.projectId).eq('client_id', input.clientId).maybeSingle();
    if (!p) throw new QuestionnaireError('That project isn’t this client’s', 400);
  }
  const qs = await loadQuestionnaires(db, input.items.map((i) => i.questionnaireId));
  const rows = input.items.map((i) => {
    const q = qs.get(i.questionnaireId);
    if (!q) throw new QuestionnaireError('Questionnaire not found', 404);
    return {
      client_id: input.clientId, project_id: input.projectId, questionnaire_id: q.id,
      include_optional_sections: cleanOptional(q, i.optional),
    };
  });
  const { error } = await db.from('client_questionnaires').insert(rows);
  if (error) throw new QuestionnaireError(error.message, 500);

  let notified: string | null = null;
  if (input.notify) {
    const titles = rows.map((r) => qs.get(r.questionnaire_id)!.title);
    notified = await notifyAssigned(db, input.clientId, titles);
  }
  return { notified };
}

async function notifyAssigned(db: SupabaseClient, clientId: string, titles: string[]): Promise<string> {
  const contact = await portalContact(db, clientId);
  if (!contact) return 'Not sent: client not found';
  const many = titles.length > 1;
  const report = await deliver(db, contact, {
    subject: many ? 'Your onboarding questionnaires are ready' : `Your ${titles[0]} questionnaire is ready`,
    eyebrow: 'Onboarding',
    headline: many
      ? `You have ${titles.length} short questionnaires to fill out so we can get started.`
      : `You have a short questionnaire to fill out so we can get started: ${titles[0]}.`,
    detail: [
      ...(many ? titles.map((t) => `• ${t}`) : []),
      '',
      'It saves as you go, so you can stop and come back any time — on your phone or computer.',
    ].join('\n').trim(),
    ctaUrl: `${SITE_URL}/portal/onboarding`,
    ctaLabel: many ? 'Start the questionnaires' : 'Start the questionnaire',
    sms: `${many ? 'Your onboarding questionnaires are' : `Your ${titles[0]} questionnaire is`} ready in your client portal. It saves as you go:`,
  }, { email: true, sms: true });
  const parts = [report.email.status === 'sent' ? `emailed ${report.email.to}` : null, report.sms.status === 'sent' ? 'texted' : null].filter(Boolean);
  return parts.length ? `Client ${parts.join(' and ')}` : `Not sent${report.email.error ? `: ${report.email.error}` : ''}`;
}

export async function setOptionalSections(db: SupabaseClient, id: string, sectionIds: string[]) {
  const a = await getAssignment(db, id);
  const q = await loadQuestionnaire(db, a.questionnaire_id);
  const { error } = await db.from('client_questionnaires')
    .update({ include_optional_sections: cleanOptional(q, sectionIds), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new QuestionnaireError(error.message, 500);
}

export async function reopenAssignment(db: SupabaseClient, id: string) {
  const now = new Date().toISOString();
  const { error } = await db.from('client_questionnaires').update({ status: 'reopened', reopened_at: now, updated_at: now }).eq('id', id);
  if (error) throw new QuestionnaireError(error.message, 500);
}

export async function unassign(db: SupabaseClient, id: string) {
  const a = await getAssignment(db, id);
  const { data: answers } = await db.from('questionnaire_answers').select('value').eq('client_questionnaire_id', id);
  const paths = (answers ?? []).flatMap((r) => (Array.isArray(r.value) ? r.value : []).filter((v): v is UploadedFile => !!v && typeof v === 'object' && 'path' in v).map((f) => f.path));
  const { error } = await db.from('client_questionnaires').delete().eq('id', a.id);
  if (error) throw new QuestionnaireError(error.message, 500);
  if (paths.length) await db.storage.from(DOC_BUCKET).remove(paths);
}

// ------------------------------------------------------------ one questionnaire, with answers

export type AnswerRecord = { value: AnswerValue; snapshot: string; updated_at: string };

export type AssignmentDetail = {
  assignment: AssignmentSummary;
  questionnaire: Questionnaire;
  answers: Record<string, AnswerRecord>;
};

async function signFiles(db: SupabaseClient, answers: Record<string, AnswerRecord>) {
  const files = Object.values(answers).flatMap((a) => (Array.isArray(a.value) ? a.value : []).filter((v): v is UploadedFile => !!v && typeof v === 'object' && 'path' in v));
  if (files.length === 0) return;
  const { data } = await db.storage.from(DOC_BUCKET).createSignedUrls(files.map((f) => f.path), LINK_SECONDS);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  files.forEach((f) => { f.url = urls.get(f.path) ?? undefined; });
}

/**
 * One assignment with its questionnaire and answers. For a client: only the
 * sections they see. For admin: every section, plus archived questions that
 * were answered, so old submissions read as they were sent.
 */
export async function loadAssignmentDetail(db: SupabaseClient, a: ARow, forAdmin: boolean): Promise<AssignmentDetail> {
  const [summary] = await summarize(db, [a]);
  if (!summary) throw new QuestionnaireError('Questionnaire not found', 404);
  const { data } = await db.from('questionnaire_answers').select('question_id, value, question_prompt_snapshot, updated_at').eq('client_questionnaire_id', a.id);
  const answers: Record<string, AnswerRecord> = Object.fromEntries((data ?? []).map((r) => [r.question_id, { value: r.value as AnswerValue, snapshot: r.question_prompt_snapshot, updated_at: r.updated_at }]));
  await signFiles(db, answers);
  const full = await loadQuestionnaire(db, a.questionnaire_id, { archived: forAdmin });
  const questionnaire: Questionnaire = forAdmin
    ? {
        ...full,
        sections: full.sections
          .map((s) => ({ ...s, questions: s.questions.filter((q) => !q.is_archived || q.id in answers) }))
          .filter((s) => (!s.is_archived || s.questions.length > 0)),
      }
    : { ...full, sections: visibleSections(full.sections, optionalOf(a)) };
  return { assignment: summary, questionnaire, answers };
}

export async function assignmentForAdmin(db: SupabaseClient, id: string) {
  return loadAssignmentDetail(db, await getAssignment(db, id), true);
}

// ------------------------------------------------------------ answering (client)

function visibleQuestion(q: Questionnaire, a: ARow, questionId: string): Question {
  for (const s of visibleSections(q.sections, optionalOf(a))) {
    const found = s.questions.find((x) => x.id === questionId && !x.is_archived);
    if (found) return found;
  }
  throw new QuestionnaireError('That question isn’t part of this questionnaire', 400);
}

function assertEditable(a: ARow) {
  if (!isEditable(a.status)) throw new QuestionnaireError('This questionnaire has been submitted. Ask Thrive to reopen it to make changes.', 409);
}

/** Check and normalise a typed answer for its question type. */
function cleanValue(q: Question, value: unknown): AnswerValue {
  if (value === null || value === undefined || value === '') return null;
  const str = (max: number) => {
    if (typeof value !== 'string') throw new QuestionnaireError('Expected text');
    return value.slice(0, max);
  };
  switch (q.type) {
    case 'short_text': return str(1000);
    case 'long_text': return str(20000);
    case 'url': return str(2000).trim();
    case 'date': {
      const d = str(10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new QuestionnaireError('Expected a date');
      return d;
    }
    case 'yes_no':
      if (typeof value !== 'boolean') throw new QuestionnaireError('Expected yes or no');
      return value;
    case 'single_choice': {
      const v = str(500);
      if (!q.options.includes(v)) throw new QuestionnaireError('Pick one of the options');
      return v;
    }
    case 'multi_choice':
    case 'checkbox_list': {
      if (!Array.isArray(value)) throw new QuestionnaireError('Expected a list');
      const picked = q.options.filter((o) => value.includes(o)); // option order, no unknowns
      return picked.length ? picked : null;
    }
    case 'file_upload':
      throw new QuestionnaireError('Files are added with an upload');
  }
}

async function writeAnswer(db: SupabaseClient, a: ARow, q: Question, value: AnswerValue) {
  const now = new Date().toISOString();
  const { error } = await db.from('questionnaire_answers').upsert({
    client_questionnaire_id: a.id, question_id: q.id, question_prompt_snapshot: q.prompt, value, updated_at: now,
  }, { onConflict: 'client_questionnaire_id,question_id' });
  if (error) throw new QuestionnaireError(error.message, 500);
  if (a.status === 'not_started') {
    await db.from('client_questionnaires').update({ status: 'in_progress', updated_at: now }).eq('id', a.id);
  } else {
    await db.from('client_questionnaires').update({ updated_at: now }).eq('id', a.id);
  }
}

export async function saveAnswer(db: SupabaseClient, a: ARow, questionId: string, value: unknown) {
  assertEditable(a);
  const q = visibleQuestion(await loadQuestionnaire(db, a.questionnaire_id), a, questionId);
  await writeAnswer(db, a, q, cleanValue(q, value));
}

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-80) || 'file';

/** A one-time upload link for a file question; the browser uploads straight to Storage (no 4.5 MB limit). */
export async function signUpload(db: SupabaseClient, a: ARow, questionId: string, file: { name: string; size: number; type: string }) {
  assertEditable(a);
  const q = visibleQuestion(await loadQuestionnaire(db, a.questionnaire_id), a, questionId);
  if (q.type !== 'file_upload') throw new QuestionnaireError('That question doesn’t take files');
  if (!UPLOAD_TYPES.includes(file.type)) throw new QuestionnaireError('That file type isn’t supported. Images, PDFs and documents work.');
  if (!(file.size > 0) || file.size > MAX_UPLOAD_BYTES) throw new QuestionnaireError('Files can be up to 10 MB.');
  const path = `questionnaires/${a.client_id}/${a.id}/${q.id}/${Date.now()}-${safeName(file.name)}`;
  const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new QuestionnaireError(error?.message ?? 'Could not start the upload', 500);
  return { path: data.path, token: data.token, bucket: DOC_BUCKET };
}

async function fileList(db: SupabaseClient, a: ARow, questionId: string): Promise<UploadedFile[]> {
  const { data } = await db.from('questionnaire_answers').select('value').eq('client_questionnaire_id', a.id).eq('question_id', questionId).maybeSingle();
  return Array.isArray(data?.value) ? (data!.value as UploadedFile[]) : [];
}

/** After the browser uploads: check the file is really there, then add it to the answer. */
export async function attachFile(db: SupabaseClient, a: ARow, questionId: string, file: { path: string; name: string; size: number; type: string }) {
  assertEditable(a);
  const q = visibleQuestion(await loadQuestionnaire(db, a.questionnaire_id), a, questionId);
  const prefix = `questionnaires/${a.client_id}/${a.id}/${q.id}/`;
  if (q.type !== 'file_upload' || !file.path.startsWith(prefix) || file.path.includes('..')) throw new QuestionnaireError('That upload doesn’t belong here');
  const folder = file.path.slice(0, file.path.lastIndexOf('/'));
  const { data: found } = await db.storage.from(DOC_BUCKET).list(folder, { search: file.path.slice(folder.length + 1) });
  if (!found?.length) throw new QuestionnaireError('The upload didn’t finish. Try again.');
  const files = await fileList(db, a, q.id);
  if (files.length >= MAX_FILES_PER_QUESTION) throw new QuestionnaireError(`Up to ${MAX_FILES_PER_QUESTION} files per question.`);
  const next = [...files.filter((f) => f.path !== file.path), { path: file.path, name: file.name.slice(0, 200), size: file.size, type: file.type }];
  await writeAnswer(db, a, q, next);
}

export async function removeFile(db: SupabaseClient, a: ARow, questionId: string, path: string) {
  assertEditable(a);
  const q = visibleQuestion(await loadQuestionnaire(db, a.questionnaire_id), a, questionId);
  const files = await fileList(db, a, q.id);
  if (!files.some((f) => f.path === path)) return;
  await db.storage.from(DOC_BUCKET).remove([path]);
  const next = files.filter((f) => f.path !== path);
  await writeAnswer(db, a, q, next.length ? next : null);
}

export async function submitAssignment(db: SupabaseClient, a: ARow) {
  assertEditable(a);
  const detail = await loadAssignmentDetail(db, a, false);
  const values = Object.fromEntries(Object.entries(detail.answers).map(([k, v]) => [k, v.value]));
  const missing = missingRequired(detail.questionnaire.sections, optionalOf(a), values);
  if (missing.length) return { ok: false as const, missing };
  const now = new Date().toISOString();
  const { error } = await db.from('client_questionnaires').update({ status: 'submitted', submitted_at: now, updated_at: now }).eq('id', a.id);
  if (error) throw new QuestionnaireError(error.message, 500);
  await notifySubmitted(db, a, detail).catch(() => {});
  return { ok: true as const };
}

async function notifySubmitted(db: SupabaseClient, a: ARow, detail: AssignmentDetail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  const to = process.env.CONTACT_NOTIFY_TO || 'hello@thrivecreativestudios.org';
  if (!key || !from) return;
  const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', a.client_id).maybeSingle();
  const email = (await portalContact(db, a.client_id).catch(() => null))?.email ?? null;
  const who = client?.company_name || client?.full_name || 'A client';
  const title = detail.questionnaire.title;
  const link = `${SITE_URL}/admin/questionnaires/responses/${a.id}`;
  const again = a.status === 'reopened';
  await new Resend(key).emails.send({
    from, to,
    subject: `${who} ${again ? 'resubmitted' : 'submitted'} ${title}`,
    text: `${who} ${again ? 'resubmitted' : 'submitted'} the ${title} questionnaire (${detail.assignment.answered} of ${detail.assignment.total} answered).\n\nRead the answers: ${link}`,
    html: brandEmail({
      title: `${who} ${again ? 'resubmitted' : 'submitted'} ${title}`,
      eyebrow: 'Questionnaire',
      accent: 'green',
      heading: who,
      body: [
        paragraph(`${who} ${again ? 'resubmitted' : 'submitted'} the ${title} questionnaire.`),
        rows([
          { label: 'Client', value: client?.full_name || who },
          ...(email ? [{ label: 'Email', value: email, href: `mailto:${email}` }] : []),
          { label: 'Answered', value: `${detail.assignment.answered} of ${detail.assignment.total}` },
          { label: 'Answers', value: 'Open in admin', href: link, strong: true },
        ]),
        paragraph('Reopen it from admin if they need to change anything.', { size: 13, color: BRAND.muted }),
      ].join('\n'),
    }),
  });
}
