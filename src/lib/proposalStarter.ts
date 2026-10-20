// The starting layout for a new proposal, shaped like the printed ones
// (The Social Reserve, Sept 2026): an assignment page with the scope in
// purple panels, a how-it-works page that ends in the pricing, and the total
// and signature as one panel. The cover is there but hidden unless asked
// for, so it is one click to turn on.
//
// Only the structure is filled in — headings, kickers and the signer. The
// prose is left empty so nothing generic can go out to a client by mistake.

import { randomUUID } from 'node:crypto';
import { parseBlock } from '@/lib/proposalSchemas';
import type { ProposalBlock } from '@/types/proposal';

/** "OCT 19, 2026" in Dallas time — the running header's right-hand side. */
export function headerDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // "Sep" reads oddly in caps next to the others; the printed ones say SEPT.
  const month = get('month').toUpperCase().replace(/^SEP$/, 'SEPT');
  return `${month} ${get('day')}, ${get('year')}`;
}

export function starterBlocks({
  cover,
  clientName,
  projectName,
}: {
  cover: boolean;
  clientName?: string | null;
  projectName?: string | null;
}): ProposalBlock[] {
  const raw = [
    {
      type: 'cover',
      visible: cover,
      accent: 'green',
      content: {
        titleLine1: 'PROJECT',
        titleLine2: 'PROPOSAL',
        dateLabel: headerDate(),
        preparedFor: clientName ?? '',
        preparedBy: 'Thrive Creative Studios',
        heroOverlay: 'orange',
        projectName: projectName ?? undefined,
      },
    },
    {
      type: 'narrative',
      accent: 'magenta',
      content: { headingLine1: 'THE', headingLine2: 'ASSIGNMENT', kicker: 'WHAT YOU ARE GETTING', body: '' },
    },
    {
      type: 'feature_list',
      content: {
        kicker: 'EVERYTHING INCLUDED IN THIS ENGAGEMENT',
        items: [
          { title: '', description: '' },
          { title: '', description: '' },
          { title: '', description: '' },
        ],
      },
    },
    {
      type: 'narrative',
      accent: 'orange',
      content: { headingLine1: 'HOW IT WORKS', headingLine2: '& PRICING', kicker: '', body: '' },
    },
    {
      type: 'pricing',
      accent: 'magenta',
      content: { intro: '', deliverables: [], totalLabel: 'TOTAL', showLineItemPrices: false },
    },
    {
      type: 'signature',
      accent: 'magenta',
      content: {
        agencySignerName: 'Lauren',
        agencySignerTitle: 'Founder & Creative Director',
        clientSignerLabel: 'Client Approval',
      },
    },
  ];

  return raw.map((block, position) =>
    parseBlock({ id: randomUUID(), position, visible: true, ...block }),
  );
}
