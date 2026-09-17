export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { normalizePhone } from '@/lib/phone';
import { updateClientContactSchema } from '@/lib/proposalWriteSchemas';

type Ctx = { params: Promise<{ id: string }> };

/** Update a recipient's mobile number and text consent. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = updateClientContactSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const update: Record<string, unknown> = {};
  if (parsed.data.phone !== undefined) {
    const phone = normalizePhone(parsed.data.phone);
    if (parsed.data.phone?.trim() && !phone) {
      return badRequest('Enter a valid mobile number, e.g. (555) 123-4567');
    }
    update.phone = phone;
    if (!phone) update.sms_opt_in = false;
  }
  if (parsed.data.sms_opt_in !== undefined && update.sms_opt_in === undefined) {
    update.sms_opt_in = parsed.data.sms_opt_in;
  }

  const { data, error } = await auth.db
    .from('proposal_clients')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return badRequest(error.message);
  if (!data) return badRequest('Client not found', 404);
  return NextResponse.json({ ok: true, data });
}
