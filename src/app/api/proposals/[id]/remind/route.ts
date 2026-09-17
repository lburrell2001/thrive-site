export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { ReminderError, previewReminder, sendReminder, sendReminderSchema } from '@/lib/reminders';

type Ctx = { params: Promise<{ id: string }> };

/** Who the reminder would go to, on which channels, and past reminders. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const data = await previewReminder(auth.db, { kind: 'proposal', id }, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof ReminderError) return badRequest(error.message);
    throw error;
  }
}

/** Remind the client to review and sign, by email and/or text. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = sendReminderSchema.safeParse({ ...body, target: { kind: 'proposal', id } });
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  try {
    const data = await sendReminder(auth.db, parsed.data, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof ReminderError) return badRequest(error.message);
    throw error;
  }
}
