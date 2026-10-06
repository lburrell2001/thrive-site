export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { MarketingError, createCampaignSchema, loadCampaigns, uniqueCode } from '@/lib/marketing';

/** Every campaign, print and email, with what came of it. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, data: await loadCampaigns(auth.db) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not load campaigns', 500);
  }
}

/** Log a print campaign. Its short-link code comes from the name. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = createCampaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  try {
    const code = await uniqueCode(auth.db, parsed.data.name);
    const { data, error } = await auth.db.from('marketing_campaigns').insert({ ...parsed.data, code }).select('id').single();
    if (error) throw new MarketingError(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not create the campaign');
  }
}
