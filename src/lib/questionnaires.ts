// Service questionnaires: shared types and rules for the admin editor, the
// client portal and the server routes. Pure — no server imports.
//
// A questionnaire has sections, a section has questions. Lauren assigns a
// questionnaire to a portal client (client_questionnaires), switching on any
// optional sections for them; the client's answers live in
// questionnaire_answers, each with a copy of the question text they saw.
// Tables: migration 046. Server side: src/lib/questionnaireRepo.ts.

export const SERVICE_TYPES = {
  about_you: 'About You',
  branding: 'Branding',
  website: 'Website Development',
  app_development: 'App Development',
  social_media: 'Social Media',
  ux_ui: 'UX/UI Design',
  photography: 'Photography',
  custom: 'Custom',
} as const;
export type ServiceType = keyof typeof SERVICE_TYPES;

export const QUESTION_TYPES = {
  short_text: 'Short answer',
  long_text: 'Paragraph',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  checkbox_list: 'Checkbox list',
  yes_no: 'Yes / no',
  url: 'Link',
  date: 'Date',
  file_upload: 'File upload',
} as const;
export type QuestionType = keyof typeof QUESTION_TYPES;

/** Types that take a list of options. */
export const CHOICE_TYPES: QuestionType[] = ['single_choice', 'multi_choice', 'checkbox_list'];
export const isChoice = (t: QuestionType) => CHOICE_TYPES.includes(t);
/** Types whose answer is a list (several options can be picked). */
export const isMulti = (t: QuestionType) => t === 'multi_choice' || t === 'checkbox_list';

export type AssignmentStatus = 'not_started' | 'in_progress' | 'submitted' | 'reopened';
export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  reopened: 'Reopened',
};
/** Whether the client can still change answers. */
export const isEditable = (s: AssignmentStatus) => s !== 'submitted';

export type Question = {
  id: string;
  prompt: string;
  help_text: string;
  type: QuestionType;
  options: string[];
  is_required: boolean;
  sort_order: number;
  is_archived?: boolean;
};

export type Section = {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  is_optional: boolean;
  optional_label: string;
  is_archived?: boolean;
  questions: Question[];
};

export type Questionnaire = {
  id: string;
  slug: string;
  title: string;
  description: string;
  service_type: ServiceType;
  is_active: boolean;
  sort_order: number;
  sections: Section[];
};

/** An uploaded file, as stored in a file_upload answer's value. */
export type UploadedFile = { path: string; name: string; size: number; type: string; url?: string };

/** What an answer's value holds, by question type. */
export type AnswerValue = string | string[] | boolean | UploadedFile[] | null;

/** The sections a client sees: optional ones only when switched on for them. */
export function visibleSections(sections: Section[], includeOptional: string[]): Section[] {
  return sections.filter((s) => !s.is_archived && (!s.is_optional || includeOptional.includes(s.id)));
}

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.trim().length > 0;
  return Array.isArray(value) && value.length > 0;
}

/** An answer as plain text, for copy, PDF and email. */
export function answerText(value: AnswerValue | undefined): string {
  if (!isAnswered(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.trim();
  return (value as (string | UploadedFile)[]).map((v) => (typeof v === 'string' ? v : v.name)).join(', ');
}

/** Visible questions answered / total, for progress bars. */
export function progressOf(sections: Section[], includeOptional: string[], answers: Record<string, AnswerValue>) {
  const qs = visibleSections(sections, includeOptional).flatMap((s) => s.questions.filter((q) => !q.is_archived));
  return { answered: qs.filter((q) => isAnswered(answers[q.id])).length, total: qs.length };
}

/** Required visible questions still blank. */
export function missingRequired(sections: Section[], includeOptional: string[], answers: Record<string, AnswerValue>): string[] {
  return visibleSections(sections, includeOptional)
    .flatMap((s) => s.questions.filter((q) => !q.is_archived && q.is_required && !isAnswered(answers[q.id])))
    .map((q) => q.id);
}

/** Files clients may upload to file questions. */
export const UPLOAD_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
export const UPLOAD_ACCEPT = 'image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_QUESTION = 10;

/** A filled-out questionnaire as plain text (Copy all answers), using the question text the client saw. */
export function responsesText(
  q: Pick<Questionnaire, 'title' | 'sections'>,
  answers: Record<string, { value: AnswerValue; snapshot: string } | undefined>,
  heading: string,
): string {
  const out = [heading, ''];
  for (const s of q.sections) {
    out.push(s.title.toUpperCase(), '');
    for (const qu of s.questions) {
      const a = answers[qu.id];
      out.push(a?.snapshot || qu.prompt, answerText(a?.value), '');
    }
  }
  return out.join('\n').trim();
}
