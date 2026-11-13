import type { ProposalChoices, ProposalPhase } from '@/lib/proposalChoices';
import { DeclineAction } from './DeclineAction';
import { ApproveAction } from './ApproveAction';
import { EstimateDownload } from './EstimateDownload';
import type { InvoiceForPDF } from '@/lib/invoicePDF';

/**
 * Sticky footer on the client view: what it costs, what is due on approval,
 * and the two things a client can do — keep a copy, or approve it.
 *
 * Server component. Only the sign button and its modal are interactive, so
 * that is the only JavaScript this page ships.
 */
export function ProposalFooter({
  slug,
  token,
  totalLabel,
  depositLabel,
  pdfHref,
  signed,
  signedAt,
  declined,
  termsUrl,
  estimate,
  clientName,
  choices,
  currency,
  totalCents,
  depositPercent,
  phases,
}: {
  slug: string;
  token: string;
  totalLabel: string;
  depositLabel: string;
  /** The PDF route. It redirects to the print dialog if Chrome is unavailable. */
  pdfHref: string;
  signed: boolean;
  signedAt: string | null;
  declined: boolean;
  termsUrl?: string;
  /** The estimate that goes with the proposal, as the PDF prints it. */
  estimate?: InvoiceForPDF | null;
  clientName?: string | null;
  /** Tiers and optional extras (migration 061), chosen in the sign dialog. */
  choices?: ProposalChoices | null;
  currency?: string;
  totalCents?: number;
  depositPercent?: number;
  /** Phases (migration 062): approved phase by phase. */
  phases?: ProposalPhase[] | null;
}) {
  return (
    <div className="proposalFooter">
      <div style={{ minWidth: 0 }}>
        <div className="proposalFooterLabel">
          {signed ? 'Approved' : phases ? 'Phased' : 'Total'} · {depositLabel}
        </div>
        <div className="proposalFooterTotal">{totalLabel}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          className="proposalFooterAction"
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Save as PDF
        </a>

        {estimate && <EstimateDownload estimate={estimate} clientName={clientName ?? null} />}

        {signed && (
          <span className="proposalFooterSigned">
            Approved
            {signedAt
              ? ` ${new Date(signedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}`
              : ''}
          </span>
        )}

        {declined && <span className="proposalFooterDeclined">Declined</span>}

        {!signed && !declined && (
          <>
            <DeclineAction slug={slug} token={token} />
            <ApproveAction slug={slug} token={token} pdfHref={pdfHref} termsUrl={termsUrl} choices={choices} currency={currency}
              totalCents={totalCents ?? 0} depositPercent={depositPercent ?? 0} phases={phases} />
          </>
        )}
      </div>
    </div>
  );
}
