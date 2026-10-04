export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

/** Mark a reply dealt with (or not), which takes it off the Today page. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = z.object({ handled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid request');
  const { error } = await auth.db.from('email_replies').update({ handled_at: parsed.data.handled ? new Date().toISOString() : null }).eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
