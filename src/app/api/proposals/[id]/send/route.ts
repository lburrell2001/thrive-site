export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Publish: mark the proposal sent and hand back its client link.
 *
 * Emailing the link to the client is Phase 4, alongside the signing
 * receipts. Until then this marks the proposal live and returns the URL to
 * copy — which also means view tracking starts working, since views are not
 * logged while a proposal is still a draft.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const { data: proposal, error } = await auth.db
    .from('proposals')
    .select('slug, access_token, status, sent_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return badRequest(error.message);
  if (!proposal) return badRequest('Proposal not found', 404);

  if (proposal.status === 'signed') {
    return badRequest('This proposal has already been signed.', 409);
  }

  // Re-publishing an already-sent proposal keeps its original sent_at and
  // does not knock a 'viewed' status back to 'sent'.
  if (proposal.status === 'draft') {
    const { error: updateError } = await auth.db
      .from('proposals')
      .update({ status: 'sent', sent_at: proposal.sent_at ?? new Date().toISOString() })
      .eq('id', id);
    if (updateError) return badRequest(updateError.message);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return NextResponse.json({
    ok: true,
    data: {
      url: `${site}/p/${proposal.slug}?t=${proposal.access_token}`,
      path: `/p/${proposal.slug}?t=${proposal.access_token}`,
    },
  });
}
