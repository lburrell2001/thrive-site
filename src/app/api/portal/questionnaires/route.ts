export const runtime = 'nodejs';

// The signed-in client's questionnaires, with progress.

import { NextResponse } from 'next/server';
import { requirePortalClient } from '@/lib/portalAuth';
import { clientAssignments } from '@/lib/questionnaireRepo';

export async function GET(req: Request) {
  const auth = await requirePortalClient(req);
  if (!auth.ok) return auth.response;
  try {
    const assignments = await clientAssignments(auth.db, auth.user.id);
    return NextResponse.json({ assignments });
  } catch {
    return NextResponse.json({ error: 'Could not load your questionnaires' }, { status: 500 });
  }
}
