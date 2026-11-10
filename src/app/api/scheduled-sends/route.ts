export const runtime = 'nodejs';

// Scheduled proposals, estimates and invoices (migration 053,
// src/lib/scheduledSends.ts): GET what's waiting, POST to schedule one
// (what the Send dialog would have sent, plus send_at), DELETE ?id= to cancel
// one (or dismiss a failed one). The cron sends them.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { cancelSend, listSends, scheduleSend } from '@/lib/scheduledSends';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ ok: true, data: { sends: await listSends(auth.db) } });
}

const schema = z.object({
  kind: z.enum(['proposal', 'estimate', 'invoice']),
  target_id: z.string().uuid().nullable().optional(),
  label: z.string().max(300).optional(),
  payload: z.unknown(),
  send_at: z.string().min(10).max(40),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const made = await scheduleSend(auth.db, parsed.data);
  if (!made.ok) return badRequest(made.error);
  return NextResponse.json({ ok: true, data: { id: made.id, send_at: made.send_at } });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest('Missing id');
  const done = await cancelSend(auth.db, id);
  if (!done.ok) return badRequest(done.error);
  return NextResponse.json({ ok: true });
}
