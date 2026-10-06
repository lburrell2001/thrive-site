export const runtime = 'nodejs';

import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/adminAuth';
import { BOT_UA, deviceOf } from '@/lib/trafficSource';

/**
 * A print campaign's QR code / short link: thrivecreativestudios.org/m/<code>.
 * Logs the scan, then sends the visitor to the campaign's page tagged
 * utm_source=print&utm_medium=<piece>&utm_campaign=<code>, so the visit and
 * any inquiry that follows are credited to the campaign. An unknown code
 * still lands on the homepage — a misprinted card should never show an error.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const site = new URL(req.url).origin;
  const clean = code.toLowerCase().slice(0, 42);
  const db = serviceClient();
  const { data: c } = await db.from('marketing_campaigns').select('id, piece, destination').eq('code', clean).maybeSingle();
  if (!c) return NextResponse.redirect(`${site}/`, 302);

  const ua = req.headers.get('user-agent') ?? '';
  // Link previews and crawlers aren't scans.
  if (ua && !BOT_UA.test(ua)) {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
    const day = new Date().toISOString().slice(0, 10);
    const key = process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'thrive';
    const visitor = createHmac('sha256', key).update(`${day}|${ip}|${ua}`).digest('hex').slice(0, 24);
    await db.from('marketing_scans').insert({ campaign_id: c.id, visitor, device: deviceOf(ua) });
  }

  const to = new URL(c.destination || '/', site);
  to.searchParams.set('utm_source', 'print');
  to.searchParams.set('utm_medium', c.piece);
  to.searchParams.set('utm_campaign', clean);
  const res = NextResponse.redirect(to, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}
