export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadContactList } from '@/lib/crmRepo';
import { createContactSchema } from '@/lib/crmSchemas';
import { normalizePhone } from '@/lib/phone';

/** Every contact, with deal counts, for the Contacts list and deal picker. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadContactList(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load contacts', 500);
  }
}

/** Add a contact by hand — a referral, someone met at an event — optionally with a first deal. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = createContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const { deal, ...fields } = parsed.data;

  const phone = normalizePhone(fields.phone);
  if (fields.phone && !phone) return badRequest('Enter a valid phone number, e.g. (555) 123-4567');

  if (fields.email) {
    const { data: existing } = await auth.db
      .from('crm_contacts')
      .select('id, name')
      .eq('email', fields.email)
      .limit(1)
      .maybeSingle();
    if (existing) return badRequest(`${existing.name || 'A contact'} already has that email`, 409);
  }

  const { data: contact, error } = await auth.db
    .from('crm_contacts')
    .insert({ ...fields, phone })
    .select('*')
    .single();
  if (error) return badRequest(error.message);

  let dealId: string | null = null;
  if (deal) {
    const { data: created, error: dealError } = await auth.db
      .from('crm_deals')
      .insert({ contact_id: contact.id, title: deal.title, stage: deal.stage, value_cents: deal.value_cents ?? null, source: 'manual' })
      .select('id')
      .single();
    if (dealError) return badRequest(dealError.message);
    dealId = created.id;
  }

  return NextResponse.json({ ok: true, data: { contact, deal_id: dealId } });
}
