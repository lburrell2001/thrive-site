// The client's estimate: /e/<id>?t=<token>, opened from the Send email. At
// the bottom: export the PDF, or accept — which turns it into an invoice in
// their portal (see accept/route.ts).

import { notFound } from 'next/navigation';
import { estimateForClientPdf, loadClientEstimate } from '@/lib/estimateAccess';
import { EstimatePaper, estimateTotalLabel } from '@/components/estimate/EstimatePaper';
import { EstimateActions } from './EstimateActions';
import { EstimateChoices } from './EstimateChoices';
import { hasChoices } from '@/lib/lineItems';
import { choiceTotal } from '@/lib/estimateChoice';

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string | string[] }> };

const day = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default async function ClientEstimatePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const t = (await searchParams).t;
  const token = Array.isArray(t) ? t[0] : t;
  const est = await loadClientEstimate(id, token);
  if (!est) notFound();

  const pdf = estimateForClientPdf(est);
  const accepted = !!est.accepted_at;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
  const expired = !accepted && !!est.valid_until && est.valid_until < today;

  return (
    <main>
      {accepted && (
        <p className="proposalNotice proposalNoticeGood">
          Accepted{est.accepted_by ? ` by ${est.accepted_by}` : ''} on {day(est.accepted_at!)}.{' '}
          {est.invoice_id ? (<>Your invoice is ready in your client portal.{' '}
            <a href="/portal/invoices" style={{ color: 'inherit', fontWeight: 700 }}>Open your portal →</a></>)
            : 'We’ll set up your client portal and send your invoice there.'}
        </p>
      )}
      {est.status === 'declined' && !accepted && (
        <p className="proposalNotice">
          You let us know you’re not going ahead{est.declined_at ? ` on ${day(est.declined_at)}` : ''}{est.decline_reason ? `: “${est.decline_reason}”` : '.'} Changed your mind? Reply to the email this came in and we’ll reopen it.
        </p>
      )}
      {expired && (
        <p className="proposalNotice proposalNoticeWarn">
          This estimate was good until {day(est.valid_until!)}. Reply to the email it came in and we’ll send a fresh one.
        </p>
      )}

      {hasChoices(est.line_items) && !accepted ? (
        <EstimateChoices
          id={est.id}
          token={token!}
          pdf={pdf}
          clientName={est.client_name || null}
          initial={choiceTotal(est.line_items, est.selection).selection}
          initialTotal={(() => { const c = choiceTotal(est.line_items, est.selection); return { cents: c.total_cents, label: c.label }; })()}
          canAccept={!expired && est.status !== 'declined' && est.status !== 'invoiced'}
          declined={est.status === 'declined'}
          invoiced={!!est.invoice_id}
        />
      ) : (<>
      <EstimatePaper pdf={pdf} clientName={est.client_name || null} />

      <EstimateActions
        id={est.id}
        token={token!}
        pdf={pdf}
        clientName={est.client_name || null}
        totalLabel={estimateTotalLabel(pdf)}
        accepted={accepted || est.status === 'invoiced'}
        canAccept={!accepted && !expired && est.status !== 'declined' && est.status !== 'invoiced'}
        declined={est.status === 'declined'}
        invoiced={!!est.invoice_id}
      />
      </>)}
    </main>
  );
}
