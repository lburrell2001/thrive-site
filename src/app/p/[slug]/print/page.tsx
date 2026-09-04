// Print-optimised render. Same data, same <ProposalRenderer />, mode="print".
// Phase 5's headless-Chrome route loads exactly this page.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import '@/styles/proposal-print.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalRenderer } from '@/components/proposal/ProposalRenderer';
import { firstParam, resolveProposalAccess } from '@/lib/proposalAccess';
import { AutoPrint } from './AutoPrint';

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

export default async function ProposalPrintPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const token = firstParam(query.t);

  const access = await resolveProposalAccess(slug, token);
  if (!access.ok) notFound();

  const { renderable } = access.loaded;

  // Opening the print route is not the client reading the proposal, so it
  // does not advance status or log a view. Phase 5 logs a 'downloaded' event
  // from the PDF route instead.

  return (
    <div className="proposalPrintRoot">
      <AutoPrint enabled={firstParam(query.print) === '1'} />
      <div className="proposalPrintSheet">
        <ProposalRenderer
          blocks={renderable.blocks}
          theme={renderable.theme}
          mode="print"
          currency={renderable.currency}
          totalCents={renderable.totalCents}
          lineItems={renderable.lineItems}
          imageUrls={renderable.imageUrls}
          headerNote={renderable.theme.headerNote}
        />
      </div>
    </div>
  );
}
