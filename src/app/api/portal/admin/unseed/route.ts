import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_EMAIL = 'lauren@thrivecreativestudios.org';

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  // Hard guard — only the demo account can use this
  if (user.email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Not available for this account.' }, { status: 403 });
  }

  const clientId = user.id;

  await Promise.all([
    admin.from('portal_projects').delete().eq('client_id', clientId),
    admin.from('portal_invoices').delete().eq('client_id', clientId),
    admin.from('portal_requests').delete().eq('client_id', clientId),
    admin.from('portal_files').delete().eq('client_id', clientId),
    admin.from('portal_milestones').delete().eq('client_id', clientId),
    admin.from('portal_onboarding_steps').delete().eq('client_id', clientId),
    admin.from('portal_activity').delete().eq('client_id', clientId),
  ]);

  return NextResponse.json({ ok: true });
}
