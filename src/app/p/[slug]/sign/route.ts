export const runtime = 'nodejs';

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import {
  firstParam,
  proposalServiceClient,
  resolveProposalAccess,
} from '@/lib/proposalAccess';
import {
  buildSignatureSnapshot,
  depositCentsFor,
  parseIpAddress,
} from '@/lib/proposalSignature';
import { sendSigningEmails } from '@/lib/proposalEmails';
import { textAgency } from '@/lib/sms';
import { pdfFilename } from '@/lib/proposalPdf';
import { proposalPdfUrl, proposalPrintUrl, resolveSiteOrigin } from '@/lib/proposalUrls';
import { formatMoney } from '@/components/proposal/context';
import { syncProposalEstimate } from '@/lib/proposalEstimate';
import { afterAccept } from '@/lib/acceptedPortal';
import { choiceTotalFor } from '@/lib/proposalChoices';
import { totalCents, type LineItem } from '@/lib/lineItems';

/**
 * Fetch the proposal PDF over HTTP rather than rendering it in this function.
 *
 * That keeps headless Chrome out of the signing bundle entirely — this route
 * stays small and cold-starts fast, which matters because a client is
 * watching a spinner while it runs.
 */
async function fetchProposalPdf(
  origin: string,
  proposalId: string,
  token: string,
  title: string,
): Promise<{ filename: string; content: Buffer } | null> {
  try {
    const res = await fetch(proposalPdfUrl(origin, proposalId, token), {
      headers: { accept: 'application/pdf' },
      redirect: 'manual',
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/pdf')) return null;
    return {
      filename: pdfFilename(title),
      content: Buffer.from(await res.arrayBuffer()),
    };
  } catch (error) {
    console.error('Could not attach proposal PDF to the receipt:', error);
    return null;
  }
}

const signRequestSchema = z.object({
  signerName: z.string().trim().min(1, 'Enter your full name').max(160),
  signerEmail: z.string().trim().email('Enter a valid email address').max(200),
  signerTitle: z.string().trim().max(160).optional(),
  typedName: z.string().trim().min(1, 'Type your name to sign').max(160),
  agreedTerms: z.literal(true, { message: 'You need to agree to the terms to approve' }),
  /** The token also arrives in the body so the POST works without a referer. */
  token: z.string().min(1).max(64),
  /** Tiers and optional extras (migration 061): the option and the extras (line ids) they picked. */
  selection: z.object({
    tier: z.string().trim().max(80).nullable(),
    optional: z.array(z.string().uuid()).max(100),
  }).optional(),
});

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Record a client's approval.
 *
 * Order matters: the signature and the status change are written before any
 * email is attempted, so a mail outage can never lose an agreement the client
 * has already given.
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

  const parsed = signRequestSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid request');

  const input = parsed.data;

  // Same gate as the page: the token must match before anything is read.
  const url = new URL(req.url);
  const token = input.token || firstParam(url.searchParams.get('t') ?? undefined);
  const access = await resolveProposalAccess(slug, token);
  if (!access.ok) return fail('This link is not valid', 404);

  const { row, renderable } = access.loaded;

  if (row.status === 'signed') {
    return fail('This proposal has already been approved.', 409);
  }
  if (row.status === 'declined') {
    return fail('This proposal is no longer open for approval.', 409);
  }

  // Their choice of option and extras decides the total they're signing for.
  const choice = choiceTotalFor(renderable.lineItems, input.selection);
  const agreedCents = choice ? choice.total_cents : renderable.totalCents;

  const db = proposalServiceClient();
  const signedAt = new Date();
  const ipAddress = parseIpAddress(req.headers.get('x-forwarded-for'));
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  // Freeze what was on screen. A later edit to the proposal changes the live
  // document and leaves this row exactly as it is.
  const snapshot = buildSignatureSnapshot(
    renderable.blocks,
    agreedCents,
    renderable.currency,
  );

  const { error: signatureError } = await db.from('proposal_signatures').insert({
    proposal_id: row.id,
    signer_name: input.signerName,
    signer_email: input.signerEmail,
    signer_title: input.signerTitle || null,
    typed_name: input.typedName,
    agreed_terms: true,
    ip_address: ipAddress,
    user_agent: userAgent,
    blocks_snapshot: snapshot.blocks,
    content_hash: snapshot.contentHash,
    total_cents: agreedCents,
    signed_at: signedAt.toISOString(),
  });

  if (signatureError) {
    console.error('Failed to record signature:', signatureError.message);
    return fail('We could not record your approval. Please try again.', 500);
  }

  // Its estimate, brought up to date before it's frozen as accepted.
  const synced = await syncProposalEstimate(db, row.id);
  const estimateId = synced.ok ? synced.estimate?.id ?? null : null;

  const { error: statusError } = await db
    .from('proposals')
    .update({ status: 'signed', signed_at: signedAt.toISOString(), ...(choice ? { total_cents: agreedCents } : {}) })
    .eq('id', row.id);

  if (statusError) console.error('Signature saved but status not updated:', statusError.message);

  // Signed: the estimate is accepted. With a portal it becomes an invoice in
  // their project folder (the deposit due now, the rest when Lauren opens it);
  // without one, Lauren is asked to set the portal up (src/lib/acceptedPortal.ts).
  let invoiceReady = false;
  let needsSetup = false;
  if (estimateId) {
    // The estimate's lines follow the proposal's (by position): the chosen extras by index.
    if (choice) {
      const order = [...renderable.lineItems].sort((a, b) => a.position - b.position).filter((i) => i.label.trim());
      const selection = { tier: choice.selection.tier, optional: choice.selection.optional.map((id) => order.findIndex((i) => i.id === id)).filter((i) => i >= 0) };
      const { data: estRow } = await db.from('estimates').select('line_items').eq('id', estimateId).maybeSingle();
      const total = totalCents((estRow?.line_items ?? []) as LineItem[], selection);
      const { error: selErr } = await db.from('estimates').update({ selection, total_cents: total }).eq('id', estimateId);
      if (selErr) console.error('[sign] selection not saved (run migration 061?)', row.id, selErr.message);
    }
    await db.from('estimates').update({ accepted_at: signedAt.toISOString(), accepted_by: input.signerName, accepted_ip: ipAddress }).eq('id', estimateId).is('accepted_at', null);
    const next = await afterAccept(db, estimateId, { depositPercent: renderable.depositPercent });
    invoiceReady = next.invoiceReady;
    needsSetup = next.needsSetup;
    if (next.error) console.error('[sign] invoice not made', row.id, next.error);
  }

  await db.from('proposal_events').insert({
    proposal_id: row.id,
    type: 'signed',
    metadata: {
      signer_email: input.signerEmail,
      ip: ipAddress,
      user_agent: userAgent,
      content_hash: snapshot.contentHash,
      total_cents: agreedCents,
    },
  });

  const depositCents = depositCentsFor(agreedCents, renderable.depositPercent);
  const site = resolveSiteOrigin(req);

  // Rendering a PDF and sending two emails takes seconds. The client is
  // watching a spinner, and their approval is already committed, so this runs
  // after the response goes out rather than inside it.
  after(async () => {
    // First, so a slow PDF render does not delay the good news.
    await textAgency(needsSetup
      ? `Signed: ${renderable.title} by ${input.signerName} — ${formatMoney(agreedCents, renderable.currency)}. Set up their portal: ${site}/admin#portal-accepted`
      : `Signed: ${renderable.title} by ${input.signerName} — ${formatMoney(agreedCents, renderable.currency)}. ${site}/admin/crm/proposals/${row.id}/edit`,
    );
    const pdf = await fetchProposalPdf(site, row.id, row.access_token, renderable.title);
    await sendSigningEmails({
      proposalTitle: renderable.title,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      signerTitle: input.signerTitle || null,
      typedName: input.typedName,
      signedAt: signedAt.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Chicago',
      }),
      totalLabel: formatMoney(agreedCents, renderable.currency),
      depositLabel: formatMoney(depositCents, renderable.currency),
      depositPercent: renderable.depositPercent,
      proposalUrl: `${site}/p/${slug}?t=${row.access_token}`,
      printUrl: `${proposalPrintUrl(site, slug, row.access_token)}&print=1`,
      portalUrl: `${site}/portal/invoices`,
      adminUrl: `${site}/admin/crm/proposals/${row.id}/edit`,
      needsSetup,
      setupUrl: `${site}/admin#portal-accepted`,
      contentHash: snapshot.contentHash,
      ipAddress,
      pdf,
    });
  });

  return NextResponse.json({
    ok: true,
    data: {
      signedAt: signedAt.toISOString(),
      totalLabel: formatMoney(agreedCents, renderable.currency),
      depositLabel: formatMoney(depositCents, renderable.currency),
      depositPercent: renderable.depositPercent,
      portalPath: '/portal/invoices',
      invoiceReady,
      needsSetup,
      receiptEmail: input.signerEmail,
    },
  });
}
