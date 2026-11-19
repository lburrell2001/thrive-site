export const runtime = 'nodejs';

// Amend a sent proposal (migration 068): GET its revision and earlier
// versions; POST keeps the version the client has and opens the next one.

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { amendProposal, amendState } from '@/lib/proposalAmend';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const state = await amendState(auth.db, id);
  if ('error' in state) return badRequest(state.error);
  return NextResponse.json({ ok: true, data: state });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const done = await amendProposal(auth.db, id);
  if (!done.ok) return badRequest(done.error, done.status);
  const state = await amendState(auth.db, id);
  return NextResponse.json({ ok: true, data: 'error' in state ? null : state });
}
