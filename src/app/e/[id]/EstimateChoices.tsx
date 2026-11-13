'use client';

// An estimate with tiers or optional extras (migration 061), before it's
// accepted: the client picks an option (required — nothing is preselected)
// and ticks extras, on the paper or in the Accept dialog (one shared choice);
// the total is worked out on the server for each choice (POST quote — the
// page never gets the lines a totals-only estimate hides), and Accept sends it.

import { useRef, useState } from 'react';
import { EstimatePaper } from '@/components/estimate/EstimatePaper';
import { optionTotals, type InvoiceForPDF } from '@/lib/invoicePDF';
import { formatLineMoney, type LineSelection } from '@/lib/lineItems';
import { EstimateActions } from './EstimateActions';

export function EstimateChoices({ id, token, pdf, clientName, initial, initialTotal, canAccept, declined, invoiced, ranged = false }: {
  id: string; token: string; pdf: InvoiceForPDF; clientName: string | null; ranged?: boolean;
  initial: LineSelection; initialTotal: { cents: number; label: string };
  canAccept: boolean; declined: boolean; invoiced: boolean;
}) {
  const [selection, setSelection] = useState<LineSelection>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [pricing, setPricing] = useState(false);
  const asked = useRef(0);

  /** A new choice: show it at once, and ask the server for its total (the latest answer wins). */
  const options = optionTotals(pdf);
  const extrasList = (pdf.line_items ?? []).filter((r) => r.optional && r.source !== undefined)
    .map((r) => ({ source: r.source!, name: r.name, description: r.description, amount_cents: r.amount_cents }));
  const chosen = !options.length || !!selection.tier;

  /** If the server can't be reached: the option's total plus the ticked extras (the server works out the real one on accept). */
  function fallback(next: LineSelection) {
    const base = options.find((o) => o.tier === next.tier)?.total_cents ?? initialTotal.cents;
    const cents = base + extrasList.filter((x) => next.optional.includes(x.source)).reduce((sum, x) => sum + x.amount_cents, 0);
    setTotal({ cents, label: formatLineMoney(cents) });
  }

  function choose(next: LineSelection) {
    setSelection(next);
    // No total until an option is picked.
    if (options.length && !next.tier) return;
    const n = ++asked.current;
    setPricing(true);
    fetch(`/e/${id}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, selection: next }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b: { total_cents?: number; label?: string }) => {
        if (n !== asked.current) return;
        if (typeof b.total_cents === 'number') setTotal({ cents: b.total_cents, label: b.label ?? '' });
        else fallback(next);
      })
      .catch(() => { if (n === asked.current) fallback(next); })
      .finally(() => { if (n === asked.current) setPricing(false); });
  }

  const shownTotal = !chosen ? 'Choose an option' : pricing ? '…' : total.label;
  const onTier = (tier: string) => choose({ ...selection, tier });
  const onExtra = (source: number, on: boolean) =>
    choose({ ...selection, optional: on ? [...new Set([...selection.optional, source])].sort((a, b) => a - b) : selection.optional.filter((x) => x !== source) });

  return (
    <>
      <EstimatePaper
        pdf={{ ...pdf, amount_cents: total.cents }}
        clientName={clientName}
        totalLabel={shownTotal}
        choose={canAccept ? { selection, onTier, onExtra } : undefined}
      />
      <EstimateActions
        id={id}
        token={token}
        pdf={{ ...pdf, amount_cents: total.cents, selection }}
        clientName={clientName}
        totalLabel={shownTotal}
        accepted={false}
        canAccept={canAccept}
        declined={declined}
        invoiced={invoiced}
        ranged={ranged}
        chooser={{ options, extras: extrasList, selection, onTier, onExtra }}
        pricing={pricing}
      />
    </>
  );
}
