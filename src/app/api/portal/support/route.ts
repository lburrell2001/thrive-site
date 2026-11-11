export const runtime = 'nodejs';

// "Something isn't working" from the portal's ? button: filed as a portal
// request (type "Portal help", high priority, so it's on their Client tab and
// in their requests) and sent to Lauren by email and text with the page they
// were on and their browser.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import { tellLauren } from '@/lib/agencyNotify';
import { SITE_URL } from '@/lib/seo';

const schema = z.object({
  topic: z.enum(['broken', 'question', 'billing', 'other']),
  message: z.string().trim().min(1, 'Tell us what’s going on').max(4000),
  page: z.string().max(300).optional(),
});
const TOPIC: Record<z.infer<typeof schema>['topic'], string> = {
  broken: 'Something isn’t working', question: 'A question about my project', billing: 'A billing question', other: 'Something else',
};

export async function POST(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const { topic, message, page } = parsed.data;
  const db = auth.db;
  const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', auth.user.id).maybeSingle();
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 403 });
  const ua = req.headers.get('user-agent')?.slice(0, 300) ?? 'unknown browser';

  const row = { client_id: auth.user.id, title: `Help: ${TOPIC[topic]}`, type: 'Portal help', priority: 'high', status: 'kickoff' };
  let { error } = await db.from('portal_requests').insert({ ...row, description: `${message}\n\n(Page: ${page ?? 'unknown'})` });
  if (error && /description/.test(error.message)) ({ error } = await db.from('portal_requests').insert(row));
  if (error) console.error('[portal support] request not saved', error.message);

  const who = `${client.full_name || auth.user.email}${client.company_name ? ` (${client.company_name})` : ''}`;
  after(() => tellLauren(
    `Portal help: ${TOPIC[topic]} — ${client.company_name || client.full_name}`,
    `${who} asked for help in their portal.\n\n${TOPIC[topic]}\n“${message}”\n\nPage: ${page ?? 'unknown'}\nEmail: ${auth.user.email ?? '—'}\nBrowser: ${ua}\n\n${SITE_URL}/admin/clients?client=${auth.user.id}`,
    `Portal help from ${client.company_name || client.full_name}: ${TOPIC[topic]}. “${message.slice(0, 120)}”`,
  ));
  return NextResponse.json({ ok: true });
}
