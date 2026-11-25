export const runtime = 'nodejs';

// One asset request (075): mark received, reopen, edit, add or remove items, delete.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { AssetError, deleteAssetRequest, updateAssetRequest } from '@/lib/assetRequestRepo';
import { MAX_ITEMS } from '@/lib/assetRequests';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const item = z.object({ label: z.string().trim().min(1).max(160), hint: z.string().trim().max(500).nullable().optional(), required: z.boolean().optional() });

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('received') }),
  z.object({ action: z.literal('reopen'), note: z.string().trim().max(2000).nullable().optional(), notify: z.boolean().optional() }),
  z.object({
    action: z.literal('edit'),
    title: z.string().trim().min(1).max(160).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
  }),
  z.object({ action: z.literal('add_items'), items: z.array(item).min(1).max(MAX_ITEMS), notify: z.boolean().optional() }),
  z.object({ action: z.literal('remove_item'), itemId: z.string().uuid() }),
]);

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return badRequest('Bad request');
  try {
    return NextResponse.json({ ok: true, data: await updateAssetRequest(auth.db, id, parsed.data) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return badRequest('Bad request');
  try {
    await deleteAssetRequest(auth.db, id);
    return NextResponse.json({ ok: true, data: {} });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof AssetError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
