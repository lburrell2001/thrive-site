'use client';

// "Estimate (PDF)" on the proposal page: the estimate that goes with the
// proposal, made in the browser with the same PDF as admin. The page hands
// over only the rows the PDF prints (category subtotals when the proposal
// hides line prices), never the hidden line prices.

import { useState } from 'react';
import type { InvoiceForPDF } from '@/lib/invoicePDF';

export function EstimateDownload({ estimate, clientName }: { estimate: InvoiceForPDF; clientName: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="proposalFooterAction"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { generateInvoicePDF } = await import('@/lib/invoicePDF');
          await generateInvoicePDF(estimate, clientName);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Making the PDF…' : 'Estimate (PDF)'}
    </button>
  );
}
