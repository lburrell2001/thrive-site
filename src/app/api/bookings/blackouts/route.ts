export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

const schema = z.object({
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(120).optional().transform((v) => v || null),
}).refine((v) => v.ends_on >= v.starts_on, 'The end date must be on or after the start');

/** Block off days: vacation, a shoot, a conference. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid dates');

  const { data, error } = await auth.db.from('booking_blackouts').insert(parsed.data).select('*').single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
