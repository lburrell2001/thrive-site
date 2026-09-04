export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { parseBlocksLenient, proposalBlocksSchema } from '@/lib/proposalSchemas';
import { scrubClientDetails, toTemplateBlocks } from '@/lib/proposalTemplates';
import { setDefaultTemplate } from './setDefault';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.db
    .from('proposal_templates')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name');

  if (error) return badRequest(error.message);

  // The full block array is only needed when a template is instantiated;
  // the library just needs to know how big each one is.
  const summary = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    is_default: row.is_default,
    created_at: row.created_at,
    block_count: Array.isArray(row.blocks) ? row.blocks.length : 0,
    block_types: Array.isArray(row.blocks)
      ? (row.blocks as { type?: string }[]).map((block) => block.type ?? 'unknown')
      : [],
  }));

  return NextResponse.json({ ok: true, data: summary });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  /** Save an existing proposal's blocks as the template. */
  fromProposalId: z.string().uuid().optional(),
  /** Or supply blocks directly. */
  blocks: proposalBlocksSchema.max(60).optional(),
  /** Clear the fields that name one client, keeping the boilerplate. */
  scrubClientDetails: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`${issue?.path.join('.') ?? 'payload'}: ${issue?.message ?? 'invalid'}`);
  }

  const input = parsed.data;
  const db = auth.db;

  let blocks = input.blocks ?? [];

  if (input.fromProposalId) {
    const { data: rows, error } = await db
      .from('proposal_blocks')
      .select('*')
      .eq('proposal_id', input.fromProposalId)
      .order('position');
    if (error) return badRequest(error.message);
    if (!rows || rows.length === 0) return badRequest('That proposal has no blocks to save', 404);

    blocks = parseBlocksLenient(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        position: row.position,
        visible: row.visible,
        ...(row.accent ? { accent: row.accent } : {}),
        content: row.content,
      })),
    );
  }

  if (input.scrubClientDetails) blocks = scrubClientDetails(blocks);

  const { data: created, error: createError } = await db
    .from('proposal_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      blocks: toTemplateBlocks(blocks),
      is_default: false,
    })
    .select('id, name')
    .single();

  if (createError) return badRequest(createError.message);

  if (input.isDefault) {
    const error = await setDefaultTemplate(db, created.id);
    if (error) return badRequest(error);
  }

  return NextResponse.json({ ok: true, data: created });
}
