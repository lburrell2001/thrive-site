export const runtime = 'nodejs';

// Send an estimate: a short email in the Thrive layout, from her Outlook when
// it's connected, with a button to the estimate's own page (/e/<id>?t=…,
// migration 051) where the client can export the PDF or accept it. The PDF
// (made in the browser, exactly what Lauren sees) is attached too. Marks a
// draft estimate Sent, remembers who it went to, and logs it on the timeline.

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { amendedFrom, estimateRecipient, loadEstimate, sendEstimateEmail, estimateSendSchema } from '@/lib/estimateSend';
import { formatLineMoney } from '@/lib/lineItems';
import { SITE_URL } from '@/lib/seo';

type Ctx = { params: Promise<{ id: string }> };

/** Who it would go to, for the Send dialog. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const est = await loadEstimate(auth.db, id);
  if (!est) return badRequest('Estimate not found', 404);
  const { contact } = await estimateRecipient(auth.db, est);
  // For "Text": their mobile and what the message needs (the private link, the total, what it was).
  const was = await amendedFrom(auth.db, id, est.total_cents);
  return NextResponse.json({ ok: true, data: {
    email: contact?.email ?? '', name: contact?.name || est.client_name, phone: contact?.phone ?? '',
    link: est.access_token ? `${SITE_URL}/e/${id}?t=${est.access_token}` : '',
    total: formatLineMoney(est.total_cents), was, title: est.title,
  } });
}


export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;

  const parsed = estimateSendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const sent = await sendEstimateEmail(db, id, parsed.data);
  if (!sent.ok) return badRequest(sent.error, sent.status);
  return NextResponse.json({ ok: true, data: { to: sent.to } });
}
