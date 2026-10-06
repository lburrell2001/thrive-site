export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { MarketingError, addRecipients, addRecipientsSchema, outcomeSchema, setOutcome } from '@/lib/marketing';

type Ctx = { params: Promise<{ id: string }> };

const fail = (error: unknown) => badRequest(error instanceof Error ? error.message : 'Could not update');

/** Add people: picked contacts, every prospect with a tag, or every prospect. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = addRecipientsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  try {
    return NextResponse.json({ ok: true, data: { added: await addRecipients(auth.db, id, parsed.data) } });
  } catch (error) {
    if (error instanceof MarketingError) return badRequest(error.message);
    return fail(error);
  }
}

/** Mark how someone responded (or didn't). */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = outcomeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  try {
    await setOutcome(auth.db, id, parsed.data);
    return NextResponse.json({ ok: true, data: null });
  } catch (error) {
    return fail(error);
  }
}

/** Take someone off the list (?contact=<id>). */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const contact = z.string().uuid().safeParse(new URL(req.url).searchParams.get('contact'));
  if (!contact.success) return badRequest('Which contact?');
  const { error } = await auth.db.from('marketing_recipients').delete().eq('campaign_id', id).eq('contact_id', contact.data);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: null });
}
