// What gets frozen when a client signs.
//
// A signature is only defensible if you can say exactly what was on the
// screen when it was given. So the signature row stores a full copy of the
// visible blocks plus a hash of them — editing the proposal afterwards
// changes the live document and leaves the signed record untouched.

import 'server-only';
import { createHash } from 'node:crypto';
import type { ProposalBlock } from '@/types/proposal';

/**
 * JSON with every object key sorted, at every depth.
 *
 * Without this the hash would depend on key insertion order, so the same
 * content could hash two different ways and the record would prove nothing.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export interface SignatureSnapshot {
  blocks: ProposalBlock[];
  contentHash: string;
}

/**
 * Freeze what the client actually saw: the visible blocks, in display order,
 * with the money they agreed to folded into the hash.
 *
 * Hidden blocks are excluded on purpose — they were not part of the offer.
 */
export function buildSignatureSnapshot(
  blocks: ProposalBlock[],
  totalCents: number,
  currency: string,
): SignatureSnapshot {
  const visible = blocks
    .filter((block) => block.visible)
    .sort((a, b) => a.position - b.position);

  const payload = canonicalJson({ blocks: visible, totalCents, currency });

  return {
    blocks: visible,
    contentHash: `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex')}`,
  };
}

/**
 * Postgres `inet` rejects anything that is not an address, so an unparseable
 * forwarded-for header has to become null rather than fail the whole signing.
 */
export function parseIpAddress(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim() ?? '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(first)) {
    return first.split('.').every((part) => Number(part) <= 255) ? first : null;
  }
  // Loose IPv6 check — enough to keep junk out of an inet column.
  if (/^[0-9a-f:]+$/i.test(first) && first.includes(':')) return first;
  return null;
}

export function depositCentsFor(totalCents: number, depositPercent: number): number {
  return Math.round((totalCents * depositPercent) / 100);
}
