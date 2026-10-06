export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { DEFAULT_DESIGN, starterBlocks } from '@/lib/newsletterBlocks';

/** Every email sent (or to be sent) to an audience, newest first. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db
    .from('newsletters')
    .select('id, style, subject, audience, audience_tag, audience_contact_ids, status, scheduled_at, recipient_count, sent_at, updated_at, last_error')
    .order('updated_at', { ascending: false });
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

const createSchema = z.object({
  kind: z.enum(['designed', 'personal']).default('designed'),
  template_id: z.string().uuid().optional(),
  audience: z.enum(['subscribers', 'prospects', 'contacts']).default('subscribers'),
  /** Start addressed to these contacts (e.g. picked on the Prospects page). */
  contact_ids: z.array(z.string().uuid()).max(2000).optional(),
});

/** Start a draft: designed, personal, or from a template — for an audience. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest('Invalid request');
  const { kind, template_id, contact_ids } = parsed.data;
  const audience = contact_ids?.length ? 'contacts' : parsed.data.audience;

  let start: Record<string, unknown>;
  if (template_id) {
    const { data: t } = await auth.db.from('email_templates').select('style, subject, preheader, body, blocks, design').eq('id', template_id).maybeSingle();
    if (!t) return badRequest('Template not found', 404);
    // Fresh ids, so editing this email never touches the template's blocks.
    const blocks = (t.blocks as { id: string }[]).map((b) => ({ ...b, id: crypto.randomUUID() }));
    start = { ...t, blocks };
  } else if (kind === 'designed') {
    start = { style: 'designed', subject: '', blocks: starterBlocks(), design: DEFAULT_DESIGN };
  } else {
    start = { style: 'personal', subject: '', body: 'Hi {{first_name}},\n\n\n\nThanks,' };
  }
  const { data, error } = await auth.db
    .from('newsletters')
    .insert({ ...start, audience, audience_contact_ids: contact_ids ?? [] })
    .select('id')
    .single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
