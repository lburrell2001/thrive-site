export const runtime = 'nodejs';

// Admin: what a client has done in the portal (migration 059, src/lib/portalUsage.ts).

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { portalUsage } from '@/lib/portalUsage';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const client = url.searchParams.get('client') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(client)) return badRequest('Missing client');
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  return NextResponse.json({ ok: true, data: { usage: await portalUsage(auth.db, client, days) } });
}
