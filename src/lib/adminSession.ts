'use client';

// Admin sign-in in the browser. Admin accounts are Supabase users with the
// admin role who sign in with a password and an authenticator-app code; the
// session lives under its own storage key so it never mixes with a client's
// portal session. Every admin request gets its credentials from adminHeaders():
// the account session, or the old passcode until it is turned off.

import { createClient } from '@supabase/supabase-js';

export const adminAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storageKey: 'thrive-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
);

const PASSCODE_KEY = 'admin_passcode';

export function storedPasscode(): string {
  return typeof window !== 'undefined' ? sessionStorage.getItem(PASSCODE_KEY) ?? '' : '';
}

export function rememberPasscode(passcode: string) {
  sessionStorage.setItem(PASSCODE_KEY, passcode);
}

export async function adminHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await adminAuth.auth.getSession();
  if (session) return { Authorization: `Bearer ${session.access_token}` };
  const passcode = storedPasscode();
  return passcode ? { 'X-Admin-Passcode': passcode } : {};
}

/** Signed in with password and authenticator code. */
export async function hasFullSession(): Promise<boolean> {
  const { data } = await adminAuth.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}

export async function adminSignOut() {
  sessionStorage.removeItem(PASSCODE_KEY);
  await adminAuth.auth.signOut().catch(() => undefined);
}
