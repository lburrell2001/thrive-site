export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { DEFAULT_DESIGN, starterBlocks } from '@/lib/newsletterBlocks';

/** Every newsletter, newest first. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db
    .from('newsletters')
    .select('id, subject, audience, audience_tag, status, recipient_count, sent_at, updated_at, last_error')
    .order('updated_at', { ascending: false });
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

const createSchema = z.object({
  // 'designed' starts from the starter layout; 'plain' is the text editor.
  kind: z.enum(['designed', 'plain']).default('designed'),
  template_id: z.string().uuid().optional(),
});

/** Start a draft: designed (starter layout), plain text, or from a saved template. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest('Invalid request');

  let start: Record<string, unknown> = { subject: '' };
  if (parsed.data.template_id) {
    const { data: t } = await auth.db.from('newsletter_templates').select('blocks, design').eq('id', parsed.data.template_id).maybeSingle();
    if (!t) return badRequest('Template not found', 404);
    // Fresh ids, so editing this newsletter never touches the template's blocks.
    const blocks = (t.blocks as { id: string }[]).map((b) => ({ ...b, id: crypto.randomUUID() }));
    start = { subject: '', blocks, design: t.design };
  } else if (parsed.data.kind === 'designed') {
    start = { subject: '', blocks: starterBlocks(), design: DEFAULT_DESIGN };
  }
  const { data, error } = await auth.db.from('newsletters').insert(start).select('id').single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}
