import { z } from 'zod';
import { ACTIVITY_KINDS, CRM_STAGES } from '@/types/crm';

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
};

const dealFields = {
  title: z.string().trim().min(1, 'Name the deal').max(160),
  stage: z.enum(CRM_STAGES),
  value_cents: z.number().int().min(0).nullable(),
  lost_reason: optionalText(600),
};

export const createDealSchema = z.object({
  title: dealFields.title,
  stage: dealFields.stage.default('lead'),
  value_cents: dealFields.value_cents.optional(),
});

/** A new contact, optionally with their first deal. */
export const createContactSchema = z.object({
  ...contactFields,
  source: contactFields.source.default('manual'),
  tags: contactFields.tags.default([]),
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

export const createActivitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  body: z.string().trim().min(1, 'Write something first').max(5000),
});

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
