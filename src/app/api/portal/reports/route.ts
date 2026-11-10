export const runtime = 'nodejs';

// The signed-in client's completion reports (migration 052), so they can
// download them again from My Projects.

import { NextResponse } from 'next/server';
import { requirePortalClient } from '@/lib/portalAuth';

export async function GET(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.db.from('project_reports').select('id, project_id, sent_at, data')
    .eq('client_id', auth.user.id).order('sent_at', { ascending: false });
  if (error) return NextResponse.json({ reports: [] });
  return NextResponse.json({ reports: data ?? [] });
}
