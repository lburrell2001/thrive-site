// Public client view. Server-rendered; no Supabase credential of any kind
// reaches the browser, and nothing is read from the database until the
// access token in the URL has been checked against the row.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { after } from 'next/server';
import { LinkHelp } from '@/components/LinkHelp';
import { reportBrokenLink } from '@/lib/linkRecovery';
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
import type { InvoiceForPDF } from '@/lib/invoicePDF';
import { estimateForClientPdf } from '@/lib/estimateAccess';
import { EstimatePaper } from '@/components/estimate/EstimatePaper';
import { endTotals, hasProposalRange, proposalChoices, proposalPhases, rangeLabel } from '@/lib/proposalChoices';

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
  // A link missing its key (cut off by a mail app, or half copied): never a
  // dead end — the client can get a fresh link, and Lauren is told.
  if (!access.ok) {
    after(async () => {
      const db = proposalServiceClient();
      const { data } = await db.from('proposals').select('id, title, status, proposal_clients ( name, company )').eq('slug', slug).maybeSingle();
      if (data && data.status !== 'draft') {
        const who = (Array.isArray(data.proposal_clients) ? data.proposal_clients[0] : data.proposal_clients) as { name?: string; company?: string } | null;
        await reportBrokenLink(db, {
          key: `proposal:${data.id}`, label: `Proposal “${data.title}”`,
          client: who?.name || who?.company || null, path: `/admin/crm/proposals/${data.id}`,
        });
      }
    });
    return <LinkHelp kind="proposal" path={`/p/${slug}`} dark />;
  }

  const { row, renderable } = access.loaded;

  const headerList = await headers();
  await recordProposalView(proposalServiceClient(), row, {
    userAgent: headerList.get('user-agent'),
    ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    referer: headerList.get('referer'),
  });

  const deposit = depositCents(renderable.totalCents, renderable.depositPercent);
  // Tiers and optional extras (migration 061): the client picks in the sign dialog; the footer shows the lowest option.
  const choices = proposalChoices(renderable.lineItems);
  // Phases (migration 062): approved phase by phase, no total or deposit.
  const pricingBlock = renderable.blocks.find((b) => b.type === 'pricing');
  const phases = proposalPhases(renderable.lineItems, pricingBlock?.type === 'pricing' ? pricingBlock.content.phaseTimelines : null);
  // Price ranges (migration 063): a low – high price, finalised in an estimate after approval.
  const rangeLines = renderable.lineItems.filter((i) => !i.is_optional);
  const ranged = !phases && hasProposalRange(rangeLines);
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

      {renderable.status === 'signed' && ranged && (
        <Notice tone="good">
          Approved — thank you. We’ll send you the estimate with the final price before anything is
          invoiced.
        </Notice>
      )}

      {renderable.status === 'signed' && phases && (
        <Notice tone="good">
          Approved — thank you. We’ll send you the estimate for each phase you approved before
          anything is invoiced.
        </Notice>
      )}

      {renderable.status === 'signed' && !phases && !ranged && (
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

      {estimate && (
        <section aria-label="Your estimate">
          <h2 className="estimateSectionTitle">Your estimate</h2>
          <EstimatePaper pdf={estimate} clientName={renderable.client?.company || renderable.client?.name || null} />
        </section>
      )}

      <ProposalFooter
        slug={slug}
        token={token ?? ''}
        totalLabel={phases ? `${phases.length} phase${phases.length === 1 ? '' : 's'}`
          : ranged && !choices?.tiers.length ? (() => { const e = endTotals(rangeLines); return rangeLabel(e.low, e.high, (c) => formatMoney(c, renderable.currency)); })()
          : choices?.tiers.length && renderable.status !== 'signed' ? `${choices.tiers.length} options` : formatMoney(renderable.totalCents, renderable.currency)}
        depositLabel={phases ? 'Each phase on its own terms' : ranged ? 'Price range · final price in your estimate'
          : choices?.tiers.length && renderable.status !== 'signed' ? (renderable.depositPercent > 0 && renderable.depositPercent < 100 ? `${renderable.depositPercent}% deposit on the option you choose` : 'Choose one when you approve') : `${renderable.depositPercent}% deposit ${formatMoney(deposit, renderable.currency)}`}
        phases={phases}
        ranged={ranged}
        tiered={!!choices?.tiers.length && renderable.status !== 'signed'}
        rangeLowCents={ranged ? (() => { const e = endTotals(rangeLines); return e.low.oneTime + e.low.monthly; })() : undefined}
        rangeHighCents={ranged ? (() => { const e = endTotals(rangeLines); return e.high.oneTime + e.high.monthly; })() : undefined}
        pdfHref={`/api/proposals/${row.id}/pdf?t=${encodeURIComponent(token ?? '')}`}
        signed={renderable.status === 'signed'}
        signedAt={row.signed_at}
        declined={renderable.status === 'declined'}
        termsUrl={termsUrl}
        estimate={estimate}
        clientName={renderable.client?.company || renderable.client?.name || null}
        choices={choices}
        currency={renderable.currency}
        totalCents={renderable.totalCents}
        depositPercent={renderable.depositPercent}
      />
    </main>
  );
}

/** The proposal's estimate as the client may see it (rows already collapsed). */
async function estimateForClient(id: string | null): Promise<InvoiceForPDF | null> {
  if (!id) return null;
  const { data: est } = await proposalServiceClient().from('estimates')
    .select('estimate_number, title, line_items, notes, total_cents, issue_date, valid_until, totals_only')
    .eq('id', id).maybeSingle();
  if (!est || !Array.isArray(est.line_items) || !est.line_items.length) return null;
  return estimateForClientPdf(est as Parameters<typeof estimateForClientPdf>[0]);
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
