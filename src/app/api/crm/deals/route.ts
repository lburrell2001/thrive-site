export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { loadDealBoard } from '@/lib/crmRepo';
import { createDealSchema } from '@/lib/crmSchemas';

/** Every deal, with its contact and flags, for the pipeline board. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadDealBoard(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load deals', 500);
  }
}

const createSchema = createDealSchema.extend({ contact_id: z.string().uuid() });

/** A new piece of work with an existing contact. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { data, error } = await auth.db
    .from('crm_deals')
    .insert({
      contact_id: parsed.data.contact_id,
      title: parsed.data.title,
      stage: parsed.data.stage,
      value_cents: parsed.data.value_cents ?? null,
      source: 'manual',
    })
    .select('*')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
