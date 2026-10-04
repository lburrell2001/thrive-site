import type { CrmStage } from '@/types/crm';

export const STAGE_COLOR: Record<CrmStage, string> = {
  lead: '#e40586',
  contacted: '#fd6100',
  proposal: '#5b2d8e',
  won: '#1a8a4a',
  lost: '#9a9a9a',
};

/** Local calendar date, YYYY-MM-DD — what task due dates are compared to. */
export function todayIso() {
  return new Date().toLocaleDateString('en-CA');
}

/** "$1,250" or "1250" typed by hand, to cents. Empty is null. */
export function parseDollars(input: string): number | null | undefined {
  const clean = input.replace(/[$,\s]/g, '');
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

/** Where someone is with Thrive, from the most committed down. */
export type Lifecycle = 'client' | 'lead' | 'prospect' | 'contact';

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  client: 'Client',
  lead: 'Lead',
  prospect: 'Prospect',
  contact: 'Contact',
};

export function lifecycleOf(c: { portal_client_id: string | null; won_deals?: number; open_deals?: number; prospect_status?: string | null }): Lifecycle {
  if (c.portal_client_id || (c.won_deals ?? 0) > 0) return 'client';
  if ((c.open_deals ?? 0) > 0) return 'lead';
  if (c.prospect_status === 'prospect') return 'prospect';
  return 'contact';
}

const AVATAR = ['#e50586', '#fd6100', '#3943b7', '#9409ce', '#0a8f4f', '#0a0a0a'];

/** A steady colour per person, so they're recognisable at a glance. */
export function avatarColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

export function initials(name: string | null | undefined, email?: string | null) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length) return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

/** "today", "yesterday", "5d ago", or a date. */
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
    return hours <= 0 ? 'just now' : `${hours}h ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined });
}
