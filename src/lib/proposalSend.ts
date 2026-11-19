// Sending a proposal: publish it, then email the client a button to it (from
// Lauren's Outlook when connected), and log it on their timeline. Used by the
// builder's Send (POST /api/proposals/[id]/email) and by scheduled sends
// (src/lib/scheduledSends.ts).

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { deliver, proposalClientContact, type Contact } from './clientNotify';
import { publishProposal } from './proposalPublish';
import { previousVersion } from './proposalAmend';
import { formatLineMoney } from './lineItems';

export async function sendProposalEmail(
  db: SupabaseClient, id: string, input: { email: string; note?: string },
): Promise<{ ok: true; to: string; url: string } | { ok: false; error: string; status?: number }> {
  const parsed = { data: input };
  const published = await publishProposal(db, id);
  if (!published.ok) return { ok: false, error: published.error, status: published.status };

  const { data: p } = await db.from('proposals').select('total_cents, deposit_percent, valid_until, crm_deal_id').eq('id', id).single();
  const found = published.clientId ? await proposalClientContact(db, published.clientId) : null;
  const contact: Contact = {
    ...(found ?? { portalClientId: null, proposalClientId: null, name: '', firstName: 'there', phone: null, smsOptIn: false, smsSource: null }),
    email: parsed.data.email,
  };
  const total = formatLineMoney(p!.total_cents);
  const until = p!.valid_until ? new Date(`${p!.valid_until}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  // An amended proposal (migration 068) says so, with what it was.
  const before = published.revision > 1 ? await previousVersion(db, id, published.revision) : null;
  const amended = published.revision > 1;
  const was = before && before.total_cents !== p!.total_cents ? formatLineMoney(before.total_cents) : null;
  const firstSent = before?.sent_at ? new Date(before.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Chicago' }) : null;
  const report = await deliver(db, contact, {
    subject: amended ? `Your updated proposal: ${published.title}` : `Your proposal: ${published.title}`,
    eyebrow: amended ? 'Your updated proposal' : 'Your proposal',
    headline: amended
      ? `I’ve updated your proposal for ${published.title}${firstSent ? `. It replaces the one I sent on ${firstSent}` : ''}, and the estimate inside is updated too. At the bottom you can save it as a PDF or approve and sign it — your invoice will be ready in your portal straight away.`
      : `Here’s your proposal for ${published.title}, with its estimate inside. At the bottom you can save it as a PDF or approve and sign it — your invoice will be ready in your portal straight away.`,
    detail: [`Proposal: ${published.title}`, was ? `Total: ${total} (was ${was})` : `Total: ${total}`, p!.deposit_percent > 0 && p!.deposit_percent < 100 ? `Deposit to start: ${p!.deposit_percent}%` : null, until && `Good until: ${until}`].filter(Boolean).join('\n'),
    note: parsed.data.note?.trim() || null,
    ctaUrl: published.url,
    ctaLabel: amended ? 'Review your updated proposal' : 'Review & sign your proposal',
    sms: null,
  }, { email: true, sms: false }, { fromInbox: true });
  if (report.email.status !== 'sent') return { ok: false, error: report.email.error ?? 'The email did not send' };

  // On the contact's timeline.
  const { data: rec } = published.clientId ? await db.from('proposal_clients').select('crm_contact_id').eq('id', published.clientId).maybeSingle() : { data: null };
  if (rec?.crm_contact_id) {
    await db.from('crm_activities').insert({
      contact_id: rec.crm_contact_id, kind: 'email',
      body: amended
        ? `Sent the amended proposal: ${published.title} (${was ? `was ${was}, now ` : ''}${total})`
        : `Sent proposal: ${published.title} (${total})`,
      metadata: { proposal_id: id, to: parsed.data.email },
      ...(p!.crm_deal_id ? { deal_id: p!.crm_deal_id } : {}),
    });
  }
  return { ok: true, to: input.email, url: published.url };
}

export const proposalSendSchema = z.object({ email: z.string().trim().email('Enter their email address'), note: z.string().max(2000).optional() });
