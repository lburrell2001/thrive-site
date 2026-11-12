export const runtime = 'nodejs';

// Portal setup prompts (migration 057, src/lib/portalSetup.ts): GET the
// projects still to set up (?client= for one client); POST
// { action: 'invite', client_id, project_name?, note? } sends the "your portal
// is ready" email, { action: 'skip', project_id } marks a project set up.
// Also accepted estimates / signed proposals from clients with no portal yet
// (src/lib/acceptedPortal.ts): GET returns them as `accepted`; POST
// { action: 'from_estimate', estimate_id, note? } makes the login, project and
// invoice and sends the invite.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { portalSetups, sendPortalInvite, skipSetup } from '@/lib/portalSetup';
import { acceptedWaiting, setUpFromEstimate } from '@/lib/acceptedPortal';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const client = new URL(req.url).searchParams.get('client');
  const [setups, accepted] = await Promise.all([
    portalSetups(auth.db, client && /^[0-9a-f-]{36}$/i.test(client) ? { clientId: client } : {}),
    client ? Promise.resolve([]) : acceptedWaiting(auth.db),
  ]);
  return NextResponse.json({ ok: true, data: { setups, accepted } });
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), client_id: z.string().uuid(), project_name: z.string().max(200).optional(), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal('skip'), project_id: z.string().uuid() }),
  z.object({ action: z.literal('from_estimate'), estimate_id: z.string().uuid(), note: z.string().max(2000).optional() }),
]);

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const body = parsed.data;
  if (body.action === 'from_estimate') {
    const r = await setUpFromEstimate(auth.db, body.estimate_id, body.note);
    return r.ok ? NextResponse.json({ ok: true, data: r }) : badRequest(r.error);
  }
  if (body.action === 'skip') {
    const r = await skipSetup(auth.db, body.project_id);
    return r.ok ? NextResponse.json({ ok: true }) : badRequest(r.error);
  }
  const r = await sendPortalInvite(auth.db, body.client_id, { projectName: body.project_name, note: body.note });
  return r.ok ? NextResponse.json({ ok: true, data: { to: r.to, texted: r.texted } }) : badRequest(r.error);
}
