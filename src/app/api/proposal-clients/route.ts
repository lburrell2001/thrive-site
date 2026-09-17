export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { normalizePhone } from '@/lib/phone';
import { createClientSchema } from '@/lib/proposalWriteSchemas';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from('proposal_clients')
    .select('*')
    .order('name');

  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const phone = normalizePhone(parsed.data.phone);
  if (parsed.data.phone?.trim() && !phone) {
    return badRequest('Enter a valid mobile number, e.g. (555) 123-4567');
  }

  const { data, error } = await auth.db
    .from('proposal_clients')
    .insert({
      name: parsed.data.name,
      company: parsed.data.company ?? null,
      email: parsed.data.email ?? null,
      phone,
      sms_opt_in: Boolean(phone && parsed.data.sms_opt_in),
    })
    .select('*')
    .single();

  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
