export const runtime = 'nodejs';

// "Text" in the estimate's Send dialog: the message went out from Lauren's
// Google Voice (the browser copied it and opened Voice). This marks a draft
// Sent and logs the text on their timeline.

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { estimateTextSchema, logEstimateText } from '@/lib/estimateSend';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = estimateTextSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const done = await logEstimateText(auth.db, id, parsed.data);
  if (!done.ok) return badRequest(done.error, done.status);
  return NextResponse.json({ ok: true });
}
