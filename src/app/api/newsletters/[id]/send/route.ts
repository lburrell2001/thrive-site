export const runtime = 'nodejs';
// Sending waits between batches; give a large list room to finish.
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { NewsletterError, sendNewsletter } from '@/lib/newsletter';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const result = await sendNewsletter(auth.db, id, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof NewsletterError) return badRequest(error.message);
    throw error;
  }
}
