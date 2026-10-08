// Logged calls: reading their details back out of crm_activities.metadata
// and saying them in one line. Pure — used by the server and the browser.

import {
  CALL_DIRECTIONS,
  CALL_DIRECTION_LABEL,
  CALL_OUTCOMES,
  CALL_OUTCOME_LABEL,
  type CallDetails,
} from '@/types/crm';

/** A call's details, or null for calls logged before they had any. */
export function readCall(metadata: unknown): CallDetails | null {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const direction = CALL_DIRECTIONS.find((d) => d === m.direction);
  const outcome = CALL_OUTCOMES.find((o) => o === m.outcome);
  if (!direction || !outcome) return null;
  const minutes = typeof m.minutes === 'number' && m.minutes >= 0 ? m.minutes : null;
  return { direction, outcome, minutes };
}

/** "I called · Talked · 15 min" */
export function callSummary(call: CallDetails | null): string {
  if (!call) return 'Call';
  return [
    CALL_DIRECTION_LABEL[call.direction],
    CALL_OUTCOME_LABEL[call.outcome],
    call.outcome === 'connected' && call.minutes ? `${call.minutes} min` : null,
  ].filter(Boolean).join(' · ');
}
