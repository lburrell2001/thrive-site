export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { recipientForContact } from '@/lib/proposalRecipients';

type Ctx = { params: Promise<{ id: string }> };

/**
 * The proposal recipient record for this contact, created if they have
 * none yet, so "New proposal" can start with them selected. The link is set
 * explicitly rather than left to the email-matching trigger.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await recipientForContact(auth.db, id);
  if ('error' in result) return badRequest(result.error, result.error === 'Contact not found' ? 404 : 400);
  return NextResponse.json({ ok: true, data: { id: result.id } });
}
