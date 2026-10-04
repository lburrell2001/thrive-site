export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { DEFAULT_DESIGN, starterBlocks } from '@/lib/newsletterBlocks';
import { starterTemplates } from '@/lib/prospectEmail';

/** Every prospect template, full, so the send dialog can switch between them. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db.from('prospect_templates').select('*').order('name');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

const createSchema = z.union([
  z.object({ starters: z.literal(true) }),
  z.object({ style: z.enum(['personal', 'designed']) }),
]);

/** A blank template of either style, or the starter set. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid request');

  const rows = 'starters' in parsed.data
    ? starterTemplates().map((t) => ({ ...t, design: t.style === 'designed' ? DEFAULT_DESIGN : {} }))
    : [parsed.data.style === 'designed'
        ? { name: 'New designed email', style: 'designed', subject: '', blocks: starterBlocks(), design: DEFAULT_DESIGN }
        : { name: 'New personal email', style: 'personal', subject: '', body: 'Hi {{first_name}},\n\n\n\nThanks,' }];
  const { data, error } = await auth.db.from('prospect_templates').insert(rows).select('id');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: data[0] });
}
