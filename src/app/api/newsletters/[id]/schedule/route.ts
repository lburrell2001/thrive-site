export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { NewsletterError, scheduleNewsletter, unscheduleNewsletter } from '@/lib/newsletter';
import { scheduleProblem } from '@/lib/scheduleTime';

type Ctx = { params: Promise<{ id: string }> };

const scheduleSchema = z.object({ at: z.string().datetime({ offset: true }) });

/** Send it at a set time. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = scheduleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Choose a date and time');
  const at = new Date(parsed.data.at);
  const problem = scheduleProblem(at);
  if (problem) return badRequest(problem);
  try {
    const data = await scheduleNewsletter(auth.db, id, at);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof NewsletterError) return badRequest(error.message);
    throw error;
  }
}

/** Unschedule: back to a draft. */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const data = await unscheduleNewsletter(auth.db, id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof NewsletterError) return badRequest(error.message);
    throw error;
  }
}
