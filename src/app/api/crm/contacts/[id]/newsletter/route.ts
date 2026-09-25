export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion('status', [
  // Adding someone by hand needs a record of how they agreed.
  z.object({ status: z.literal('subscribed'), consent_note: z.string().trim().min(3, 'Note how they agreed, e.g. "Said yes on our call"').max(300) }),
  z.object({ status: z.literal('unsubscribed') }),
]);

/** Subscribe a contact who agreed another way, or unsubscribe them. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data: contact } = await auth.db.from('crm_contacts').select('email').eq('id', id).maybeSingle();
  if (!contact) return badRequest('Contact not found', 404);
  if (parsed.data.status === 'subscribed' && !contact.email) return badRequest('Add an email address first');

  const update = parsed.data.status === 'subscribed'
    ? { newsletter_status: 'subscribed', newsletter_source: 'admin', newsletter_consent_note: parsed.data.consent_note }
    : { newsletter_status: 'unsubscribed' };
  const { data, error } = await auth.db.from('crm_contacts').update(update).eq('id', id).select('*').single();
  if (error) return badRequest(error.message);

  await auth.db.from('crm_activities').insert({
    contact_id: id,
    kind: 'note',
    body: parsed.data.status === 'subscribed'
      ? `Added to the newsletter. How they agreed: ${parsed.data.consent_note}`
      : 'Removed from the newsletter.',
  });
  return NextResponse.json({ ok: true, data });
}
