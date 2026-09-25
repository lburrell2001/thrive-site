export const runtime = 'nodejs';

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { storageUrl } from '@/lib/storage';

// Under Vercel's 4.5 MB request limit. Email images should be far smaller
// anyway — the editor warns above 1 MB.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);

/**
 * Upload an image for a newsletter (a Canva or Adobe Express export) to the
 * public bucket, and return its URL. Emails load images from the web, so
 * they must be public; nothing private belongs here.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('Expected multipart form data');
  }
  const file = form.get('file');
  if (!(file instanceof File)) return badRequest('No file supplied');
  if (file.size > MAX_BYTES) return badRequest('Images must be 4 MB or smaller — export a JPG from Canva, or use a smaller size');
  const ext = ALLOWED.get(file.type);
  // WebP doesn't display in some Outlook versions; allow it but JPG/PNG are safest.
  if (!ext) return badRequest('Use a JPG, PNG or GIF');

  const path = `newsletters/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const { error } = await auth.db.storage.from('course-media').upload(path, file, { contentType: file.type });
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data: { url: storageUrl(path), bytes: file.size } });
}
