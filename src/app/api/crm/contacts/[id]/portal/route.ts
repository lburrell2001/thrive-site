export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Turn a contact into a portal client: create the login and profile, same
 * as "New client" on the Clients page, link it to this contact, and win
 * their open deal. Doing it
 * here rather than there means the link does not depend on email matching.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const db = auth.db;

  const { data: contact } = await db.from('crm_contacts').select('*').eq('id', id).maybeSingle();
  if (!contact) return badRequest('Contact not found', 404);
  if (contact.portal_client_id) return badRequest('This contact already has a portal account');
  if (!contact.email) return badRequest('Add an email address first — it is their portal login');

  const fullName: string = contact.name || contact.email;
  const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: contact.email,
    email_confirm: true,
  });
  if (createErr) return badRequest(createErr.message);
  const portalId = created.user.id;

  const { error: insertErr } = await db.from('portal_clients').insert({
    id: portalId,
    full_name: fullName,
    company_name: contact.company ?? '',
    initials,
    role: 'client',
  });
  if (insertErr) {
    await db.auth.admin.deleteUser(portalId);
    return badRequest(insertErr.message);
  }

  // The insert trigger links the login by email. If that picked a different
  // contact (a duplicate with the same address), move the link here, and
  // drop the contact if the trigger had to create one just now.
  const { data: linked } = await db
    .from('crm_contacts')
    .select('id, source, created_at')
    .eq('portal_client_id', portalId)
    .maybeSingle();
  if (linked && linked.id !== id) {
    const justCreated = linked.source === 'portal' && Date.now() - Date.parse(linked.created_at) < 60_000;
    if (justCreated) await db.from('crm_contacts').delete().eq('id', linked.id);
    else await db.from('crm_contacts').update({ portal_client_id: null }).eq('id', linked.id);
  }

  const { error: linkErr } = await db
    .from('crm_contacts')
    .update({ portal_client_id: portalId })
    .eq('id', id);
  if (linkErr) return badRequest(linkErr.message);

  // A portal login means the work was won: the open deal if there is one,
  // otherwise a won deal so the client shows on the board.
  const { data: open } = await db
    .from('crm_deals')
    .select('id')
    .eq('contact_id', id)
    .in('stage', ['lead', 'contacted', 'proposal'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) {
    await db.from('crm_deals').update({ stage: 'won' }).eq('id', open.id);
  } else {
    const { count } = await db.from('crm_deals').select('id', { count: 'exact', head: true }).eq('contact_id', id);
    if (!count) {
      await db.from('crm_deals').insert({
        contact_id: id,
        title: contact.company || fullName,
        stage: 'won',
        source: 'portal',
      });
    }
  }

  // Proposal recipients for this person should know about the login too.
  await db
    .from('proposal_clients')
    .update({ portal_client_id: portalId })
    .eq('crm_contact_id', id)
    .is('portal_client_id', null);

  return NextResponse.json({ ok: true, data: { portal_client_id: portalId } });
}
