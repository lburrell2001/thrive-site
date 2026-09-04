export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { createProposalSchema } from '@/lib/proposalWriteSchemas';
import { parseBlocksLenient } from '@/lib/proposalSchemas';
import type { ProposalBlock } from '@/types/proposal';

export function newAccessToken() {
  return randomBytes(24).toString('base64url').slice(0, 32);
}

/** List proposals for the admin index. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from('proposals')
    .select(
      'id, slug, title, status, proposal_date, valid_until, currency, total_cents, deposit_percent, sent_at, first_viewed_at, signed_at, updated_at, client_id, proposal_clients ( id, name, company )',
    )
    .order('updated_at', { ascending: false });

  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, data });
}

/** Create a proposal: blank, from a template, or copied from another proposal. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = createProposalSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const { title, clientId, templateId, fromProposalId } = parsed.data;
  const db = auth.db;

  // Work out the starting blocks.
  let blocks: ProposalBlock[] = [];
  let lineItems: { label: string; description: string | null; quantity: number; unit_price_cents: number; position: number }[] = [];
  let theme: unknown = {};
  let depositPercent = 50;
  let currency = 'USD';

  if (fromProposalId) {
    const [source, sourceBlocks, sourceItems] = await Promise.all([
      db.from('proposals').select('*').eq('id', fromProposalId).maybeSingle(),
      db.from('proposal_blocks').select('*').eq('proposal_id', fromProposalId).order('position'),
      db.from('proposal_line_items').select('*').eq('proposal_id', fromProposalId).order('position'),
    ]);
    if (!source.data) return badRequest('Source proposal not found', 404);

    blocks = parseBlocksLenient(
      (sourceBlocks.data ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        position: row.position,
        visible: row.visible,
        ...(row.accent ? { accent: row.accent } : {}),
        content: row.content,
      })),
    );
    lineItems = (sourceItems.data ?? []).map((row, index) => ({
      label: row.label,
      description: row.description,
      quantity: Number(row.quantity),
      unit_price_cents: row.unit_price_cents,
      position: index,
    }));
    theme = source.data.theme ?? {};
    depositPercent = source.data.deposit_percent;
    currency = source.data.currency;
  } else if (templateId) {
    const { data: template } = await db
      .from('proposal_templates')
      .select('blocks')
      .eq('id', templateId)
      .maybeSingle();
    if (!template) return badRequest('Template not found', 404);

    // A template stores blocks without ids — it is a shape, not a set of
    // rows. Give each one a fresh id before validating, or every block fails
    // the schema's `id` requirement and is silently dropped.
    blocks = parseBlocksLenient(
      (Array.isArray(template.blocks) ? template.blocks : []).map((block) => ({
        ...(block as Record<string, unknown>),
        id: randomUUID(),
      })),
    );
  }

  const { data: slug, error: slugError } = await db.rpc('next_proposal_slug', { base: title });
  if (slugError) return badRequest(slugError.message);

  const { data: created, error: createError } = await db
    .from('proposals')
    .insert({
      slug,
      access_token: newAccessToken(),
      title,
      client_id: clientId ?? null,
      template_id: templateId ?? null,
      status: 'draft',
      currency,
      deposit_percent: depositPercent,
      theme,
    })
    .select('id')
    .single();

  if (createError) return badRequest(createError.message);

  if (blocks.length > 0 || lineItems.length > 0) {
    // New block ids: copied blocks must not share ids with their source, or
    // saving one proposal would move the other's rows.
    const { error: saveError } = await db.rpc('save_proposal_content', {
      p_proposal_id: created.id,
      p_blocks: blocks.map((block, index) => ({
        type: block.type,
        position: index,
        visible: block.visible,
        accent: block.accent ?? null,
        content: block.content,
      })),
      p_line_items: lineItems,
    });
    if (saveError) return badRequest(saveError.message);
  }

  return NextResponse.json({ ok: true, data: { id: created.id } });
}
