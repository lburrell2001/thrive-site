export const runtime = 'nodejs';

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import {
  firstParam,
  proposalServiceClient,
  resolveProposalAccess,
} from '@/lib/proposalAccess';
import { parseIpAddress } from '@/lib/proposalSignature';
import { sendDeclineEmails } from '@/lib/proposalEmails';
import { textAgency } from '@/lib/sms';
import { resolveSiteOrigin } from '@/lib/proposalUrls';
import { formatMoney } from '@/components/proposal/context';

const declineRequestSchema = z.object({
  /** The reason is the point of the whole flow, so it is required. */
  reason: z.string().trim().min(1, 'Tell us briefly why, so we can learn from it').max(2000),
  declinedBy: z.string().trim().max(160).optional(),
  declinerEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  token: z.string().min(1).max(64),
});

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Record that a client is not going ahead, and why.
 *
 * Deliberately lighter than signing: no typed signature, no frozen snapshot,
 * and the name and email are optional. Declining should be easy to do
 * honestly — the reason is what has value, and asking for identity first is
 * how you end up with no reason at all.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid request');
  }

  const parsed = declineRequestSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid request');

  const input = parsed.data;
  const url = new URL(req.url);
  const token = input.token || firstParam(url.searchParams.get('t') ?? undefined);

  const access = await resolveProposalAccess(slug, token);
  if (!access.ok) return fail('This link is not valid', 404);

  const { row, renderable } = access.loaded;

  if (row.status === 'signed') {
    return fail('This proposal has already been approved.', 409);
  }
  if (row.status === 'declined') {
    return fail('This proposal has already been declined.', 409);
  }

  const db = proposalServiceClient();
  const declinedAt = new Date();
  const ipAddress = parseIpAddress(req.headers.get('x-forwarded-for'));
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  const { error: updateError } = await db
    .from('proposals')
    .update({
      status: 'declined',
      declined_at: declinedAt.toISOString(),
      decline_reason: input.reason,
    })
    .eq('id', row.id);

  if (updateError) {
    console.error('Failed to record decline:', updateError.message);
    return fail('We could not record that. Please try again.', 500);
  }

  // The full detail lives in the event log, which survives a re-publish.
  await db.from('proposal_events').insert({
    proposal_id: row.id,
    type: 'declined',
    metadata: {
      reason: input.reason,
      declined_by: input.declinedBy || null,
      decliner_email: input.declinerEmail || null,
      ip: ipAddress,
      user_agent: userAgent,
      total_cents: renderable.totalCents,
    },
  });

  const site = resolveSiteOrigin(req);

  // Sent after the response, like the signing mail — the decision is already
  // recorded and the client should not wait on SMTP.
  after(async () => {
    await sendDeclineEmails({
      proposalTitle: renderable.title,
      declinedBy: input.declinedBy || null,
      declinerEmail: input.declinerEmail || null,
      reason: input.reason,
      declinedAt: declinedAt.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Chicago',
      }),
      totalLabel: formatMoney(renderable.totalCents, renderable.currency),
      proposalUrl: `${site}/p/${slug}?t=${row.access_token}`,
      adminUrl: `${site}/admin/proposals/${row.id}/edit`,
      ipAddress,
    });
    await textAgency(
      `Declined: ${renderable.title}${input.declinedBy ? ` by ${input.declinedBy}` : ''}. Reason: ${input.reason.slice(0, 200)} ${site}/admin/proposals/${row.id}/edit`,
    );
  });

  return NextResponse.json({
    ok: true,
    data: { declinedAt: declinedAt.toISOString(), acknowledged: Boolean(input.declinerEmail) },
  });
}
