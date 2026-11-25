export const runtime = 'nodejs';

// Asset requests (075): a client's list (?client=<portal id>), everything not
// yet received (no query, for Home), and making a new one.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { AssetError, clientAssetRequests, createAssetRequest, waitingAssetRequests } from '@/lib/assetRequestRepo';
import { MAX_ITEMS } from '@/lib/assetRequests';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const client = new URL(req.url).searchParams.get('client');
  try {
    if (client) {
      if (!z.string().uuid().safeParse(client).success) return badRequest('Bad client');
      return NextResponse.json({ ok: true, data: { requests: await clientAssetRequests(auth.db, client) } });
    }
    return NextResponse.json({ ok: true, data: { requests: await waitingAssetRequests(auth.db) } });
  } catch (e) {
    return fail(e);
  }
}

const itemSchema = z.object({
  label: z.string().trim().min(1).max(160),
  hint: z.string().trim().max(500).nullable().optional(),
  required: z.boolean().optional(),
});

const schema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(1).max(160),
  note: z.string().trim().max(2000).nullable().default(null),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  notify: z.boolean().default(true),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Give it a name and add at least one thing you need');
  try {
    return NextResponse.json({ ok: true, data: await createAssetRequest(auth.db, parsed.data) });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof AssetError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
