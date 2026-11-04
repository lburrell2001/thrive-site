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
import { normalizePhone } from '@/lib/phone';

export async function loadProspects(db: SupabaseClient): Promise<ProspectRow[]> {
  // Every column, so ones added later (social handles, job title) come back
  // once their migration is in, without breaking the list before.
  const { data: rows, error } = await db
    .from('crm_contacts')
    .select('*')
    .eq('prospect_status', 'prospect')
    .order('prospected_at', { ascending: false, nullsFirst: false })
    .returns<Omit<ProspectRow, 'emails_sent' | 'last_emailed_at' | 'last_subject' | 'dms_sent' | 'last_dm_at' | 'last_dm_platform' | 'texts_sent' | 'last_text_at'>[]>();
  if (error) throw new Error(error.message);
  const people = (rows ?? []).map((p) => ({ ...p, instagram: p.instagram ?? null, facebook: p.facebook ?? null, job_title: p.job_title ?? null }));
  const ids = (people ?? []).map((p) => p.id);
  if (!ids.length) return [];

  // Both kinds of send: one-to-one and to an audience. DMs and texts are logged by hand.
  const [direct, campaigns, dms] = await Promise.all([
    db.from('prospect_emails').select('contact_id, subject, sent_at').in('contact_id', ids).eq('status', 'sent'),
    db.from('newsletter_sends').select('contact_id, sent_at, newsletters ( subject )').in('contact_id', ids).eq('status', 'sent'),
    db.from('crm_activities').select('contact_id, kind, created_at, metadata').in('contact_id', ids).in('kind', ['dm', 'text']),
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
  const textStats = new Map<string, { n: number; at: string }>();
  for (const a of dms.data ?? []) {
    if (a.kind === 'text') {
      if ((a.metadata as { direction?: string } | null)?.direction !== 'sent') continue;
      const cur = textStats.get(a.contact_id);
      if (!cur) textStats.set(a.contact_id, { n: 1, at: a.created_at });
      else { cur.n += 1; if (a.created_at > cur.at) cur.at = a.created_at; }
      continue;
    }
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
    texts_sent: textStats.get(p.id)?.n ?? 0,
    last_text_at: textStats.get(p.id)?.at ?? null,
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
    job_title: z.string().trim().max(120).optional().transform((v) => v || null),
    website: z.string().trim().max(300).optional().transform((v) => v || null),
    instagram: instagramField,
    facebook: facebookField,
    // Stored as +1… so it matches however it was typed; a number that can't be read is dropped.
    phone: z.string().trim().max(40).optional().transform((v) => normalizePhone(v)),
  })
  .refine((p) => p.email || p.instagram || p.facebook || p.phone, 'Add an email, phone, Instagram or Facebook');

export const addProspectsSchema = z.object({
  people: z.array(prospectInput).min(1, 'Add at least one person').max(500),
  // Where they came from ("Small Business Expo Nov 2026") and anything else.
  tags: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
});

type ProspectInput = z.infer<typeof prospectInput>;

export interface AddResult {
  added: number;
  /** Already in the CRM: made prospects if they had nothing else going on, otherwise left alone. */
  existing: { who: string; name: string; why: string }[];
}

/** How a person is named in the results: their email, else their handle or phone. */
function whoOf(p: { email: string | null; instagram: string | null; facebook: string | null; phone: string | null }): string {
  return p.email ?? (p.instagram ? `@${p.instagram}` : p.facebook ? `facebook.com/${p.facebook}` : p.phone ?? '');
}

type Found = {
  id: string; name: string; email: string | null; instagram: string | null; facebook: string | null; phone: string | null; job_title?: string | null;
  prospect_status: string | null; newsletter_status: string | null; tags: string[] | null;
};

/**
 * Add prospects, by hand or pasted in bulk. Someone already in the CRM —
 * matched on email, phone, Instagram or Facebook — is never duplicated: a
 * contact with no deals becomes a prospect; one with deals (a lead or client)
 * keeps their stage. Either way, details they didn't have yet are saved and
 * the tags are added, so "met at the expo" lands on everyone met there.
 */
export async function addProspects(db: SupabaseClient, input: z.infer<typeof addProspectsSchema>): Promise<AddResult> {
  // One entry per person, even if the same one is pasted twice.
  const people: ProspectInput[] = [];
  const seen = new Set<string>();
  for (const p of input.people) {
    const keys = [p.email && `e:${p.email}`, p.instagram && `i:${p.instagram}`, p.facebook && `f:${p.facebook}`, p.phone && `p:${p.phone}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    people.push(p);
  }

  const emails = people.map((p) => p.email).filter((v): v is string => Boolean(v));
  const igs = people.map((p) => p.instagram).filter((v): v is string => Boolean(v));
  const fbs = people.map((p) => p.facebook).filter((v): v is string => Boolean(v));
  const phones = new Set(people.map((p) => p.phone).filter((v): v is string => Boolean(v)));
  const cols = 'id, name, email, instagram, facebook, phone, prospect_status, newsletter_status, tags';
  const lookups = await Promise.all([
    emails.length ? db.from('crm_contacts').select(cols).in('email', emails) : null,
    igs.length ? db.from('crm_contacts').select(cols).in('instagram', igs) : null,
    fbs.length ? db.from('crm_contacts').select(cols).in('facebook', fbs) : null,
    // Stored phones aren't all in one format, so compare them normalised.
    phones.size ? db.from('crm_contacts').select(cols).not('phone', 'is', null).limit(5000) : null,
  ]);
  const found = new Map<string, Found>();
  for (const r of lookups) {
    for (const c of (r?.data ?? []) as Found[]) {
      if (r === lookups[3] && !phones.has(normalizePhone(c.phone) ?? '')) continue;
      found.set(c.id, c);
    }
  }
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
      (p.email && x.email === p.email) || (p.instagram && x.instagram === p.instagram) || (p.facebook && x.facebook === p.facebook)
      || (p.phone && normalizePhone(x.phone) === p.phone));
    if (!c) {
      rows.push({
        name: p.name || '',
        email: p.email,
        company: p.company,
        website: p.website,
        instagram: p.instagram,
        facebook: p.facebook,
        phone: p.phone,
        ...(p.job_title ? { job_title: p.job_title } : {}),
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
    if (!c.phone && p.phone) fill.phone = p.phone;
    if (!c.job_title && p.job_title) fill.job_title = p.job_title;
    if (input.tags.some((t) => !(c.tags ?? []).includes(t))) fill.tags = [...new Set([...(c.tags ?? []), ...input.tags])];

    let why: string;
    if (withDeals.has(c.id)) why = 'already a lead or client';
    else if (c.prospect_status === 'prospect') why = 'already a prospect';
    else {
      Object.assign(fill, { prospect_status: 'prospect', prospected_at: now });
      why = c.newsletter_status === 'unsubscribed' ? 'added, but unsubscribed — won’t be emailed' : 'was in the CRM; now a prospect';
    }
    if (fill.tags && withDeals.has(c.id) || fill.tags && c.prospect_status === 'prospect') why += ', tagged';
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
