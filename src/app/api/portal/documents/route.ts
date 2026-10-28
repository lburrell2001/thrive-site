import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signDocs } from '@/lib/clientDocs';

// The signed-in client's proposals and delivered files, with links to the
// private documents signed for an hour. The portal reads these here instead of
// from the tables directly, because only the server can sign the links.
export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Unavailable' }, { status: 500 });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [files, proposals] = await Promise.all([
    db.from('portal_files').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    db.from('portal_proposals').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
  ]);
  if (files.error || proposals.error) {
    console.error('[portal documents]', files.error?.message ?? proposals.error?.message);
    return NextResponse.json({ error: 'Could not load documents' }, { status: 500 });
  }

  return NextResponse.json(
    {
      files: await signDocs(db, files.data, ['file_url']),
      proposals: await signDocs(db, proposals.data, ['file_url', 'signed_file_url']),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
