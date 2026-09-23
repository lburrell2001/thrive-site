export const runtime = 'nodejs';

// Page view beacon for the admin analytics dashboard.
//
// Public and unauthenticated, so it trusts nothing: every field is
// length-capped, bots are dropped, and the source is classified here rather
// than by the browser. The visitor id is an HMAC of IP + user agent + the
// day — the IP itself is never stored.

import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serviceClient } from '@/lib/adminAuth';
import { BOT_UA, classifyVisit, deviceOf } from '@/lib/trafficSource';

const text = (max: number) =>
  z.string().max(2000).nullish().transform((v) => (v ? v.slice(0, max) : null));

const pageviewSchema = z.object({
  t: z.literal('pv'),
  sid: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  path: z.string().startsWith('/').max(300),
  landing: z.boolean(),
  ref: text(500),
  utm_source: text(100),
  utm_medium: text(100),
  utm_campaign: text(150),
  utm_content: text(150),
  utm_term: text(150),
  click: z.enum(['gclid', 'fbclid', 'msclkid']).nullish(),
});

const engageSchema = z.object({
  t: z.literal('engage'),
  id: z.string().uuid(),
  sid: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  ms: z.number().int().min(0),
});

const bodySchema = z.discriminatedUnion('t', [pageviewSchema, engageSchema]);

// Pages that are private or not part of the marketing site.
const EXCLUDED = /^\/(admin|portal|p\/|api\/|_next\/)/;

function visitorHash(ip: string, ua: string) {
  const day = new Date().toISOString().slice(0, 10);
  const key = process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'thrive';
  return createHmac('sha256', key).update(`${day}|${ip}|${ua}`).digest('hex').slice(0, 24);
}

function header(req: Request, name: string) {
  const v = req.headers.get(name);
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 80);
  } catch {
    return v.slice(0, 80);
  }
}

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT_UA.test(ua)) return noContent();

  // sendBeacon posts text/plain; parse it ourselves.
  let raw: unknown;
  try {
    const body = await req.text();
    if (body.length > 4000) return noContent();
    raw = JSON.parse(body);
  } catch {
    return noContent();
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return noContent();

  let db;
  try {
    db = serviceClient();
  } catch {
    return noContent();
  }

  const data = parsed.data;

  if (data.t === 'engage') {
    // Cap at 30 minutes: a tab left open overnight is not engagement.
    await db
      .from('site_pageviews')
      .update({ engaged_ms: Math.min(data.ms, 30 * 60_000) })
      .eq('id', data.id)
      .eq('session_id', data.sid);
    return noContent();
  }

  const path = data.path.split(/[?#]/)[0] || '/';
  if (EXCLUDED.test(path)) return noContent();

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  const ownHost = req.headers.get('host');
  const origin = data.landing
    ? classifyVisit(
        { referrer: data.ref, utm_source: data.utm_source, utm_medium: data.utm_medium, click_id: data.click },
        ownHost,
      )
    : null;

  const { data: row, error } = await db
    .from('site_pageviews')
    .insert({
      session_id: data.sid,
      visitor_hash: visitorHash(ip, ua),
      path,
      is_landing: data.landing,
      referrer_host: origin?.referrer_host ?? null,
      source: origin?.source ?? null,
      channel: origin?.channel ?? null,
      utm_source: data.landing ? data.utm_source : null,
      utm_medium: data.landing ? data.utm_medium : null,
      utm_campaign: data.landing ? data.utm_campaign : null,
      utm_content: data.landing ? data.utm_content : null,
      utm_term: data.landing ? data.utm_term : null,
      click_id: data.landing ? data.click ?? null : null,
      device: deviceOf(ua),
      country: header(req, 'x-vercel-ip-country'),
      region: header(req, 'x-vercel-ip-country-region'),
      city: header(req, 'x-vercel-ip-city'),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Page view not recorded:', error.message);
    return noContent();
  }
  return NextResponse.json({ id: row.id });
}
