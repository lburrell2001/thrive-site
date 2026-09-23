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
