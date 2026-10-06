export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { postalAddress } from '@/lib/newsletter';
import { prospectContact, prospectDraft, prospectHistory } from '@/lib/prospects';

type Ctx = { params: Promise<{ id: string }> };

/** Everything the send dialog needs about one contact. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const [contact, history, address, draft] = await Promise.all([
    prospectContact(auth.db, id),
    prospectHistory(auth.db, id),
    postalAddress(auth.db),
    prospectDraft(auth.db, id),
  ]);
  if (!contact) return badRequest('Contact not found', 404);
  return NextResponse.json({ ok: true, data: { contact, history, address, draft } });
}
