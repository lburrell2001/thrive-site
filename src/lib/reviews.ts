// Asking a client for a review, and reading reviews for the site.
//
// A request creates a reviews row with a private token and sends the link
// through clientNotify's deliver(), so the same consent rule applies as for
// every other client message: email always, text only with opt-in. Each
// request is logged to client_reminders (target_type 'review'), which puts
// it on the contact's CRM timeline.

import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { crmContact, deliver, type DeliveryReport } from '@/lib/clientNotify';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';
import { supabase } from '@/lib/supabaseServer';
import type { PublicReview } from '@/types/review';

const SERVICE_SLUGS = Object.keys(SERVICE_SEO) as [ServiceSlug, ...ServiceSlug[]];

export const requestReviewSchema = z.object({
  contact_id: z.string().uuid(),
  deal_id: z.string().uuid().nullish(),
  service_slug: z.enum(SERVICE_SLUGS).nullish(),
  channels: z.object({ email: z.boolean(), sms: z.boolean() }),
  note: z.string().trim().max(600).optional(),
}).refine((v) => v.channels.email || v.channels.sms, { message: 'Choose email, text, or both' });

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10, 'Write a sentence or two').max(2000),
  display_name: z.string().trim().min(1, 'Add your name').max(80),
  display_role: z.string().trim().max(120).optional().transform((v) => v || null),
  consent_publish: z.boolean(),
});

export class ReviewError extends Error {}

export async function requestReview(
  db: SupabaseClient,
  input: z.infer<typeof requestReviewSchema>,
  site: string,
): Promise<{ reviewId: string; report: DeliveryReport }> {
  const contact = await crmContact(db, input.contact_id);
  if (!contact) throw new ReviewError('Contact not found');
  if (!contact.email && !contact.phone) throw new ReviewError('This contact has no email or phone number');

  const token = randomBytes(24).toString('base64url');
  const { data: review, error } = await db
    .from('reviews')
    .insert({
      token,
      crm_contact_id: input.contact_id,
      crm_deal_id: input.deal_id ?? null,
      service_slug: input.service_slug ?? null,
      display_name: contact.name || null,
      status: 'requested',
      requested_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new ReviewError(error.message);

  const service = input.service_slug ? SERVICE_SEO[input.service_slug].name.toLowerCase() : null;
  const link = `${site}/review/${token}`;
  const subject = 'Thank you for working with Thrive';
  const report = await deliver(
    db,
    contact,
    {
      subject,
      eyebrow: 'Thank you',
      headline: `Thank you for trusting me with your ${service ?? 'project'}. It was a real pleasure working with you, and I hope we get to work together again soon.`,
      detail: `If you have two minutes, would you leave a short review? It is one page: a rating and a sentence or two. With your okay I will share it on the website${process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ? ', and you will get a link to post it on Google too' : ''} — that is how other businesses find a small studio like mine.`,
      note: input.note || null,
      ctaUrl: link,
      ctaLabel: 'Leave a review',
      sms: 'Thank you so much for working with me — I hope we get to do it again soon! If you have two minutes, would you leave a quick review?',
    },
    input.channels,
  );

  await db.from('client_reminders').insert({
    target_type: 'review',
    target_id: review.id,
    portal_client_id: contact.portalClientId,
    proposal_client_id: contact.proposalClientId,
    subject,
    note: input.note || null,
    email_status: report.email.status,
    email_to: report.email.to,
    email_error: report.email.error,
    sms_status: report.sms.status,
    sms_to: report.sms.to,
    sms_error: report.sms.error,
  });

  if (report.email.status !== 'sent' && report.sms.status !== 'sent') {
    // Nothing reached them; don't leave a request that looks sent.
    await db.from('reviews').delete().eq('id', review.id);
    throw new ReviewError(report.email.error ?? report.sms.error ?? 'The request could not be sent');
  }
  return { reviewId: review.id, report };
}

/**
 * Approved reviews for a service page, featured first. Falls back to the
 * studio's best reviews when the service has none of its own yet.
 */
export async function reviewsForService(slug: ServiceSlug, limit = 3): Promise<PublicReview[]> {
  const columns = 'id, service_slug, display_name, display_role, rating, body, featured, approved_at';
  const { data: own } = await supabase
    .from('reviews')
    .select(columns)
    .eq('service_slug', slug)
    .order('featured', { ascending: false })
    .order('approved_at', { ascending: false })
    .limit(limit) as { data: PublicReview[] | null };
  if (own && own.length) return own;

  const { data: general } = await supabase
    .from('reviews')
    .select(columns)
    .order('featured', { ascending: false })
    .order('approved_at', { ascending: false })
    .limit(limit) as { data: PublicReview[] | null };
  return general ?? [];
}
