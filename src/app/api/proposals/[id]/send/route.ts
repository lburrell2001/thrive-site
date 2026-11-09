export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { publishProposal } from '@/lib/proposalPublish';

type Ctx = { params: Promise<{ id: string }> };

/** Publish and hand back the client link to copy ("Copy client link"). Emailing it is /email. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await publishProposal(auth.db, id);
  if (!result.ok) return badRequest(result.error, result.status);
  return NextResponse.json({ ok: true, data: { url: result.url, path: result.path } });
}
