// Marketing campaigns: every piece that went out — print and email — with
// who it reached and what came of it.
//
// Print campaigns are logged here (marketing_campaigns + recipients).
// Email campaigns are the sent rows of `newsletters`; one-to-one emails are
// `prospect_emails`. Both are read, not copied.
//
// "What came of it" is counted the same way for both, inside a window
// after the send (RESULT_DAYS): a reply or response, a deal opened (lead),
// a deal won. Print adds QR scans and inquiries tagged with the campaign's
// code, and Lauren can mark a recipient's outcome by hand when someone
// calls about a postcard.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export class MarketingError extends Error {}

/** How long after a send a reply, lead or win still counts towards it. */
export const RESULT_DAYS = 60;

export const PIECES = ['postcard', 'flyer', 'letter', 'door_hanger', 'brochure', 'leave_behind', 'other'] as const;
export type Piece = (typeof PIECES)[number];
export const OUTCOMES = ['sent', 'responded', 'lead', 'won', 'no_response'] as const;
export type Outcome = (typeof OUTCOMES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date');

export const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Name the campaign').max(120),
  piece: z.enum(PIECES),
  sent_on: isoDate.nullable(),
  cost_cents: z.number().int().min(0).max(100_000_000).nullable(),
  notes: z.string().max(4000),
  destination: z.string().trim().max(300).refine((v) => v.startsWith('/') && !v.startsWith('//'), 'Use a page on the site, like /portfolio'),
});

export const createCampaignSchema = campaignSchema.partial({ sent_on: true, cost_cents: true, notes: true, destination: true });
export const updateCampaignSchema = campaignSchema.partial().refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const addRecipientsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).max(2000).default([]),
  /** Everyone on the Prospects list with this tag (or every prospect, with all_prospects). */
  tag: z.string().trim().max(40).optional(),
  all_prospects: z.boolean().optional(),
});

export const outcomeSchema = z.object({
  contact_id: z.string().uuid(),
  outcome: z.enum(OUTCOMES),
  note: z.string().max(600).optional(),
});

export interface CampaignStats {
  reached: number;
  /** Replied to the email, or (print) marked as having got in touch. */
  responded: number;
  /** Recipients who opened a deal within the window, or were marked lead/won. */
  leads: number;
  won: number;
  won_cents: number;
  /** Print only. */
  scans?: number;
  scanners?: number;
  /** Print only: inquiries through the campaign's link, recipients or not. */
  inquiries?: number;
}

export interface CampaignRow {
  id: string;
  kind: 'print' | 'email' | 'direct';
  name: string;
  /** Print piece, or 'newsletter' / 'outreach' / 'one-to-one' for email. */
  piece: string;
  sent_on: string | null;
  cost_cents: number | null;
  code: string | null;
  href: string;
  stats: CampaignStats;
}

const DAY = 86_400_000;
const inWindow = (at: string | null | undefined, from: number) => {
  if (!at) return false;
  const t = Date.parse(at);
  return t >= from && t <= from + RESULT_DAYS * DAY;
};

/** Shared lookups for working out results. */
async function outcomesData(db: SupabaseClient, contactIds: string[]) {
  if (!contactIds.length) return { deals: [], replies: [] };
  const [deals, replies] = await Promise.all([
    db.from('crm_deals').select('contact_id, stage, value_cents, created_at').in('contact_id', contactIds),
    db.from('email_replies').select('contact_id, received_at').in('contact_id', contactIds),
  ]);
  return { deals: deals.data ?? [], replies: replies.data ?? [] };
}

type Lookups = Awaited<ReturnType<typeof outcomesData>>;

/** Results for people reached at `sentAt`. `manual` is print's hand-marked outcome per contact. */
function resultsFor(contactIds: string[], sentAt: string | null, data: Lookups, manual?: Map<string, Outcome>): Omit<CampaignStats, 'scans' | 'scanners' | 'inquiries'> {
  const from = sentAt ? Date.parse(sentAt) : 0;
  let responded = 0, leads = 0, won = 0, wonCents = 0;
  for (const id of contactIds) {
    const m = manual?.get(id);
    const replied = sentAt ? data.replies.some((r) => r.contact_id === id && inWindow(r.received_at, from)) : false;
    const deals = sentAt ? data.deals.filter((d) => d.contact_id === id && inWindow(d.created_at, from)) : [];
    const wonDeals = deals.filter((d) => d.stage === 'won');
    const isWon = m === 'won' || wonDeals.length > 0;
    const isLead = isWon || m === 'lead' || deals.length > 0;
    if (isLead || replied || m === 'responded') responded += 1;
    if (isLead) leads += 1;
    if (isWon) { won += 1; wonCents += wonDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0); }
  }
  return { reached: contactIds.length, responded, leads, won, won_cents: wonCents };
}

// ------------------------------------------------------------- list

