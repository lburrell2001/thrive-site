export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { DEFAULT_DESIGN, blocksSchema, designSchema, starterBlocks } from '@/lib/newsletterBlocks';
import { starterTemplates } from '@/lib/emailContent';

/** Every email template, full, so the send dialog can switch between them. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db.from('email_templates').select('*').order('name');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

const createSchema = z.union([
  z.object({ starters: z.literal(true) }),
  // Saved from an email ("Save as template").
  z.object({
    name: z.string().trim().min(1, 'Name the template').max(80),
    style: z.enum(['personal', 'designed']),
    subject: z.string().max(160).default(''),
    preheader: z.string().max(200).default(''),
    body: z.string().max(20_000).default(''),
    blocks: blocksSchema.default([]),
    design: designSchema.partial().default({}),
  }),
  z.object({ style: z.enum(['personal', 'designed']) }),
]);

/** A blank template of either style, one saved from an email, or the starter set. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const v = parsed.data;

  const rows = 'starters' in v
    ? starterTemplates().map((t) => ({ ...t, design: t.style === 'designed' ? DEFAULT_DESIGN : {} }))
    : 'name' in v
      ? [v]
      : [v.style === 'designed'
          ? { name: 'New designed email', style: 'designed', subject: '', blocks: starterBlocks(), design: DEFAULT_DESIGN }
          : { name: 'New personal email', style: 'personal', subject: '', body: 'Hi {{first_name}},\n\n\n\nThanks,' }];
  const { data, error } = await auth.db.from('email_templates').insert(rows).select('id');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: data[0] });
}
