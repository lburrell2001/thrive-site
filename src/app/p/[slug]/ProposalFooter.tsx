import { SignAction } from './SignAction';

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
  termsUrl,
}: {
  slug: string;
  token: string;
  totalLabel: string;
  depositLabel: string;
  /** The PDF route. It redirects to the print dialog if Chrome is unavailable. */
  pdfHref: string;
  signed: boolean;
  signedAt: string | null;
  termsUrl?: string;
}) {
  return (
    <div className="proposalFooter">
      <div style={{ minWidth: 0 }}>
        <div className="proposalFooterLabel">
          {signed ? 'Approved' : 'Total'} · {depositLabel}
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

        {signed ? (
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
        ) : (
          <SignAction slug={slug} token={token} pdfHref={pdfHref} termsUrl={termsUrl} />
        )}
      </div>
    </div>
  );
}
