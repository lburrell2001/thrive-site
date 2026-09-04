// Server-only gate for the public proposal view.
//
// The proposal tables have RLS on with no policies, so the browser cannot
// reach them at any point. `/p/[slug]` is server-rendered, reads through the
// service role, and every one of those reads happens *after* the access token
// in the URL has been checked against the row. This module is the only place
// that check lives.

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadProposalBySlug, type LoadedProposal } from '@/lib/proposalRepo';

export function proposalServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Constant-time token comparison. Length is compared first and leaks, which
 * is fine — tokens are a fixed 32 characters, so length carries no secret.
 */
function tokenMatches(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(supplied, 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export type ProposalAccess =
  | { ok: true; loaded: LoadedProposal }
  /** Deliberately undifferentiated: a bad token and a missing slug look identical. */
  | { ok: false };

/**
 * Resolve a public proposal request. A wrong token and a slug that does not
 * exist return the same shape, so the response cannot be used to enumerate
 * which proposals are real.
 */
export async function resolveProposalAccess(
  slug: string,
  token: string | undefined,
): Promise<ProposalAccess> {
  if (!slug || !token) return { ok: false };

  const db = proposalServiceClient();
  const loaded = await loadProposalBySlug(db, slug);
  if (!loaded) return { ok: false };

  if (!tokenMatches(loaded.row.access_token, token)) return { ok: false };

  return { ok: true, loaded };
}

/** First value of a possibly-repeated `?t=` query param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface ViewContext {
  userAgent?: string | null;
  ip?: string | null;
  referer?: string | null;
}

/**
 * Record that the client opened the proposal.
 *
 * Fire-and-forget: a failure here must never stop the client reading the
 * document. Views are not logged for drafts — an unsent proposal is Lauren
 * checking her own work, not a client opening it.
 */
export async function recordProposalView(
  db: SupabaseClient,
  proposal: { id: string; status: string; first_viewed_at: string | null },
  context: ViewContext = {},
): Promise<void> {
  if (proposal.status === 'draft') return;

  try {
    await db.from('proposal_events').insert({
      proposal_id: proposal.id,
      type: 'viewed',
      metadata: {
        user_agent: context.userAgent ?? null,
        ip: context.ip ?? null,
        referer: context.referer ?? null,
      },
    });

    const patch: Record<string, unknown> = {};
    if (!proposal.first_viewed_at) patch.first_viewed_at = new Date().toISOString();
    // 'sent' is the only status a view advances. Signed, declined and expired
    // proposals keep the status they earned.
    if (proposal.status === 'sent') patch.status = 'viewed';

    if (Object.keys(patch).length > 0) {
      await db.from('proposals').update(patch).eq('id', proposal.id);
    }
  } catch (error) {
    console.error('Failed to record proposal view:', error);
  }
}
