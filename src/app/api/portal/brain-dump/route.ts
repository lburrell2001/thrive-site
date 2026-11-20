export const runtime = 'nodejs';

// A client just sent a brain dump (saved from the portal's My Projects or
// Requests page): email and text Lauren what they wrote and where it's filed.
// Only for the client's own request, and only right after it was made.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import { tellLauren } from '@/lib/agencyNotify';
import { SITE_URL } from '@/lib/seo';

const schema = z.object({ id: z.string().uuid() });
const FRESH_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const db = auth.db;
  const { data: dump } = await db.from('portal_requests')
    .select('id, title, description, project_name, created_at')
    .eq('id', parsed.data.id).eq('client_id', auth.user.id).maybeSingle();
  if (!dump) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (Date.now() - new Date(dump.created_at).getTime() > FRESH_MS) return NextResponse.json({ ok: true });

  const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', auth.user.id).maybeSingle();
  const name = client?.company_name || client?.full_name || auth.user.email || 'A client';
  const who = `${client?.full_name || auth.user.email}${client?.company_name ? ` (${client.company_name})` : ''}`;
  const where = dump.project_name ? `Filed under: ${dump.project_name}` : 'Not filed under a project yet: file it from their Client tab.';
  const text = dump.description?.trim();

  after(() => tellLauren(
    `Brain dump from ${name}: ${dump.title}`,
    `${who} sent a brain dump in their portal.\n\n${dump.title}${text ? `\n“${text}”` : ''}\n\n${where}\n\n${SITE_URL}/admin/clients?client=${auth.user.id}`,
    `Brain dump from ${name}: ${dump.title}${text ? `. “${text.slice(0, 120)}${text.length > 120 ? '…' : ''}”` : ''}`,
  ));
  return NextResponse.json({ ok: true });
}
