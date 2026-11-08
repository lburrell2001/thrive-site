// Browser side: call a portal API route as the signed-in client (the route
// checks the Supabase token and reads with the service role).

import { supabasePortal } from '@/lib/supabasePortal';

export class PortalApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown>) { super(message); }
}

export async function portalApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabasePortal.auth.getSession();
  if (!session) throw new PortalApiError('Please sign in again.', 401, {});
  const res = await fetch(path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${session.access_token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new PortalApiError(typeof json.error === 'string' ? json.error : 'Something went wrong. Try again.', res.status, json);
  return json as T;
}
