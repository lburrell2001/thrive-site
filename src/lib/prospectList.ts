// The Prospects list: people Lauren is reaching out to who haven't shown
// interest yet. They have no deal; replying, sending an inquiry or getting
// a deal by hand converts them (database trigger) and they move to the
// pipeline.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ProspectRow } from '@/types/crm';

export async function loadProspects(db: SupabaseClient): Promise<ProspectRow[]> {
  const { data: people, error } = await db
    .from('crm_contacts')
    .select('id, name, company, email, website, tags, prospected_at, created_at, newsletter_status')
    .eq('prospect_status', 'prospect')
    .order('prospected_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  const ids = (people ?? []).map((p) => p.id);
  if (!ids.length) return [];

  // Both kinds of send: one-to-one and to an audience.
  const [direct, campaigns] = await Promise.all([
    db.from('prospect_emails').select('contact_id, subject, sent_at').in('contact_id', ids).eq('status', 'sent'),
    db.from('newsletter_sends').select('contact_id, sent_at, newsletters ( subject )').in('contact_id', ids).eq('status', 'sent'),
  ]);
  const stats = new Map<string, { n: number; at: string | null; subject: string | null }>();
  const add = (id: string | null, at: string, subject: string | null) => {
    if (!id) return;
    const cur = stats.get(id) ?? { n: 0, at: null, subject: null };
    cur.n += 1;
    if (!cur.at || at > cur.at) { cur.at = at; cur.subject = subject; }
    stats.set(id, cur);
  };
  for (const e of direct.data ?? []) add(e.contact_id, e.sent_at, e.subject);
  for (const e of campaigns.data ?? []) add(e.contact_id, e.sent_at, (e.newsletters as unknown as { subject: string } | null)?.subject ?? null);

  return (people ?? []).map((p) => ({
    ...p,
    tags: p.tags ?? [],
    emails_sent: stats.get(p.id)?.n ?? 0,
    last_emailed_at: stats.get(p.id)?.at ?? null,
    last_subject: stats.get(p.id)?.subject ?? null,
  }));
}

const prospectInput = z.object({
  name: z.string().trim().max(160).default(''),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  company: z.string().trim().max(160).optional().transform((v) => v || null),
  website: z.string().trim().max(300).optional().transform((v) => v || null),
});

export const addProspectsSchema = z.object({
  people: z.array(prospectInput).min(1, 'Add at least one person').max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export interface AddResult {
  added: number;
  /** Already in the CRM: made prospects if they had nothing else going on, otherwise left alone. */
  existing: { email: string; name: string; why: string }[];
}

/**
 * Add prospects, by hand or pasted in bulk. Someone already in the CRM is
 * never duplicated: a contact with no deals becomes a prospect; one with
 * deals (a lead or client) is left as they are.
 */
export async function addProspects(db: SupabaseClient, input: z.infer<typeof addProspectsSchema>): Promise<AddResult> {
  const byEmail = new Map(input.people.map((p) => [p.email, p]));
  const emails = [...byEmail.keys()];
  const { data: found } = await db.from('crm_contacts').select('id, name, email, prospect_status, newsletter_status, tags').in('email', emails);
  const existingIds = (found ?? []).map((c) => c.id);
  const { data: deals } = existingIds.length
    ? await db.from('crm_deals').select('contact_id').in('contact_id', existingIds)
    : { data: [] as { contact_id: string }[] };
  const withDeals = new Set((deals ?? []).map((d) => d.contact_id));

  const result: AddResult = { added: 0, existing: [] };
  const now = new Date().toISOString();
  for (const c of found ?? []) {
    byEmail.delete(c.email);
    const name = c.name || c.email;
    if (withDeals.has(c.id)) { result.existing.push({ email: c.email, name, why: 'already a lead or client' }); continue; }
    if (c.prospect_status === 'prospect') { result.existing.push({ email: c.email, name, why: 'already a prospect' }); continue; }
    const tags = [...new Set([...(c.tags ?? []), ...input.tags])];
    await db.from('crm_contacts').update({ prospect_status: 'prospect', prospected_at: now, tags }).eq('id', c.id);
    result.existing.push({ email: c.email, name, why: c.newsletter_status === 'unsubscribed' ? 'added, but unsubscribed — won’t be emailed' : 'was in the CRM; now a prospect' });
  }

  const rows = [...byEmail.values()].map((p) => ({
    name: p.name || '',
    email: p.email,
    company: p.company,
    website: p.website,
    tags: input.tags,
    source: 'prospecting',
    prospect_status: 'prospect',
    prospected_at: now,
  }));
  if (rows.length) {
    const { error } = await db.from('crm_contacts').insert(rows);
    if (error) throw new Error(error.message);
    result.added = rows.length;
  }
  return result;
}
