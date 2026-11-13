export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { syncProposalEstimate } from '@/lib/proposalEstimate';
import { createProposalSchema } from '@/lib/proposalWriteSchemas';
import { emptyBlock, parseBlocksLenient } from '@/lib/proposalSchemas';
import { headerDate, starterBlocks } from '@/lib/proposalStarter';
import type { ProposalBlock } from '@/types/proposal';
import { estimateToProposalLines } from '@/lib/proposalBilling';
import { recipientForContact, recipientForPortalClient } from '@/lib/proposalRecipients';
import type { LineItem } from '@/lib/lineItems';

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
      'id, slug, title, status, proposal_date, valid_until, currency, total_cents, deposit_percent, sent_at, first_viewed_at, signed_at, declined_at, decline_reason, updated_at, client_id, estimate_id, proposal_clients ( id, name, company )',
    )
    .order('updated_at', { ascending: false });

  if (error) return badRequest(error.message);

  // When each proposal was last chased, for the list's Remind button.
  const { data: reminders } = await auth.db
    .from('client_reminders')
    .select('target_id, created_at')
    .eq('target_type', 'proposal')
    .or('email_status.eq.sent,sms_status.eq.sent')
    .order('created_at', { ascending: false });
  // Phased proposals (migration 062): approved phase by phase, no total. Nothing before 062.
  const { data: phasedRows } = await auth.db.from('proposal_line_items').select('proposal_id').not('phase', 'is', null);
  const phased = new Set((phasedRows ?? []).map((r) => r.proposal_id as string));
  const lastReminded = new Map<string, string>();
  for (const r of reminders ?? []) {
    if (r.target_id && !lastReminded.has(r.target_id)) lastReminded.set(r.target_id, r.created_at);
  }

  return NextResponse.json({
    ok: true,
    data: (data ?? []).map((row) => ({ ...row, last_reminded_at: lastReminded.get(row.id) ?? null, phased: phased.has(row.id) })),
  });
}

/**
 * Create a proposal: blank, the Thrive layout, from a template, or copied
 * from another proposal. `cover` decides whether its cover page shows.
 */
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

  const { title, templateId, fromProposalId, starter, cover = false, crmDealId, fromEstimateId } = parsed.data;
  let { clientId } = parsed.data;
  const db = auth.db;

  // Work out the starting blocks.
  let blocks: ProposalBlock[] = [];
  let lineItems: { label: string; description: string | null; quantity: number; unit_price_cents: number; position: number; tier?: string | null; is_optional?: boolean; phase?: string | null; phase_terms?: string | null }[] = [];
  let theme: unknown = {};
  let depositPercent = 50;
  let currency = 'USD';

  let skipped: string[] = [];
  let estimateDealId: string | null = null;

  if (fromEstimateId) {
    // An estimate: the Thrive layout, its client, and its lines as the pricing.
    const { data: est } = await db.from('estimates').select('*').eq('id', fromEstimateId).maybeSingle();
    if (!est) return badRequest('Estimate not found', 404);
    if (!clientId && est.portal_client_id) {
      const r = await recipientForPortalClient(db, est.portal_client_id);
      if ('id' in r) clientId = r.id;
    }
    if (!clientId && est.crm_contact_id) {
      const r = await recipientForContact(db, est.crm_contact_id);
      if ('id' in r) clientId = r.id;
    }
    estimateDealId = est.crm_deal_id ?? null;
    const converted = estimateToProposalLines((est.line_items ?? []) as LineItem[]);
    lineItems = converted.lineItems;
    skipped = converted.skipped;
    blocks = starterBlocks({ cover, clientName: est.client_name || null, projectName: est.title || null }).map((block) =>
      block.type === 'pricing'
        ? { ...block, content: {
            ...block.content, deliverables: converted.deliverables,
            // Phase timelines (migration 062) live on the pricing block.
            ...(() => {
              const tl: Record<string, string> = {};
              for (const l of (est.line_items ?? []) as LineItem[]) if (l.phase && l.phase_timeline && !tl[l.phase]) tl[l.phase] = l.phase_timeline;
              return Object.keys(tl).length ? { phaseTimelines: tl } : {};
            })(),
          } }
        : block,
    );
    theme = { accent: 'magenta', headerNote: headerDate() };
  } else if (fromProposalId) {
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
      // Migration 061 (absent before it).
      ...(row.tier ? { tier: row.tier } : {}),
      ...(row.is_optional ? { is_optional: true } : {}),
      // Migration 062.
      ...(row.phase ? { phase: row.phase, phase_terms: row.phase_terms ?? null } : {}),
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
  } else if (starter) {
    const { data: client } = clientId
      ? await db.from('proposal_clients').select('name, company').eq('id', clientId).maybeSingle()
      : { data: null };
    blocks = starterBlocks({ cover, clientName: client?.name, projectName: client?.company });
    theme = { accent: 'magenta', headerNote: headerDate() };
  }

  // Most proposals go without a cover. Keep a copied or templated cover but
  // hide it (one click to bring back), or add one when asked for.
  const hasCover = blocks.some((block) => block.type === 'cover');
  blocks = blocks.map((block) => (block.type === 'cover' ? { ...block, visible: cover } : block));
  if (cover && !hasCover) {
    const added = emptyBlock('cover', randomUUID(), 0);
    if (added.type === 'cover') {
      added.content = { ...added.content, dateLabel: headerDate(), preparedBy: 'Thrive Creative Studios' };
    }
    blocks = [added, ...blocks];
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
      // Set when started from a deal (or from an estimate on one); otherwise
      // the CRM trigger files it under the client's most recent open deal.
      ...(crmDealId || estimateDealId ? { crm_deal_id: crmDealId ?? estimateDealId } : {}),
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

  // Every proposal has an estimate: the one it came from, or one built from its pricing.
  if (fromEstimateId) await db.from('proposals').update({ estimate_id: fromEstimateId }).eq('id', created.id);
  const synced = await syncProposalEstimate(db, created.id);
  if (!synced.ok) console.error('[proposals] estimate not synced', synced.error);

  return NextResponse.json({ ok: true, data: { id: created.id, skipped } });
}
