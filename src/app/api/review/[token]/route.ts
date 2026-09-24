export const runtime = 'nodejs';

import { NextResponse, after } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { submitReviewSchema } from '@/lib/reviews';
import { textAgency } from '@/lib/sms';

type Ctx = { params: Promise<{ token: string }> };

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** A client submitting the review form behind their private link. */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return fail('This review link is not valid', 404);

  const parsed = submitReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form');

  const db = serviceClient();
  const { data: review } = await db.from('reviews').select('id, status').eq('token', token).maybeSingle();
  if (!review) return fail('This review link is not valid', 404);
  if (review.status !== 'requested') return fail('This review has already been sent — thank you!', 409);

  const { error } = await db
    .from('reviews')
    .update({ ...parsed.data, status: 'submitted' })
    .eq('id', review.id)
    .eq('status', 'requested');
  if (error) return fail('Something went wrong — please try again', 500);

  after(() => textAgency(`New ${parsed.data.rating}★ review from ${parsed.data.display_name} — approve it in admin.`));
  return NextResponse.json({ ok: true });
}