export async function loadCampaigns(db: SupabaseClient): Promise<CampaignRow[]> {
  const [print, recipients, scans, emails, emailSends, direct] = await Promise.all([
    db.from('marketing_campaigns').select('*').order('sent_on', { ascending: false, nullsFirst: true }),
    db.from('marketing_recipients').select('campaign_id, contact_id, outcome'),
    db.from('marketing_scans').select('campaign_id, visitor'),
    db.from('newsletters').select('id, subject, audience, sent_at, recipient_count').eq('status', 'sent').order('sent_at', { ascending: false }),
    db.from('newsletter_sends').select('newsletter_id, contact_id').eq('status', 'sent'),
    db.from('prospect_emails').select('contact_id, sent_at').eq('status', 'sent').gte('sent_at', new Date(Date.now() - 90 * DAY).toISOString()),
  ]);
  if (print.error) throw new MarketingError(print.error.message);

  const codes = (print.data ?? []).map((c) => c.code);
  const { data: inquiries } = codes.length
    ? await db.from('contact_inquiries').select('utm_campaign').in('utm_campaign', codes)
    : { data: [] as { utm_campaign: string }[] };

  const everyone = [...new Set([
    ...(recipients.data ?? []).map((r) => r.contact_id),
    ...(emailSends.data ?? []).map((r) => r.contact_id).filter(Boolean),
    ...(direct.data ?? []).map((r) => r.contact_id).filter(Boolean),
  ])] as string[];
  const data = await outcomesData(db, everyone);

  const rows: CampaignRow[] = [];
  for (const c of print.data ?? []) {
    const mine = (recipients.data ?? []).filter((r) => r.campaign_id === c.id);
    const manual = new Map(mine.map((r) => [r.contact_id, r.outcome as Outcome]));
    const s = (scans.data ?? []).filter((x) => x.campaign_id === c.id);
    rows.push({
      id: c.id, kind: 'print', name: c.name, piece: c.piece, sent_on: c.sent_on, cost_cents: c.cost_cents, code: c.code,
      href: `/admin/crm/campaigns/${c.id}`,
      stats: {
        ...resultsFor(mine.map((r) => r.contact_id), c.sent_on ? `${c.sent_on}T00:00:00` : null, data, manual),
        scans: s.length,
        scanners: new Set(s.map((x) => x.visitor)).size,
        inquiries: (inquiries ?? []).filter((i) => i.utm_campaign === c.code).length,
      },
    });
  }
  for (const n of emails.data ?? []) {
    const ids = (emailSends.data ?? []).filter((r) => r.newsletter_id === n.id && r.contact_id).map((r) => r.contact_id as string);
    rows.push({
      id: n.id, kind: 'email', name: n.subject || 'Untitled email',
      piece: ['prospects', 'prospect_tag', 'contacts'].includes(n.audience) ? 'outreach' : 'newsletter',
      sent_on: n.sent_at?.slice(0, 10) ?? null, cost_cents: null, code: null,
      href: `/admin/crm/emails/${n.id}`,
      stats: resultsFor(ids, n.sent_at, data),
    });
  }
  // One-to-one emails, as one line: each person counted from their own send.
  const byContact = new Map<string, string>();
  for (const e of direct.data ?? []) {
    if (e.contact_id && (!byContact.has(e.contact_id) || e.sent_at < byContact.get(e.contact_id)!)) byContact.set(e.contact_id, e.sent_at);
  }
  if (byContact.size) {
    const totals = { reached: 0, responded: 0, leads: 0, won: 0, won_cents: 0 };
    for (const [id, at] of byContact) {
      const r = resultsFor([id], at, data);
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
    }
    rows.push({
      id: 'one-to-one', kind: 'direct', name: 'One-to-one emails (last 90 days)', piece: 'one-to-one',
      sent_on: null, cost_cents: null, code: null, href: '/admin/crm/prospects', stats: totals,
    });
  }
  return rows;
}

// ----------------------------------------------------------- detail

export interface RecipientRow {
  contact_id: string;
  name: string;
  company: string | null;
  email: string | null;
  outcome: Outcome;
  outcome_at: string | null;
  note: string;
  /** What the CRM saw on its own since the send. */
  auto: { replied: boolean; deal: boolean; won: boolean; inquiry: boolean };
}

