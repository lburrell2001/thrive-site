export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

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
  const db = auth.db;

  const { data: existing } = await db
    .from('proposal_clients')
    .select('id')
    .eq('crm_contact_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, data: { id: existing.id } });

  const { data: contact } = await db.from('crm_contacts').select('*').eq('id', id).maybeSingle();
  if (!contact) return badRequest('Contact not found', 404);
  if (!contact.name) return badRequest('Give the contact a name first');

  const { data, error } = await db
    .from('proposal_clients')
    .insert({
      name: contact.name,
      company: contact.company,
      email: contact.email,
      phone: contact.phone,
      portal_client_id: contact.portal_client_id,
      crm_contact_id: id,
    })
    .select('id')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: { id: data.id } });
}
