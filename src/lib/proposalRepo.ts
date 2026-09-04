// Server-only data access for proposals.
//
// Every one of these functions expects a Supabase client built with the
// SERVICE ROLE key. RLS is on with no policies on all proposal tables, so the
// anon key cannot read them at all — which means the authorisation decision
// (admin passcode, or a valid access_token) has to be made by the caller
// before it gets here. Nothing in this file talks to the browser.

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBlocksLenient } from '@/lib/proposalSchemas';
import type {
  Proposal,
  ProposalBlock,
  ProposalClient,
  ProposalLineItem,
  RenderableProposal,
} from '@/types/proposal';

export const PROPOSAL_BUCKET = 'proposal-media';

/** Signed image URLs expire after an hour; the bucket is never public. */
const SIGNED_URL_TTL_SECONDS = 3600;

interface BlockRow {
  id: string;
  type: string;
  position: number;
  visible: boolean;
  accent: string | null;
  content: unknown;
}

/**
 * Turn database rows into validated blocks. Rows that fail validation are
 * dropped with a server-side log rather than throwing — one bad row should
 * not blank a page in front of a client.
 */
export function rowsToBlocks(rows: BlockRow[]): ProposalBlock[] {
  return parseBlocksLenient(
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

/** Every storage path any block references, deduplicated. */
export function collectImagePaths(blocks: ProposalBlock[]): string[] {
  const paths = new Set<string>();

  for (const block of blocks) {
    switch (block.type) {
      case 'cover':
        if (block.content.heroImagePath) paths.add(block.content.heroImagePath);
        break;
      case 'moodboard':
        // A tile can exist before its image does; skip the blanks.
        for (const image of block.content.images) if (image.path) paths.add(image.path);
        break;
      case 'showcase':
        for (const card of block.content.cards) if (card.imagePath) paths.add(card.imagePath);
        break;
      default:
        break;
    }
  }

  return [...paths];
}

/**
 * Mint short-lived signed URLs for the given storage paths. Paths with no
 * object behind them are simply absent from the result, and the renderer
 * shows a labelled placeholder in their place.
 */
export async function signImageUrls(
  db: SupabaseClient,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await db.storage
    .from(PROPOSAL_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('Failed to sign proposal images:', error.message);
    return {};
  }

  const urls: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}

/** Assemble everything the renderer needs. Carries no access_token. */
export async function toRenderable(
  db: SupabaseClient,
  proposal: Proposal,
  blockRows: BlockRow[],
  lineItems: ProposalLineItem[],
  client: ProposalClient | null,
): Promise<RenderableProposal> {
  const blocks = rowsToBlocks(blockRows);
  const imageUrls = await signImageUrls(db, collectImagePaths(blocks));

  return {
    id: proposal.id,
    slug: proposal.slug,
    title: proposal.title,
    status: proposal.status,
    proposalDate: proposal.proposal_date,
    validUntil: proposal.valid_until,
    currency: proposal.currency,
    totalCents: proposal.total_cents,
    depositPercent: proposal.deposit_percent,
    theme: proposal.theme ?? {},
    blocks,
    lineItems,
    client,
    imageUrls,
  };
}

/** A proposal's own row alongside the render-ready projection of it. */
export interface LoadedProposal {
  /** The raw row. Carries access_token — never hand this to a client component. */
  row: Proposal;
  renderable: RenderableProposal;
}

async function loadChildren(db: SupabaseClient, proposal: Proposal): Promise<LoadedProposal> {
  const [blocks, lineItems, client] = await Promise.all([
    db.from('proposal_blocks').select('*').eq('proposal_id', proposal.id).order('position'),
    db.from('proposal_line_items').select('*').eq('proposal_id', proposal.id).order('position'),
    proposal.client_id
      ? db.from('proposal_clients').select('*').eq('id', proposal.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const renderable = await toRenderable(
    db,
    proposal,
    (blocks.data ?? []) as BlockRow[],
    (lineItems.data ?? []) as ProposalLineItem[],
    (client.data ?? null) as ProposalClient | null,
  );

  return { row: proposal, renderable };
}

/**
 * Load a proposal by id. Admin path only — the caller must already have
 * verified the admin passcode.
 */
export async function loadProposalById(
  db: SupabaseClient,
  id: string,
): Promise<RenderableProposal | null> {
  const { data, error } = await db.from('proposals').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return (await loadChildren(db, data as Proposal)).renderable;
}

/**
 * Load a proposal by its public slug. Returns the raw row too, because the
 * caller still has to check the access token against it — this function
 * deliberately performs no authorisation of its own.
 */
export async function loadProposalBySlug(
  db: SupabaseClient,
  slug: string,
): Promise<LoadedProposal | null> {
  const { data, error } = await db.from('proposals').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return loadChildren(db, data as Proposal);
}

/** Deposit due on signature, in cents. */
export function depositCents(totalCents: number, depositPercent: number): number {
  return Math.round((totalCents * depositPercent) / 100);
}
