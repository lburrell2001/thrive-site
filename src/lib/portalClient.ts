// Turning a CRM contact into a portal client, and giving a deal its portal
// project. Used by "Make portal client" on a contact and by the pipeline's
// New deal ("Add to Clients with a project").
//
// Creating the login sends nothing: the client hears from Thrive only when
// Lauren sends something (an invoice, a questionnaire, the sign-in link).

import type { SupabaseClient } from '@supabase/supabase-js';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function makePortalClient(db: SupabaseClient, contactId: string): Promise<Result<{ portalId: string; created: boolean }>> {
  const { data: contact } = await db.from('crm_contacts').select('*').eq('id', contactId).maybeSingle();
  if (!contact) return { ok: false, error: 'Contact not found' };
  if (contact.portal_client_id) return { ok: true, portalId: contact.portal_client_id, created: false };
  if (!contact.email) return { ok: false, error: 'Add an email address first — it is their portal login' };

  const fullName: string = contact.name || contact.email;
  const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const { data: made, error: createErr } = await db.auth.admin.createUser({ email: contact.email, email_confirm: true, user_metadata: { portal_welcome: 'pending' } });
  if (createErr) return { ok: false, error: createErr.message };
  const portalId = made.user.id;

  const { error: insertErr } = await db.from('portal_clients').insert({
    id: portalId,
    full_name: fullName,
    company_name: contact.company ?? '',
    initials,
    role: 'client',
  });
  if (insertErr) {
    await db.auth.admin.deleteUser(portalId);
    return { ok: false, error: insertErr.message };
  }

  // The insert trigger links the login by email. If that picked a different
  // contact (a duplicate with the same address), move the link here, and
  // drop the contact if the trigger had to create one just now.
  const { data: linked } = await db.from('crm_contacts').select('id, source, created_at').eq('portal_client_id', portalId).maybeSingle();
  if (linked && linked.id !== contactId) {
    const justCreated = linked.source === 'portal' && Date.now() - Date.parse(linked.created_at) < 60_000;
    if (justCreated) await db.from('crm_contacts').delete().eq('id', linked.id);
    else await db.from('crm_contacts').update({ portal_client_id: null }).eq('id', linked.id);
  }

  const { error: linkErr } = await db.from('crm_contacts').update({ portal_client_id: portalId }).eq('id', contactId);
  if (linkErr) return { ok: false, error: linkErr.message };

  // Proposal recipients for this person should know about the login too.
  await db.from('proposal_clients').update({ portal_client_id: portalId }).eq('crm_contact_id', contactId).is('portal_client_id', null);

  return { ok: true, portalId, created: true };
}

/**
 * The deal's contact as a portal client (made if needed) with a project named
 * after the deal and filed under it. Leaves the deal's stage alone.
 */
export async function addDealProject(db: SupabaseClient, dealId: string): Promise<Result<{ portalId: string; projectId: string; createdClient: boolean }>> {
  const { data: deal } = await db.from('crm_deals').select('id, contact_id, title').eq('id', dealId).maybeSingle();
  if (!deal) return { ok: false, error: 'Deal not found' };

  const client = await makePortalClient(db, deal.contact_id);
  if (!client.ok) return client;

  const name = (deal.title ?? '').trim() || 'Client work';
  const { data: existing } = await db.from('portal_projects').select('id').eq('client_id', client.portalId).eq('crm_deal_id', dealId).limit(1).maybeSingle();
  if (existing) return { ok: true, portalId: client.portalId, projectId: existing.id, createdClient: client.created };

  const { data: projectId, error } = await db.rpc('create_deal_project', { p_client: client.portalId, p_deal: dealId, p_name: name });
  if (error) {
    return { ok: false, error: /create_deal_project/.test(error.message) ? 'Run migration 048 in Supabase to add deal projects.' : error.message };
  }
  return { ok: true, portalId: client.portalId, projectId: projectId as string, createdClient: client.created };
}
