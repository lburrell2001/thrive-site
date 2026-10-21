// The Prospects list: people Lauren is reaching out to who haven't shown
// interest yet, by email or by Instagram/Facebook DM. They have no deal;
// replying, sending an inquiry or getting a deal by hand converts them
// (database trigger) and they move to the pipeline.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ProspectRow } from '@/types/crm';
import { facebookField, instagramField } from '@/lib/crmSchemas';
import { readDm, type DmPlatform } from '@/lib/social';

export async function loadProspects(db: SupabaseClient): Promise<ProspectRow[]> {
  const list = (social: boolean) => db
    .from('crm_contacts')
    .select(`id, name, company, email, website, ${social ? 'instagram, facebook, ' : ''}tags, prospected_at, created_at, newsletter_status`)
    .eq('prospect_status', 'prospect')
    .order('prospected_at', { ascending: false, nullsFirst: false })
    .returns<Omit<ProspectRow, 'emails_sent' | 'last_emailed_at' | 'last_subject' | 'dms_sent' | 'last_dm_at' | 'last_dm_platform'>[]>();
  let { data: people, error } = await list(true);
  // Before migration 037 there are no Instagram / Facebook columns.
  if (error?.code === '42703') {
    ({ data: people, error } = await list(false));
    people = (people ?? []).map((p) => ({ ...p, instagram: null, facebook: null }));
  }
  if (error) throw new Error(error.message);
  const ids = (people ?? []).map((p) => p.id);
  if (!ids.length) return [];

  // Both kinds of send: one-to-one and to an audience. DMs are logged by hand.
  const [direct, campaigns, dms] = await Promise.all([
    db.from('prospect_emails').select('contact_id, subject, sent_at').in('contact_id', ids).eq('status', 'sent'),
    db.from('newsletter_sends').select('contact_id, sent_at, newsletters ( subject )').in('contact_id', ids).eq('status', 'sent'),
    db.from('crm_activities').select('contact_id, created_at, metadata').in('contact_id', ids).eq('kind', 'dm'),
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

  const dmStats = new Map<string, { n: number; at: string; platform: DmPlatform }>();
  for (const a of dms.data ?? []) {
    const dm = readDm(a.metadata);
    if (dm?.direction !== 'sent') continue;
    const cur = dmStats.get(a.contact_id);
    if (!cur) dmStats.set(a.contact_id, { n: 1, at: a.created_at, platform: dm.platform });
    else { cur.n += 1; if (a.created_at > cur.at) { cur.at = a.created_at; cur.platform = dm.platform; } }
  }

  return (people ?? []).map((p) => ({
    ...p,
    tags: p.tags ?? [],
    emails_sent: stats.get(p.id)?.n ?? 0,
    last_emailed_at: stats.get(p.id)?.at ?? null,
    last_subject: stats.get(p.id)?.subject ?? null,
    dms_sent: dmStats.get(p.id)?.n ?? 0,
    last_dm_at: dmStats.get(p.id)?.at ?? null,
    last_dm_platform: dmStats.get(p.id)?.platform ?? null,
  }));
}

const prospectInput = z
  .object({
    name: z.string().trim().max(160).default(''),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || z.email().safeParse(v).success, 'Enter a valid email'),
    company: z.string().trim().max(160).optional().transform((v) => v || null),
    website: z.string().trim().max(300).optional().transform((v) => v || null),
    instagram: instagramField,
    facebook: facebookField,
  })
  .refine((p) => p.email || p.instagram || p.facebook, 'Add an email, Instagram or Facebook');

export const addProspectsSchema = z.object({
  people: z.array(prospectInput).min(1, 'Add at least one person').max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

type ProspectInput = z.infer<typeof prospectInput>;

export interface AddResult {
  added: number;
  /** Already in the CRM: made prospects if they had nothing else going on, otherwise left alone. */
  existing: { who: string; name: string; why: string }[];
}

/** How a person is named in the results: their email, else their handle. */
function whoOf(p: { email: string | null; instagram: string | null; facebook: string | null }): string {
  return p.email ?? (p.instagram ? `@${p.instagram}` : `facebook.com/${p.facebook}`);
}

type Found = {
  id: string; name: string; email: string | null; instagram: string | null; facebook: string | null;
  prospect_status: string | null; newsletter_status: string | null; tags: string[] | null;
};

/**
 * Add prospects, by hand or pasted in bulk. Someone already in the CRM —
 * matched on email, Instagram or Facebook — is never duplicated: a contact
 * with no deals becomes a prospect; one with deals (a lead or client) is
 * left as they are. Either way a handle they didn't have yet is saved.
 */
export async function addProspects(db: SupabaseClient, input: z.infer<typeof addProspectsSchema>): Promise<AddResult> {
  // One entry per person, even if the same one is pasted twice.
  const people: ProspectInput[] = [];
  const seen = new Set<string>();
  for (const p of input.people) {
    const keys = [p.email && `e:${p.email}`, p.instagram && `i:${p.instagram}`, p.facebook && `f:${p.facebook}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    people.push(p);
  }

  const emails = people.map((p) => p.email).filter((v): v is string => Boolean(v));
  const igs = people.map((p) => p.instagram).filter((v): v is string => Boolean(v));
  const fbs = people.map((p) => p.facebook).filter((v): v is string => Boolean(v));
  const cols = 'id, name, email, instagram, facebook, prospect_status, newsletter_status, tags';
  const lookups = await Promise.all([
    emails.length ? db.from('crm_contacts').select(cols).in('email', emails) : null,
    igs.length ? db.from('crm_contacts').select(cols).in('instagram', igs) : null,
    fbs.length ? db.from('crm_contacts').select(cols).in('facebook', fbs) : null,
  ]);
  const found = new Map<string, Found>();
  for (const r of lookups) for (const c of (r?.data ?? []) as Found[]) found.set(c.id, c);
  const all = [...found.values()];

  const existingIds = all.map((c) => c.id);
  const { data: deals } = existingIds.length
    ? await db.from('crm_deals').select('contact_id').in('contact_id', existingIds)
    : { data: [] as { contact_id: string }[] };
  const withDeals = new Set((deals ?? []).map((d) => d.contact_id));

  const result: AddResult = { added: 0, existing: [] };
  const now = new Date().toISOString();
  const rows = [];
  for (const p of people) {
    const c = all.find((x) =>
      (p.email && x.email === p.email) || (p.instagram && x.instagram === p.instagram) || (p.facebook && x.facebook === p.facebook));
    if (!c) {
      rows.push({
        name: p.name || '',
        email: p.email,
        company: p.company,
        website: p.website,
        instagram: p.instagram,
        facebook: p.facebook,
        tags: input.tags,
        source: 'prospecting',
        prospect_status: 'prospect',
        prospected_at: now,
      });
      continue;
    }

    const name = c.name || whoOf(c);
    // Fill in what we didn't know, never overwrite what we did.
    const fill: Record<string, unknown> = {};
    if (!c.email && p.email) fill.email = p.email;
    if (!c.instagram && p.instagram) fill.instagram = p.instagram;
    if (!c.facebook && p.facebook) fill.facebook = p.facebook;

    let why: string;
    if (withDeals.has(c.id)) why = 'already a lead or client';
    else if (c.prospect_status === 'prospect') why = 'already a prospect';
    else {
      Object.assign(fill, { prospect_status: 'prospect', prospected_at: now, tags: [...new Set([...(c.tags ?? []), ...input.tags])] });
      why = c.newsletter_status === 'unsubscribed' ? 'added, but unsubscribed — won’t be emailed' : 'was in the CRM; now a prospect';
    }
    if (Object.keys(fill).length) await db.from('crm_contacts').update(fill).eq('id', c.id);
    result.existing.push({ who: whoOf(p), name, why });
  }

  if (rows.length) {
    const { error } = await db.from('crm_contacts').insert(rows);
    if (error) throw new Error(error.message);
    result.added = rows.length;
  }
  return result;
}
