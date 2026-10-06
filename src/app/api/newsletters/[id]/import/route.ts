export const runtime = 'nodejs';
// Re-hosting a design's images can take a little while.
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { ImportError, importDesign } from '@/lib/newsletterImport';

type Ctx = { params: Promise<{ id: string }> };

// Under Vercel's 4.5 MB request body limit.
const MAX_UPLOAD = 4 * 1024 * 1024;

/** Import a Canva Email export (.zip of HTML and images, or .html) into a draft. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { data: n } = await auth.db.from('newsletters').select('status').eq('id', id).maybeSingle();
  if (!n) return badRequest('Newsletter not found', 404);
  if (n.status === 'sent' || n.status === 'sending') return badRequest('A sent newsletter can’t be changed — duplicate it first', 409);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('Expected a file upload');
  }
  const file = form.get('file');
  if (!(file instanceof File)) return badRequest('No file supplied');
  if (file.size > MAX_UPLOAD) {
    return badRequest('That file is over 4 MB. In Canva, compress images before downloading, or use fewer or smaller images.');
  }

  try {
    const result = await importDesign(auth.db, id, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    const { data, error } = await auth.db
      .from('newsletters')
      .update({ html: result.html, html_meta: result.meta, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return badRequest(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof ImportError) return badRequest(error.message);
    throw error;
  }
}

/** Remove the imported design and go back to the builder. */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data, error } = await auth.db
    .from('newsletters')
    .update({ html: null, html_meta: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'failed', 'scheduled'])
    .select('*')
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!data) return badRequest('A sent newsletter can’t be changed', 409);
  return NextResponse.json({ ok: true, data });
}
