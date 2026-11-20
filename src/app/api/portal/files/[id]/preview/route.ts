export const runtime = 'nodejs';

// The watermarked preview of a draft or locked final file (073), streamed to
// the signed-in client's own portal — never a link they could keep or share.
// The Files page draws it into a canvas.

import { NextResponse } from 'next/server';
import { requirePortalClient } from '@/lib/portalAuth';
import { DOC_BUCKET } from '@/lib/clientDocs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const { data: file } = await auth.db.from('portal_files').select('client_id, preview_path').eq('id', id).maybeSingle();
  if (!file || file.client_id !== auth.user.id || !file.preview_path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const dl = await auth.db.storage.from(DOC_BUCKET).download(file.preview_path);
  if (dl.error || !dl.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new Response(new Uint8Array(await dl.data.arrayBuffer()), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Robots-Tag': 'noindex',
    },
  });
}
