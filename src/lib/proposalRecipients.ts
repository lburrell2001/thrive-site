// The proposal recipient (proposal_clients row) for a portal client or a CRM
// contact, created when they have none yet. Used by "New proposal" from a
// client's project, from a contact, and by "Turn into proposal" on an estimate.

import type { SupabaseClient } from '@supabase/supabase-js';

type Result = { id: string } | { error: string };

export async function recipientForPortalClient(db: SupabaseClient, clientId: string): Promise<Result> {
  const { data: contact } = await db.from('crm_contacts').select('id, name, company, email, phone').eq('portal_client_id', clientId).limit(1).maybeSingle();
  const filter = contact ? `portal_client_id.eq.${clientId},crm_contact_id.eq.${contact.id}` : `portal_client_id.eq.${clientId}`;
  const { data: existing } = await db.from('proposal_clients').select('id').or(filter).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return { id: existing.id };

  const [{ data: profile }, { data: authData }] = await Promise.all([
    db.from('portal_clients').select('full_name, company_name, phone').eq('id', clientId).maybeSingle(),
    db.auth.admin.getUserById(clientId),
  ]);
  if (!profile && !contact) return { error: 'Client not found' };
  const name = contact?.name || profile?.full_name || profile?.company_name || authData?.user?.email || 'Client';
  const { data, error } = await db.from('proposal_clients').insert({
    name,
    company: contact?.company || profile?.company_name || null,
    email: contact?.email || authData?.user?.email || null,
    phone: contact?.phone || profile?.phone || null,
    portal_client_id: clientId,
    crm_contact_id: contact?.id ?? null,
  }).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function recipientForContact(db: SupabaseClient, contactId: string): Promise<Result> {
  const { data: existing } = await db.from('proposal_clients').select('id').eq('crm_contact_id', contactId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return { id: existing.id };

  const { data: contact } = await db.from('crm_contacts').select('*').eq('id', contactId).maybeSingle();
  if (!contact) return { error: 'Contact not found' };
  if (!contact.name) return { error: 'Give the contact a name first' };
  const { data, error } = await db.from('proposal_clients').insert({
    name: contact.name,
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    portal_client_id: contact.portal_client_id,
    crm_contact_id: contactId,
  }).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id };
}
