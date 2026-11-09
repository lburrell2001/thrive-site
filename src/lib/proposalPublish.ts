// Publishing a proposal: it needs pricing (so it goes out with its estimate,
// migration 050), its estimate is brought up to date, and a draft or declined
// proposal becomes Sent on the same link. Used by "Copy client link" and by
// "Send" (which also emails it).

import type { SupabaseClient } from '@supabase/supabase-js';
import { syncProposalEstimate } from './proposalEstimate';
import { SITE_URL } from './seo';

export type Published = { ok: true; url: string; path: string; clientId: string | null; title: string } | { ok: false; error: string; status?: number };

export async function publishProposal(db: SupabaseClient, id: string): Promise<Published> {
  const { data: proposal, error } = await db.from('proposals')
    .select('slug, access_token, status, sent_at, declined_at, client_id, title').eq('id', id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!proposal) return { ok: false, error: 'Proposal not found', status: 404 };

  // A signed proposal keeps its status. Re-publishing a sent one keeps its
  // first sent_at and doesn't knock 'viewed' back to 'sent'. A declined one
  // reopens on the same link (the 'declined' event stays in the log).
  if (proposal.status === 'draft' || proposal.status === 'declined') {
    const { count } = await db.from('proposal_line_items').select('id', { count: 'exact', head: true }).eq('proposal_id', id);
    if (!count) return { ok: false, error: 'Add pricing first: every proposal goes out with its estimate.' };
    const synced = await syncProposalEstimate(db, id);
    if (!synced.ok) return { ok: false, error: synced.error };
    const { error: updateError } = await db.from('proposals').update({
      status: 'sent',
      sent_at: proposal.sent_at ?? new Date().toISOString(),
      declined_at: null,
      decline_reason: null,
    }).eq('id', id);
    if (updateError) return { ok: false, error: updateError.message };
  }

  const path = `/p/${proposal.slug}?t=${proposal.access_token}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL || SITE_URL;
  return { ok: true, url: `${site}${path}`, path, clientId: proposal.client_id, title: proposal.title };
}
