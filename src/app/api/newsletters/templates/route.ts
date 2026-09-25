export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { blocksSchema, designSchema } from '@/lib/newsletterBlocks';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db.from('newsletter_templates').select('id, name, updated_at').order('name');
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name the template').max(80),
  blocks: blocksSchema.min(1, 'Add at least one block'),
  design: designSchema.partial(),
});

/** Save a newsletter's layout and design to start future ones from. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid template');
  const { data, error } = await auth.db.from('newsletter_templates').insert(parsed.data).select('id, name').single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
