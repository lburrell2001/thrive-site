export const runtime = 'nodejs';

// One of the client's asset requests (075): get an upload link, attach or
// remove a file, save an item's link / note / "I don't have this", and send it.
// Every action checks the request is theirs and not closed.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import {
  AssetError, attachAssetFile, removeAssetFile, saveAssetItem, signAssetUpload, submitAssetRequest,
} from '@/lib/assetRequestRepo';

type Ctx = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const file = z.object({ name: z.string().min(1).max(300), size: z.number().int().positive(), type: z.string().max(200) });

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('upload_url'), itemId: z.string().uuid(), file }),
  z.object({ action: z.literal('attach'), itemId: z.string().uuid(), file: file.extend({ path: z.string().min(1).max(500) }) }),
  z.object({ action: z.literal('remove_file'), itemId: z.string().uuid(), path: z.string().min(1).max(500) }),
  z.object({
    action: z.literal('save'),
    itemId: z.string().uuid(),
    link: z.string().max(1000).nullable().optional(),
    client_note: z.string().max(2000).nullable().optional(),
    unavailable: z.boolean().optional(),
  }),
  z.object({ action: z.literal('submit') }),
]);

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !parsed.success) return json({ error: 'Bad request' }, 400);
  const { db, user } = auth;
  try {
    const b = parsed.data;
    switch (b.action) {
      case 'upload_url':
        return json({ ok: true, upload: await signAssetUpload(db, user.id, id, b.itemId, b.file) });
      case 'attach':
        await attachAssetFile(db, user.id, id, b.itemId, b.file);
        return json({ ok: true });
      case 'remove_file':
        await removeAssetFile(db, user.id, id, b.itemId, b.path);
        return json({ ok: true });
      case 'save':
        await saveAssetItem(db, user.id, id, b.itemId, b);
        return json({ ok: true });
      case 'submit': {
        const r = await submitAssetRequest(db, user.id, id);
        return r.ok ? json({ ok: true }) : json({ error: 'A few things still need a file, a link or a note.', missing: r.missing }, 422);
      }
    }
  } catch (e) {
    if (e instanceof AssetError) return json({ error: e.message }, e.status);
    console.error('[portal asset request]', e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
