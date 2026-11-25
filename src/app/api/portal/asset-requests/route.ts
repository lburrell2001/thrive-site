export const runtime = 'nodejs';

// The signed-in client's asset requests (075), with links to what they've sent.

import { NextResponse } from 'next/server';
import { requirePortalClient } from '@/lib/portalAuth';
import { myAssetRequests } from '@/lib/assetRequestRepo';

export async function GET(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ requests: await myAssetRequests(auth.db, auth.user.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load your requests' }, { status: 500 });
  }
}
