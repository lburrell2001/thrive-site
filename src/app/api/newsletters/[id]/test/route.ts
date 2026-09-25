export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { NewsletterError, sendTest, type Newsletter } from '@/lib/newsletter';
import { resolveSiteOrigin } from '@/lib/proposalUrls';

type Ctx = { params: Promise<{ id: string }> };

/** Send the current draft to one address (Lauren's, by default). */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = z.object({ to: z.string().email().optional() }).safeParse(await req.json().catch(() => ({})));
  const to = (body.success && body.data.to) || process.env.CONTACT_NOTIFY_TO;
  if (!to) return badRequest('No test address — set CONTACT_NOTIFY_TO or enter one');

  const { data } = await auth.db.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (!data) return badRequest('Newsletter not found', 404);
  try {
    await sendTest(auth.db, data as Newsletter, to, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data: { to } });
  } catch (error) {
    if (error instanceof NewsletterError) return badRequest(error.message);
    throw error;
  }
}
