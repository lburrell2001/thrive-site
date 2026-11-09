export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { addDealProject } from '@/lib/portalClient';

type Ctx = { params: Promise<{ id: string }> };

/** The deal's contact in Clients (a portal login, made if needed) with a project named after the deal. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await addDealProject(auth.db, id);
  if (!result.ok) return badRequest(result.error);
  return NextResponse.json({ ok: true, data: { portal_client_id: result.portalId, project_id: result.projectId, created_client: result.createdClient } });
}
