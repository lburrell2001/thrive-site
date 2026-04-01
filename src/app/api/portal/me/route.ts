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

  let { data: profile } = await admin
    .from('portal_clients')
    .select('full_name, initials, role, company_name')
    .eq('id', user.id)
    .single();

  // Auto-create profile if missing
  if (!profile) {
    const emailName = user.email?.split('@')[0] ?? 'client';
    await admin.from('portal_clients').insert({
      id: user.id,
      full_name: emailName,
      initials: emailName.slice(0, 2).toUpperCase(),
      role: 'client',
    });
    const { data: fresh } = await admin
      .from('portal_clients')
      .select('full_name, initials, role, company_name')
      .eq('id', user.id)
      .single();
    profile = fresh;
  }

  return NextResponse.json({ ok: true, profile });
}
