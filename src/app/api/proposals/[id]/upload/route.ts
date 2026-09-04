export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { PROPOSAL_BUCKET, signImageUrls } from '@/lib/proposalRepo';

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

/** Strip anything that could climb out of the block's own folder. */
function safeName(name: string, fallbackExt: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 80);
  return cleaned && /\.[a-z0-9]+$/.test(cleaned) ? cleaned : `image-${Date.now()}.${fallbackExt}`;
}

/**
 * Upload one image into the private proposal-media bucket at
 * proposals/{proposal_id}/{block_id}/{filename} and return both the storage
 * path (which is what gets stored in block content) and a signed URL for
 * the builder to preview immediately.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('Expected multipart form data');
  }

  const file = form.get('file');
  const blockId = String(form.get('blockId') ?? '');

  if (!(file instanceof File)) return badRequest('No file supplied');
  if (!/^[0-9a-f-]{36}$/i.test(blockId)) return badRequest('A valid blockId is required');
  if (file.size > MAX_BYTES) return badRequest('Images must be 12 MB or smaller');

  const extension = ALLOWED.get(file.type);
  if (!extension) return badRequest('Images must be JPEG, PNG, WebP, or AVIF');

  const { data: exists } = await auth.db
    .from('proposals')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!exists) return badRequest('Proposal not found', 404);

  const path = `proposals/${id}/${blockId}/${safeName(file.name, extension)}`;

  const { error } = await auth.db.storage
    .from(PROPOSAL_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) return badRequest(error.message);

  const urls = await signImageUrls(auth.db, [path]);
  return NextResponse.json({ ok: true, data: { path, url: urls[path] ?? null } });
}
