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
  const token = firstParam((await searchParams).t);

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

      <ProposalRenderer
        blocks={renderable.blocks}
        theme={renderable.theme}
        mode="web"
        currency={renderable.currency}
        totalCents={renderable.totalCents}
        lineItems={renderable.lineItems}
        imageUrls={renderable.imageUrls}
        headerNote={renderable.theme.headerNote}
      />

      <ProposalFooter
        slug={slug}
        token={token ?? ''}
        totalLabel={formatMoney(renderable.totalCents, renderable.currency)}
        depositLabel={`${renderable.depositPercent}% deposit ${formatMoney(deposit, renderable.currency)}`}
        pdfHref={`/api/proposals/${row.id}/pdf?t=${encodeURIComponent(token ?? '')}`}
        signed={renderable.status === 'signed'}
        signedAt={row.signed_at}
        termsUrl={termsUrl}
      />
    </main>
  );
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
