// The signed-in portal client behind a request (Authorization: Bearer <Supabase
// access token>), for routes that read tables the browser can't (RLS with no
// policies). Returns the service-role client too.

import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { bearerToken, serviceClient } from './adminAuth';

export type PortalResult = { ok: true; db: SupabaseClient; user: User } | { ok: false; response: NextResponse };

export async function requirePortalClient(req: Request): Promise<PortalResult> {
  const token = bearerToken(req);
  if (!token) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  let db: SupabaseClient;
  try { db = serviceClient(); } catch {
    return { ok: false, response: NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 }) };
  }
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { ok: true, db, user };
}
