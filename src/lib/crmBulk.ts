// Deleting contacts and moving them between Leads and Prospects, one or
// many at a time (the contact panel, and the select bars on Contacts and
// Prospects).
//
// Lifecycle comes from deals (lifecycleOf in shared.ts), so moving is
// about deals:
//   → Lead      opens a New lead deal for anyone without an open one. The
//               crm_convert_prospect trigger takes them off Prospects.
//   → Prospect  closes their open deals as Lost ("Moved to Prospects") and
//               puts them on the list. Lost, not deleted, so proposals and
//               stage history keep their deal. Clients stay clients.
// Deleting removes the contact with their deals, notes and tasks (all
// cascade); inquiries, proposals and portal accounts just stop pointing here.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const MOVED_REASON = 'Moved to Prospects';
const OPEN = ['lead', 'contacted', 'proposal'];

export const bulkSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ action: z.literal('move'), to: z.enum(['lead', 'prospect']), ids: z.array(z.string().uuid()).min(1).max(500) }),
]);

export type BulkInput = z.infer<typeof bulkSchema>;

export class BulkError extends Error {}

/** How many changed, and how many were left alone (with why). */
export interface BulkResult { changed: number; skipped: number; note: string | null }

export async function runBulk(db: SupabaseClient, input: BulkInput): Promise<BulkResult> {
  if (input.action === 'delete') {
    const { data, error } = await db.from('crm_contacts').delete().in('id', input.ids).select('id');
    if (error) throw new BulkError(error.message);
    return { changed: data?.length ?? 0, skipped: input.ids.length - (data?.length ?? 0), note: null };
  }

  const [{ data: people, error }, { data: deals }] = await Promise.all([
    db.from('crm_contacts').select('id, name, email, company, portal_client_id').in('id', input.ids),
    db.from('crm_deals').select('id, contact_id, stage').in('contact_id', input.ids),
  ]);
  if (error) throw new BulkError(error.message);
  const dealsOf = (id: string) => (deals ?? []).filter((d) => d.contact_id === id);

  if (input.to === 'lead') {
    const ready = (people ?? []).filter((c) => !dealsOf(c.id).some((d) => OPEN.includes(d.stage)));
    if (ready.length) {
      const { error: insertError } = await db.from('crm_deals').insert(ready.map((c) => ({
        contact_id: c.id,
        title: c.company?.trim() || c.name?.trim() || c.email || 'New project',
        stage: 'lead',
        source: 'manual',
      })));
      if (insertError) throw new BulkError(insertError.message);
    }
    const skipped = input.ids.length - ready.length;
    return { changed: ready.length, skipped, note: skipped ? 'already a lead' : null };
  }

  // → Prospect. Clients (a portal login or a won deal) stay where they are.
  const isClient = (c: { id: string; portal_client_id: string | null }) =>
    Boolean(c.portal_client_id) || dealsOf(c.id).some((d) => d.stage === 'won');
  const movable = (people ?? []).filter((c) => !isClient(c));
  const ids = movable.map((c) => c.id);
  if (ids.length) {
    // The stage trigger logs each one on the contact's timeline.
    const { error: dealError } = await db
      .from('crm_deals')
      .update({ stage: 'lost', lost_reason: MOVED_REASON })
      .in('contact_id', ids)
      .in('stage', OPEN);
    if (dealError) throw new BulkError(dealError.message);
    const { error: contactError } = await db
      .from('crm_contacts')
      .update({ prospect_status: 'prospect', prospected_at: new Date().toISOString() })
      .in('id', ids);
    if (contactError) throw new BulkError(contactError.message);
  }
  const skipped = input.ids.length - ids.length;
  return { changed: ids.length, skipped, note: skipped ? 'clients stay clients' : null };
}
