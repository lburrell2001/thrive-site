// The portal's first-sign-in welcome (/portal/welcome): who still needs it.
// Stored on the client's own auth user_metadata, so there's no table to
// migrate: `portal_welcome_done` (ISO time) once they finish or skip it, and
// `portal_welcome: 'pending'` when Lauren turns it on for them, or `'off'` when
// she turns it off (admin, Client tab → "Onboarding walkthrough" switch).
// Accounts made before the welcome existed don't get it unless she asks.

import type { User } from '@supabase/supabase-js';

/** Accounts created from this moment on see the welcome on first sign-in. */
export const WELCOME_SINCE = '2026-11-08T00:00:00Z';

export function needsWelcome(user: Pick<User, 'created_at' | 'user_metadata'> | null | undefined): boolean {
  if (!user) return false;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta.portal_welcome === 'off') return false;
  if (meta.portal_welcome === 'pending') return true;
  if (meta.portal_welcome_done) return false;
  return new Date(user.created_at).getTime() >= new Date(WELCOME_SINCE).getTime();
}

/** When they finished (or skipped) the welcome, if they have. */
export function welcomeDoneAt(user: Pick<User, 'user_metadata'> | null | undefined): string | null {
  const done = (user?.user_metadata as Record<string, unknown> | undefined)?.portal_welcome_done;
  return typeof done === 'string' ? done : null;
}
