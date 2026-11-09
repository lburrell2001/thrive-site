export const runtime = 'nodejs';

// The signed-in client's proposals built in admin (the /p/… documents), for
// the portal's Proposals page: published ones only, with the link to read and
// sign them. The link carries the proposal's access token, which this client
// is entitled to — it's their proposal.

import { NextResponse } from 'next/server';
import { requirePortalClient } from '@/lib/portalAuth';

export async function GET(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const { data: recipients } = await db.from('proposal_clients').select('id').eq('portal_client_id', auth.user.id);
  const ids = (recipients ?? []).map((r) => r.id);
  if (!ids.length) return NextResponse.json({ proposals: [] });

  const { data, error } = await db.from('proposals')
    .select('id, slug, access_token, title, status, total_cents, currency, deposit_percent, sent_at, signed_at, declined_at, valid_until')
    .in('client_id', ids)
    .in('status', ['sent', 'viewed', 'signed', 'declined', 'expired'])
    .order('sent_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: 'Could not load your proposals' }, { status: 500 });

  return NextResponse.json({
    proposals: (data ?? []).map(({ access_token, slug, ...p }) => ({ ...p, href: `/p/${slug}?t=${encodeURIComponent(access_token)}&from=portal` })),
  });
}
