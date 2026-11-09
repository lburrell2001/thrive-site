// Public client view. Server-rendered; no Supabase credential of any kind
// reaches the browser, and nothing is read from the database until the
// access token in the URL has been checked against the row.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalRenderer } from '@/components/proposal/ProposalRenderer';
import {
  firstParam,
  proposalServiceClient,
  recordProposalView,
  resolveProposalAccess,
} from '@/lib/proposalAccess';
import { depositCents } from '@/lib/proposalRepo';
import { formatMoney } from '@/components/proposal/context';
import { ProposalFooter } from './ProposalFooter';
import { clientRows, type LineItem } from '@/lib/lineItems';
import type { InvoiceForPDF } from '@/lib/invoicePDF';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The PDF viewer's title bar and the browser tab both read this. Without it
 * they show the marketing site's default title, which is not what a client
 * saving a copy of their own proposal should see.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const access = await resolveProposalAccess(slug, firstParam((await searchParams).t));
  return {
    title: access.ok ? access.loaded.renderable.title : 'Proposal',
    robots: { index: false, follow: false },
  };
}

export default async function PublicProposalPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const token = firstParam(query.t);
  // Opened from the client portal's Proposals page: offer the way back.
  const fromPortal = firstParam(query.from) === 'portal';

  const access = await resolveProposalAccess(slug, token);
  if (!access.ok) notFound();

  const { row, renderable } = access.loaded;

  const headerList = await headers();
  await recordProposalView(proposalServiceClient(), row, {
    userAgent: headerList.get('user-agent'),
    ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    referer: headerList.get('referer'),
  });

  const deposit = depositCents(renderable.totalCents, renderable.depositPercent);
  const estimate = await estimateForClient(row.estimate_id ?? null);

  // The terms link lives on the signature block, and the modal needs it.
  const signatureBlock = renderable.blocks.find((block) => block.type === 'signature');
  const termsUrl =
    signatureBlock?.type === 'signature' ? signatureBlock.content.termsUrl : undefined;
  const expired =
    renderable.validUntil !== null &&
    renderable.status !== 'signed' &&
    new Date(renderable.validUntil) < new Date(new Date().toDateString());

  return (
    <main>
      {fromPortal && (
        <a href="/portal/proposals" className="proposalNotice proposalNoticeGood" style={{ display: 'block', textDecoration: 'none' }}>
          ← Back to your portal
        </a>
      )}
      {expired && (
        <Notice tone="warn">
          This proposal was valid through{' '}
          {new Date(`${renderable.validUntil}T00:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          . It is still readable — reply to the email it came in and we will refresh the dates.
        </Notice>
      )}

      {renderable.status === 'signed' && (
        <Notice tone="good">
          Approved. A receipt has been emailed to you — the deposit can be paid in your client
          portal.
        </Notice>
      )}

      {renderable.status === 'declined' && (
        <Notice tone="warn">
          You let us know this is not going ahead
          {renderable.declineReason ? ` — “${renderable.declineReason}”` : ''}. Reply to the email
          this came in if anything changes.
        </Notice>
      )}

      <ProposalRenderer
        blocks={renderable.blocks}
        theme={renderable.theme}
        mode="web"
        currency={renderable.currency}
        totalCents={renderable.totalCents}
        lineItems={renderable.lineItems}
        imageUrls={renderable.imageUrls}
        headerNote={renderable.theme.headerNote}
        depositPercent={renderable.depositPercent}
        clientName={renderable.client?.name}
      />

      <ProposalFooter
        slug={slug}
        token={token ?? ''}
        totalLabel={formatMoney(renderable.totalCents, renderable.currency)}
        depositLabel={`${renderable.depositPercent}% deposit ${formatMoney(deposit, renderable.currency)}`}
        pdfHref={`/api/proposals/${row.id}/pdf?t=${encodeURIComponent(token ?? '')}`}
        signed={renderable.status === 'signed'}
        signedAt={row.signed_at}
        declined={renderable.status === 'declined'}
        termsUrl={termsUrl}
        estimate={estimate}
        clientName={renderable.client?.company || renderable.client?.name || null}
      />
    </main>
  );
}

/**
 * The proposal's estimate as the client may see it: the rows its PDF prints
 * (category subtotals when it's totals-only), already collapsed here so the
 * page never carries a line price the proposal hides.
 */
async function estimateForClient(id: string | null): Promise<InvoiceForPDF | null> {
  if (!id) return null;
  const { data: est } = await proposalServiceClient().from('estimates')
    .select('estimate_number, title, line_items, notes, total_cents, issue_date, valid_until, totals_only')
    .eq('id', id).maybeSingle();
  if (!est || !Array.isArray(est.line_items) || !est.line_items.length) return null;
  const rows = clientRows(est.line_items as LineItem[], !!est.totals_only);
  return {
    kind: 'estimate',
    invoice_number: est.estimate_number,
    project_name: est.title,
    amount_cents: est.total_cents,
    invoice_date: est.issue_date,
    due_date: est.valid_until ?? '',
    status: 'sent',
    notes: est.notes,
    totals_only: false,
    line_items: rows.map((r) => ({
      name: r.name,
      // A monthly row keeps its "/mo", so the PDF still shows it apart.
      description: r.monthly && !r.oneTime ? `${r.description} /mo`.trim() : r.description,
      hours: r.hours,
      rate_cents: null,
      amount_cents: r.oneTime + r.monthly,
    })),
  };
}

function Notice({
  tone,
  children,
}: {
  tone: 'warn' | 'good';
  children: React.ReactNode;
}) {
  return (
    <p className={`proposalNotice proposalNotice${tone === 'warn' ? 'Warn' : 'Good'}`}>
      {children}
    </p>
  );
}
