export const runtime = 'nodejs';

// Portal analytics (migration 059): the signed-in client's sign-ins, page
// views (with time on screen, updated as they leave) and actions. The token
// comes in the body because sendBeacon can't set headers. Only portal clients
// are recorded; a row can only be updated by the client who made it.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serviceClient } from '@/lib/adminAuth';

const MAX_MS = 4 * 60 * 60 * 1000;
const event = z.object({
  id: z.string().uuid(),
  kind: z.enum(['sign_in', 'page', 'action']),
  session_id: z.string().min(1).max(64),
  path: z.string().max(300).optional(),
  label: z.string().max(200).optional(),
  started_at: z.string().datetime().optional(),
  duration_ms: z.number().int().min(0).optional(),
});
const schema = z.object({ token: z.string().min(20).max(4000), events: z.array(event).min(1).max(20) });

const done = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return done();
  let db;
  try { db = serviceClient(); } catch { return done(); }
  const { data: { user } } = await db.auth.getUser(parsed.data.token);
  if (!user) return done();
  const { data: client } = await db.from('portal_clients').select('id').eq('id', user.id).maybeSingle();
  if (!client) return done();

  const ua = req.headers.get('user-agent')?.slice(0, 300) ?? null;
  const ids = parsed.data.events.map((e) => e.id);
  const { data: existing } = await db.from('portal_events').select('id, client_id, duration_ms').in('id', ids);
  for (const e of parsed.data.events) {
    const ms = Math.min(e.duration_ms ?? 0, MAX_MS);
    const had = existing?.find((x) => x.id === e.id);
    if (had) {
      if (had.client_id === user.id && ms > had.duration_ms) await db.from('portal_events').update({ duration_ms: ms }).eq('id', e.id);
      continue;
    }
    const started = e.started_at && Math.abs(Date.parse(e.started_at) - Date.now()) < 6 * 3600_000 ? e.started_at : new Date().toISOString();
    await db.from('portal_events').insert({
      id: e.id, client_id: user.id, session_id: e.session_id, kind: e.kind,
      path: e.path ?? null, label: e.label ?? null, started_at: started, duration_ms: ms, user_agent: ua,
    });
  }
  return done();
}
