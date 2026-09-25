export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { NewsletterError, postalAddress, setPostalAddress } from '@/lib/newsletter';

/** The mailing address, and how many people are on the list. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const count = async (status: string) =>
    (await auth.db.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('newsletter_status', status)).count ?? 0;
  const [address, subscribed, pending, unsubscribed] = await Promise.all([
    postalAddress(auth.db), count('subscribed'), count('pending'), count('unsubscribed'),
  ]);
  return NextResponse.json({ ok: true, data: { address, subscribed, pending, unsubscribed } });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = z.object({ address: z.string().trim().min(8, 'Enter a full mailing address').max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid address');
  try {
    await setPostalAddress(auth.db, parsed.data.address);
    return NextResponse.json({ ok: true, data: { address: parsed.data.address } });
  } catch (error) {
    if (error instanceof NewsletterError) return badRequest(error.message);
    throw error;
  }
}
