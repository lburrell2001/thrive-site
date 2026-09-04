// Turning a proposal into a reusable template.
//
// A template is just an ordered array of blocks stored as JSONB. Everything
// that makes a proposal a proposal — slug, token, client, status, history —
// is left behind.

import type { ProposalBlock } from '@/types/proposal';

/**
 * Strip the details that belong to one client, keeping the structure and the
 * boilerplate that is genuinely reusable.
 *
 * The scrub is deliberately narrow. Scope, phases, action items and pricing
 * copy are the same across engagements and are exactly what a template is
 * for, so they are left alone; only the fields that name a specific client
 * or date are cleared.
 */
export function scrubClientDetails(blocks: ProposalBlock[]): ProposalBlock[] {
  return blocks.map((block) => {
    if (block.type === 'cover') {
      return {
        ...block,
        content: {
          ...block.content,
          subtitle: '',
          tagline: undefined,
          dateLabel: '',
          preparedFor: '',
          // The hero image, overlay, eyebrow, title lines and "prepared by"
          // are house style, not client detail.
          stats: undefined,
        },
      };
    }

    if (block.type === 'signature') {
      return {
        ...block,
        content: { ...block.content, clientSignerLabel: 'Client approval' },
      };
    }

    return block;
  });
}

/**
 * Blocks as a template stores them: positions normalised, ids dropped.
 *
 * Ids are dropped on purpose — a template is a shape, not a set of rows.
 * Every proposal made from it gets fresh block ids, so saving one proposal
 * can never move another's content.
 */
export function toTemplateBlocks(blocks: ProposalBlock[]): Omit<ProposalBlock, 'id'>[] {
  return [...blocks]
    .sort((a, b) => a.position - b.position)
    .map(({ id: _id, ...block }, index) => {
      void _id;
      return { ...block, position: index };
    });
}
