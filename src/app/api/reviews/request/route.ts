export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { ReviewError, requestReview, requestReviewSchema } from '@/lib/reviews';

/** "Ask for a review" on a CRM deal or contact. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = requestReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  try {
    const result = await requestReview(auth.db, parsed.data, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof ReviewError) return badRequest(error.message);
    throw error;
  }
}
