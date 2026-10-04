export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { audienceFor, type Audience } from '@/lib/newsletter';

const AUDIENCES: Audience[] = ['subscribers', 'clients', 'leads', 'tag', 'prospects', 'prospect_tag', 'contacts'];

/**
 * How many people ?audience= (with ?tag=, or ?ids=a,b,c for hand-picked)
 * reaches, and the first few of them, so the editor can show who it is.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const audience = (url.searchParams.get('audience') ?? 'subscribers') as Audience;
  if (!AUDIENCES.includes(audience)) return badRequest('Unknown audience');
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const people = await audienceFor(auth.db, { audience, audience_tag: url.searchParams.get('tag'), audience_contact_ids: ids });
  return NextResponse.json({
    ok: true,
    data: { count: people.length, sample: people.slice(0, 6).map((p) => ({ id: p.id, name: p.name || p.email, company: p.company })) },
  });
}
