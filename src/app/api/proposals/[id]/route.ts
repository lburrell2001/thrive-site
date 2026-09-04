export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { savePayloadSchema } from '@/lib/proposalWriteSchemas';
import {
  collectImagePaths,
  rowsToBlocks,
  signImageUrls,
} from '@/lib/proposalRepo';

type Ctx = { params: Promise<{ id: string }> };

/** Everything the builder needs to open a proposal. */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const db = auth.db;

  const { data: proposal, error } = await db
    .from('proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return badRequest(error.message);
  if (!proposal) return badRequest('Proposal not found', 404);

  const [blockRows, lineItems, client, signatures] = await Promise.all([
    db.from('proposal_blocks').select('*').eq('proposal_id', id).order('position'),
    db.from('proposal_line_items').select('*').eq('proposal_id', id).order('position'),
    proposal.client_id
      ? db.from('proposal_clients').select('*').eq('id', proposal.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Metadata only. The frozen blocks_snapshot is deliberately not sent to
    // the builder — it exists to be immutable, not to be edited.
    db
      .from('proposal_signatures')
      .select(
        'id, signer_name, signer_email, signer_title, typed_name, signed_at, ip_address, content_hash, total_cents',
      )
      .eq('proposal_id', id)
      .order('signed_at', { ascending: false }),
  ]);

  const blocks = rowsToBlocks(blockRows.data ?? []);
  const imageUrls = await signImageUrls(db, collectImagePaths(blocks));

  // The builder never needs the access token — publishing hands the link
  // back from /send. Keep the secret out of the browser regardless.
  const { access_token: _token, ...safeProposal } = proposal;
  void _token;

  return NextResponse.json({
    ok: true,
    data: {
      proposal: safeProposal,
      blocks,
      lineItems: lineItems.data ?? [],
      client: client.data ?? null,
      signatures: signatures.data ?? [],
      imageUrls,
    },
  });
}

/**
 * Autosave. Accepts any combination of proposal fields, the full block list,
 * and the full line-item list. Blocks and line items are replaced wholesale
 * inside save_proposal_content, which is transactional — a failed save leaves
 * the proposal exactly as it was rather than half-written.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const db = auth.db;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = savePayloadSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`${issue?.path.join('.') ?? 'payload'}: ${issue?.message ?? 'invalid'}`);
  }

  const { proposal, blocks, lineItems } = parsed.data;

  if (proposal && Object.keys(proposal).length > 0) {
    const { error } = await db.from('proposals').update(proposal).eq('id', id);
    if (error) return badRequest(error.message);
  }

  if (blocks || lineItems) {
    const { error } = await db.rpc('save_proposal_content', {
      p_proposal_id: id,
      p_blocks: blocks
        ? blocks.map((block, index) => ({
            id: block.id,
            type: block.type,
            position: index,
            visible: block.visible,
            accent: block.accent ?? null,
            content: block.content,
          }))
        : null,
      p_line_items: lineItems
        ? lineItems.map((item, index) => ({ ...item, position: index }))
        : null,
    });
    if (error) return badRequest(error.message);
  }

  // Hand back the recomputed total so the builder's running total always
  // reflects what the database actually calculated, never the client's sum.
  const { data: fresh } = await db
    .from('proposals')
    .select('total_cents, updated_at, status')
    .eq('id', id)
    .single();

  return NextResponse.json({ ok: true, data: fresh });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // A signed proposal is a record of an agreement. Deleting one would take
  // its signature rows with it via cascade, so refuse.
  const { count } = await auth.db
    .from('proposal_signatures')
    .select('*', { count: 'exact', head: true })
    .eq('proposal_id', id);

  if ((count ?? 0) > 0) {
    return badRequest('This proposal has been signed and cannot be deleted.', 409);
  }

  const { error } = await auth.db.from('proposals').delete().eq('id', id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true });
}
