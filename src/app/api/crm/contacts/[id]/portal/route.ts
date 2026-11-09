export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { makePortalClient } from '@/lib/portalClient';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Turn a contact into a portal client: create the login and profile, same
 * as "New client" on the Clients page, and link it to this contact
 * (src/lib/portalClient.ts). Doing it here rather than there means the link
 * does not depend on email matching.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;

  const { data: contact } = await db.from('crm_contacts').select('portal_client_id').eq('id', id).maybeSingle();
  if (!contact) return badRequest('Contact not found', 404);
  if (contact.portal_client_id) return badRequest('This contact already has a portal account');

  // A login on its own does not move the deal (migration 036): projects,
  // proposals and invoices added in Clients move it to Proposal sent, and a
  // paid invoice wins it.
  const result = await makePortalClient(db, id);
  if (!result.ok) return badRequest(result.error);
  return NextResponse.json({ ok: true, data: { portal_client_id: result.portalId } });
}
