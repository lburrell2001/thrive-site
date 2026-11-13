'use client';

// A phased estimate (migration 062), before it's approved: each phase has a
// checkbox — on the paper and in the Approve dialog (one shared choice), all
// ticked to start. There's no grand total; approving sends Lauren a text to
// make the estimate for those phases (see accept/route.ts).

import { useState } from 'react';
import { EstimatePaper, phasesLabel } from '@/components/estimate/EstimatePaper';
import { phaseGroups, type InvoiceForPDF } from '@/lib/invoicePDF';
import { amountText, clientRows } from '@/lib/lineItems';
import { EstimateActions } from './EstimateActions';

export function EstimatePhases({ id, token, pdf, clientName, canAccept, declined }: {
  id: string; token: string; pdf: InvoiceForPDF; clientName: string | null; canAccept: boolean; declined: boolean;
}) {
  const groups = phaseGroups(clientRows(pdf.line_items ?? [], false));
  const [phases, setPhases] = useState<string[]>(groups.map((g) => g.name));
  const onToggle = (phase: string, on: boolean) =>
    setPhases((cur) => groups.map((g) => g.name).filter((n) => (n === phase ? on : cur.includes(n))));

  return (
    <>
      <EstimatePaper pdf={pdf} clientName={clientName} approve={canAccept ? { phases, onToggle } : undefined} />
      <EstimateActions
        id={id}
        token={token}
        pdf={pdf}
        clientName={clientName}
        totalLabel={phasesLabel(pdf)}
        accepted={false}
        canAccept={canAccept}
        declined={declined}
        phaser={{
          all: groups.map((g) => ({ name: g.name, terms: g.terms, timeline: g.timeline, amount: amountText(g.oneTime, g.monthly) })),
          selected: phases,
          onToggle,
        }}
      />
    </>
  );
}
