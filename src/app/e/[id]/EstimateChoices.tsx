'use client';

// An estimate with tiers or optional extras (migration 061), before it's
// accepted: the client picks an option and ticks extras on the paper; the
// total is worked out on the server for each choice (POST quote — the page
// never gets the lines a totals-only estimate hides), and Accept sends it.

import { useRef, useState } from 'react';
import { EstimatePaper } from '@/components/estimate/EstimatePaper';
import type { InvoiceForPDF } from '@/lib/invoicePDF';
import type { LineSelection } from '@/lib/lineItems';
import { EstimateActions } from './EstimateActions';

export function EstimateChoices({ id, token, pdf, clientName, initial, initialTotal, canAccept, declined, invoiced }: {
  id: string; token: string; pdf: InvoiceForPDF; clientName: string | null;
  initial: LineSelection; initialTotal: { cents: number; label: string };
  canAccept: boolean; declined: boolean; invoiced: boolean;
}) {
  const [selection, setSelection] = useState<LineSelection>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [pricing, setPricing] = useState(false);
  const asked = useRef(0);

  /** A new choice: show it at once, and ask the server for its total (the latest answer wins). */
  function choose(next: LineSelection) {
    setSelection(next);
    const n = ++asked.current;
    setPricing(true);
    fetch(`/e/${id}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, selection: next }),
    })
      .then((r) => r.json())
      .then((b: { total_cents?: number; label?: string }) => {
        if (n === asked.current && typeof b.total_cents === 'number') setTotal({ cents: b.total_cents, label: b.label ?? '' });
      })
      .catch(() => {})
      .finally(() => { if (n === asked.current) setPricing(false); });
  }

  const extras = selection.optional.length;
  const choiceLabel = [selection.tier, extras ? `${extras} extra${extras > 1 ? 's' : ''}` : null].filter(Boolean).join(' + ');

  return (
    <>
      <EstimatePaper
        pdf={{ ...pdf, amount_cents: total.cents }}
        clientName={clientName}
        totalLabel={pricing ? '…' : total.label}
        choose={canAccept ? {
          selection,
          onTier: (tier) => choose({ ...selection, tier }),
          onExtra: (source, on) => choose({ ...selection, optional: on ? [...new Set([...selection.optional, source])].sort((a, b) => a - b) : selection.optional.filter((x) => x !== source) }),
        } : undefined}
      />
      <EstimateActions
        id={id}
        token={token}
        pdf={{ ...pdf, amount_cents: total.cents, selection }}
        clientName={clientName}
        totalLabel={pricing ? '…' : total.label}
        accepted={false}
        canAccept={canAccept}
        declined={declined}
        invoiced={invoiced}
        selection={selection}
        choiceLabel={choiceLabel || undefined}
        pricing={pricing}
      />
    </>
  );
}
