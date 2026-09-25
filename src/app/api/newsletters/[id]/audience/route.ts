export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { audienceFor, type Audience } from '@/lib/newsletter';

/** How many subscribed contacts ?audience= (and ?tag=) reaches. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const audience = (url.searchParams.get('audience') ?? 'subscribers') as Audience;
  if (!['subscribers', 'clients', 'leads', 'tag'].includes(audience)) return badRequest('Unknown audience');
  const people = await audienceFor(auth.db, { audience, audience_tag: url.searchParams.get('tag') });
  return NextResponse.json({ ok: true, data: { count: people.length } });
}
