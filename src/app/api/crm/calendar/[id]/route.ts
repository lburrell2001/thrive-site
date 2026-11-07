export const runtime = 'nodejs';

// Link an Outlook calendar meeting to a contact by hand, or unlink it
// (calendar_events, migration 043). The sync leaves hand-made links alone.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ contact_id: z.string().uuid().nullable() });

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Choose a contact');

  const { data, error } = await auth.db.from('calendar_events')
    .update({ contact_id: parsed.data.contact_id, matched_by: parsed.data.contact_id ? 'manual' : null, contact_locked: true })
    .eq('id', id).select('id').maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('Meeting not found', 404);
  return NextResponse.json({ ok: true, data: null });
}
