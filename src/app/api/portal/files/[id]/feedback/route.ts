export const runtime = 'nodejs';

// Feedback on a draft (074): the client likes or dislikes it and can comment,
// so Lauren knows which versions they want. Only on the client's own files.
// A comment emails and texts Lauren; a like / dislike just emails her.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requirePortalClient } from '@/lib/portalAuth';
import { tellLauren } from '@/lib/agencyNotify';
import { SITE_URL } from '@/lib/seo';

const schema = z.object({
  reaction: z.enum(['like', 'dislike']).nullable().optional(),
  comment: z.string().trim().min(1).max(2000).optional(),
}).refine((b) => b.reaction !== undefined || b.comment !== undefined, 'Nothing to save');

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
  const { reaction, comment } = parsed.data;
  const db = auth.db;

  const found = await db.from('portal_files').select('id, client_id, name, project_name, reaction').eq('id', id).maybeSingle();
  if (found.error) return NextResponse.json({ error: 'Feedback is not set up yet' }, { status: 503 });
  const file = found.data;
  if (!file || file.client_id !== auth.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const changed = reaction !== undefined && reaction !== file.reaction;
  if (changed) {
    const { error } = await db.from('portal_files').update({ reaction, reaction_at: reaction ? new Date().toISOString() : null }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
  let saved: { id: string; author: string; body: string; created_at: string } | null = null;
  if (comment) {
    const { data, error } = await db.from('portal_file_comments')
      .insert({ file_id: id, client_id: auth.user.id, author: 'client', body: comment })
      .select('id, author, body, created_at').single();
    if (error) return NextResponse.json({ error: 'Could not save your comment' }, { status: 500 });
    saved = data;
  }

  if (changed || comment) {
    const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', auth.user.id).maybeSingle();
    const name = client?.company_name || client?.full_name || auth.user.email || 'A client';
    const verdict = changed ? (reaction === 'like' ? 'liked' : reaction === 'dislike' ? 'disliked' : 'removed their reaction to') : null;
    const headline = verdict ?? 'commented on';
    const project = file.project_name ? ` (${file.project_name})` : '';
    await db.from('portal_activity').insert({
      client_id: auth.user.id,
      text: `You ${headline === 'removed their reaction to' ? 'removed your reaction to' : headline} ${file.name}${verdict && comment ? ' and left a comment' : ''}`,
      dot_color: reaction === 'dislike' ? '#e50586' : '#0cf574',
      project_name: file.project_name || null,
    });
    after(() => tellLauren(
      `${name} ${headline} ${file.name}`,
      `${name} ${headline} the draft ${file.name}${project}.${comment ? `\n\nTheir comment:\n“${comment}”` : ''}\n\n${SITE_URL}/admin/clients?client=${auth.user.id}`,
      comment ? `${name} commented on ${file.name}: “${comment.slice(0, 120)}${comment.length > 120 ? '…' : ''}”` : undefined,
    ));
  }
  return NextResponse.json({ ok: true, reaction: changed ? reaction : file.reaction, comment: saved });
}