export async function loadCampaign(db: SupabaseClient, id: string) {
  const { data: c } = await db.from('marketing_campaigns').select('*').eq('id', id).maybeSingle();
  if (!c) return null;
  const [recipients, scans, inquiries] = await Promise.all([
    db.from('marketing_recipients').select('contact_id, outcome, outcome_at, note, crm_contacts ( name, company, email )').eq('campaign_id', id).order('created_at'),
    db.from('marketing_scans').select('visitor, device, scanned_at').eq('campaign_id', id).order('scanned_at', { ascending: false }).limit(2000),
    db.from('contact_inquiries').select('id, name, crm_contact_id, created_at').eq('utm_campaign', c.code).order('created_at', { ascending: false }),
  ]);
  const ids = (recipients.data ?? []).map((r) => r.contact_id);
  const data = await outcomesData(db, ids);
  const from = c.sent_on ? Date.parse(`${c.sent_on}T00:00:00`) : null;
  const inquiryContacts = new Set((inquiries.data ?? []).map((i) => i.crm_contact_id));

  const rows: RecipientRow[] = (recipients.data ?? []).map((r) => {
    const who = r.crm_contacts as unknown as { name: string; company: string | null; email: string | null } | null;
    const deals = from === null ? [] : data.deals.filter((d) => d.contact_id === r.contact_id && inWindow(d.created_at, from));
    return {
      contact_id: r.contact_id,
      name: who?.name || who?.email || 'Unnamed',
      company: who?.company ?? null,
      email: who?.email ?? null,
      outcome: r.outcome as Outcome,
      outcome_at: r.outcome_at,
      note: r.note,
      auto: {
        replied: from !== null && data.replies.some((x) => x.contact_id === r.contact_id && inWindow(x.received_at, from)),
        deal: deals.length > 0,
        won: deals.some((d) => d.stage === 'won'),
        inquiry: inquiryContacts.has(r.contact_id),
      },
    };
  });

  const manual = new Map(rows.map((r) => [r.contact_id, r.outcome]));
  const scanRows = scans.data ?? [];
  // Scans per day, for the little chart.
  const byDay = new Map<string, number>();
  for (const s of scanRows) {
    const day = new Date(s.scanned_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  return {
    campaign: c,
    recipients: rows,
    stats: {
      ...resultsFor(ids, c.sent_on ? `${c.sent_on}T00:00:00` : null, data, manual),
      scans: scanRows.length,
      scanners: new Set(scanRows.map((s) => s.visitor)).size,
      inquiries: (inquiries.data ?? []).length,
    } as CampaignStats,
    scansByDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => ({ day, n })),
    inquiries: (inquiries.data ?? []).map((i) => ({ id: i.id, name: i.name, contact_id: i.crm_contact_id, created_at: i.created_at })),
  };
}

// ----------------------------------------------------------- writes

/** A short-link code from the name: "Fall postcard 2026" → fall-postcard-2026. */
export async function uniqueCode(db: SupabaseClient, name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 32).replace(/^-|-$/g, '') || 'print';
  for (let i = 0; i < 50; i += 1) {
    const code = i ? `${base}-${i + 1}` : base;
    const { data } = await db.from('marketing_campaigns').select('id').eq('code', code).maybeSingle();
    if (!data) return code.length >= 2 ? code : `${code}-1`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function addRecipients(db: SupabaseClient, campaignId: string, input: z.infer<typeof addRecipientsSchema>) {
  let ids = [...input.contact_ids];
  if (input.tag || input.all_prospects) {
    let q = db.from('crm_contacts').select('id').eq('prospect_status', 'prospect');
    if (input.tag) q = q.contains('tags', [input.tag]);
    const { data } = await q;
    ids = [...ids, ...(data ?? []).map((r) => r.id)];
  }
  ids = [...new Set(ids)];
  if (!ids.length) throw new MarketingError('Nobody to add');
  const { error } = await db
    .from('marketing_recipients')
    .upsert(ids.map((contact_id) => ({ campaign_id: campaignId, contact_id })), { onConflict: 'campaign_id,contact_id', ignoreDuplicates: true });
  if (error) throw new MarketingError(error.message);
  return ids.length;
}

/**
 * Mark how a recipient responded. Marking someone a lead opens a deal for
 * them (if they have no open one), which also moves a prospect onto the
 * pipeline — the same as a reply to an email would.
 */
export async function setOutcome(db: SupabaseClient, campaignId: string, input: z.infer<typeof outcomeSchema>) {
  const { data: c } = await db.from('marketing_campaigns').select('name, piece').eq('id', campaignId).maybeSingle();
  if (!c) throw new MarketingError('Campaign not found');
  const { error } = await db
    .from('marketing_recipients')
    .update({ outcome: input.outcome, outcome_at: input.outcome === 'sent' ? null : new Date().toISOString(), ...(input.note !== undefined ? { note: input.note } : {}) })
    .eq('campaign_id', campaignId)
    .eq('contact_id', input.contact_id);
  if (error) throw new MarketingError(error.message);

  if (input.outcome === 'lead') {
    const { data: open } = await db.from('crm_deals').select('id').eq('contact_id', input.contact_id).in('stage', ['lead', 'contacted', 'proposal']).limit(1);
    if (!open?.length) {
      await db.from('crm_deals').insert({ contact_id: input.contact_id, title: `From ${c.name}`.slice(0, 160), stage: 'lead', source: 'print' });
    }
  }
  if (input.outcome !== 'sent') {
    await db.from('crm_activities').insert({
      contact_id: input.contact_id,
      kind: 'note',
      body: `${c.name}: ${{ responded: 'got in touch', lead: 'became a lead', won: 'became a client', no_response: 'no response' }[input.outcome]}.${input.note ? ` ${input.note}` : ''}`,
    });
  }
}
