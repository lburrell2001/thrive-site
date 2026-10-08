import { z } from 'zod';
import { ACTIVITY_KINDS, CALL_DIRECTIONS, CALL_OUTCOMES, CRM_STAGES } from '@/types/crm';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.email().safeParse(v).success, 'Enter a valid email');

const contactFields = {
  name: z.string().trim().min(1, 'Add a name').max(160),
  company: optionalText(160),
  email,
  phone: optionalText(40),
  source: z.string().trim().min(1).max(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  website: optionalText(300),
  /** 'prospect' puts them on the Prospects list; null takes them off it. */
  prospect_status: z.enum(['prospect', 'converted']).nullable(),
};

const dealFields = {
  title: z.string().trim().min(1, 'Name the deal').max(160),
  stage: z.enum(CRM_STAGES),
  value_cents: z.number().int().min(0).nullable(),
  /** A retainer: the monthly price. Null makes it a one-off deal again. */
  monthly_cents: z.number().int().min(0).nullable(),
  term_months: z.number().int().min(1, 'At least one month').max(120, 'Up to 120 months').nullable(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date').nullable(),
  lost_reason: optionalText(600),
};

export const createDealSchema = z.object({
  title: dealFields.title,
  stage: dealFields.stage.default('lead'),
  value_cents: dealFields.value_cents.optional(),
  monthly_cents: dealFields.monthly_cents.optional(),
  term_months: dealFields.term_months.optional(),
  starts_on: dealFields.starts_on.optional(),
});

/** A new contact, optionally with their first deal. */
export const createContactSchema = z.object({
  ...contactFields,
  source: contactFields.source.default('manual'),
  tags: contactFields.tags.default([]),
  prospect_status: contactFields.prospect_status.optional(),
  deal: createDealSchema.optional(),
});

// No defaults on updates: under Zod 4 a default inside .partial() still
// fills in, and a PATCH of one field would reset the others.
export const updateContactSchema = z
  .object(contactFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const updateDealSchema = z
  .object(dealFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const createActivitySchema = z
  .object({
    kind: z.enum(ACTIVITY_KINDS),
    body: z.string().trim().max(5000).default(''),
    /** When it happened, if not just now (a call logged afterwards). */
    at: z.iso.datetime({ offset: true }).nullish(),
    deal_id: z.uuid().nullish(),
    call: z
      .object({
        direction: z.enum(CALL_DIRECTIONS),
        outcome: z.enum(CALL_OUTCOMES),
        minutes: z.number().int().min(0).max(600).nullish(),
      })
      .nullish(),
    /** A follow-up task to add at the same time. */
    follow_up: z.object({ title: z.string().trim().min(1).max(200), due_date: isoDate.nullish() }).nullish(),
  })
  // A call that went unanswered needs no write-up; anything else does.
  .refine((a) => a.kind === 'call' || a.body.length > 0, { message: 'Write something first', path: ['body'] })
  .refine((a) => a.kind !== 'call' || a.call, { message: 'Say how the call went', path: ['call'] })
  .refine((a) => !a.at || Date.parse(a.at) <= Date.now() + 5 * 60_000, { message: 'That time is in the future', path: ['at'] });

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Add a task').max(200),
  due_date: isoDate.nullish(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    due_date: isoDate.nullable(),
    completed: z.boolean(),
  })
  .partial();
