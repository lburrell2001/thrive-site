export const runtime = 'nodejs';

// "Send" a proposal: publish it, then email the client a button to it (from
// Lauren's Outlook when connected). The proposal page has their estimate in
// it, the PDF and "Approve and sign" at the bottom; signing makes the invoice.

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { proposalClientContact } from '@/lib/clientNotify';
import { sendProposalEmail, proposalSendSchema } from '@/lib/proposalSend';

type Ctx = { params: Promise<{ id: string }> };

/** Who it would go to, for the Send dialog. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data: p } = await auth.db.from('proposals').select('client_id').eq('id', id).maybeSingle();
  if (!p) return badRequest('Proposal not found', 404);
  const contact = p.client_id ? await proposalClientContact(auth.db, p.client_id) : null;
  return NextResponse.json({ ok: true, data: { email: contact?.email ?? '', name: contact?.name ?? '' } });
}


export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;
  const parsed = proposalSendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const sent = await sendProposalEmail(db, id, parsed.data);
  if (!sent.ok) return badRequest(sent.error, sent.status);
  return NextResponse.json({ ok: true, data: { to: sent.to, url: sent.url } });
}
