import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDueInvoices } from '@/lib/invoiceHelpers';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service env vars');
  return createClient(url, key, { auth: { persistSession: false } });
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function isPortalAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;
  const admin = getAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return false;
  const { data } = await admin.from('portal_clients').select('role').eq('id', user.id).single();
  return data?.role === 'admin';
}

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('Authorization') ?? '';
  return header === `Bearer ${secret}`;
}

// GET — used by Vercel Cron (sends Authorization: Bearer ${CRON_SECRET}).
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorized();
  const result = await generateDueInvoices(getAdminClient());
  return NextResponse.json(result);
}

// POST — portal admin session OR cron secret.
export async function POST(req: NextRequest) {
  const ok = (await isPortalAdmin(req)) || cronAuthorized(req);
  if (!ok) return unauthorized();
  const result = await generateDueInvoices(getAdminClient());
  return NextResponse.json(result);
}
