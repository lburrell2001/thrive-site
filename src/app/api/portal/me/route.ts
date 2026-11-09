import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { data: profile } = await admin
    .from('portal_clients')
    .select('full_name, initials, role, company_name')
    .eq('id', user.id)
    .maybeSingle();

  // Only people Lauren set up as clients (admin → Clients → New client) have a
  // portal. An account made any other way — e.g. straight against Supabase's
  // sign-up — gets no profile and no portal (it used to be created here).
  if (!profile) return NextResponse.json({ error: 'no_portal' }, { status: 403 });

  return NextResponse.json({ ok: true, profile });
}
