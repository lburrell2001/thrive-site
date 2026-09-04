export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { newAccessToken } from '../../route';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Copy a proposal. This is the primary way new proposals get made, so it is
 * one click from the list page.
 *
 * The copy gets a fresh id, slug, and access token, and starts as a draft
 * with no send/view/sign history. Blocks get new ids too — sharing them
 * would mean saving one proposal moved the other's rows.
 *
 * Image storage paths are copied as-is and still point at the source
 * proposal's files. That is intentional: the copy renders immediately with
 * the same imagery, and replacing an image in the copy writes to a new path
 * under the copy's own id.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const db = auth.db;

  const [source, blocks, items] = await Promise.all([
    db.from('proposals').select('*').eq('id', id).maybeSingle(),
    db.from('proposal_blocks').select('*').eq('proposal_id', id).order('position'),
    db.from('proposal_line_items').select('*').eq('proposal_id', id).order('position'),
  ]);

  if (!source.data) return badRequest('Proposal not found', 404);

  const title = `${source.data.title} (copy)`;
  const { data: slug, error: slugError } = await db.rpc('next_proposal_slug', { base: title });
  if (slugError) return badRequest(slugError.message);

  const { data: created, error: createError } = await db
    .from('proposals')
    .insert({
      slug,
      access_token: newAccessToken(),
      title,
      client_id: source.data.client_id,
      template_id: source.data.template_id,
      status: 'draft',
      proposal_date: new Date().toISOString().slice(0, 10),
      valid_until: source.data.valid_until,
      currency: source.data.currency,
      deposit_percent: source.data.deposit_percent,
      theme: source.data.theme,
    })
    .select('id, title')
    .single();

  if (createError) return badRequest(createError.message);

  const { error: saveError } = await db.rpc('save_proposal_content', {
    p_proposal_id: created.id,
    p_blocks: (blocks.data ?? []).map((row, index) => ({
      type: row.type,
      position: index,
      visible: row.visible,
      accent: row.accent,
      content: row.content,
    })),
    p_line_items: (items.data ?? []).map((row, index) => ({
      label: row.label,
      description: row.description,
      quantity: Number(row.quantity),
      unit_price_cents: row.unit_price_cents,
      position: index,
    })),
  });
  if (saveError) return badRequest(saveError.message);

  return NextResponse.json({ ok: true, data: created });
}
