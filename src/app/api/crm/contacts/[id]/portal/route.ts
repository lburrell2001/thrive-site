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

  // Making them a client moves their open deal (the most recent one at New
  // lead or Contacted) to Quote sent. Only a paid invoice wins it (036);
  // stages never move backward. The stage trigger logs the change.
  const result = await makePortalClient(db, id);
  if (!result.ok) return badRequest(result.error);
  const { data: deal } = await db.from('crm_deals').select('id, title').eq('contact_id', id).in('stage', ['lead', 'contacted'])
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (deal) await db.from('crm_deals').update({ stage: 'proposal' }).eq('id', deal.id);
  return NextResponse.json({ ok: true, data: { portal_client_id: result.portalId, moved_deal: deal?.title ?? null } });
}
