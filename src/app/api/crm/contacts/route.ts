export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadBoard } from '@/lib/crmRepo';
import { createContactSchema } from '@/lib/crmSchemas';
import { normalizePhone } from '@/lib/phone';

/** Every contact, with task, inquiry and proposal flags for the board. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadBoard(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load contacts', 500);
  }
}

/** Add a contact by hand — a referral, someone met at an event. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = createContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const phone = normalizePhone(parsed.data.phone);
  if (parsed.data.phone && !phone) return badRequest('Enter a valid phone number, e.g. (555) 123-4567');

  if (parsed.data.email) {
    const { data: existing } = await auth.db
      .from('crm_contacts')
      .select('id, name')
      .eq('email', parsed.data.email)
      .limit(1)
      .maybeSingle();
    if (existing) return badRequest(`${existing.name || 'A contact'} already has that email`, 409);
  }

  const { data, error } = await auth.db
    .from('crm_contacts')
    .insert({ ...parsed.data, phone, value_cents: parsed.data.value_cents ?? null })
    .select('*')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
