export const runtime = 'nodejs';

// Subcontract jobs (076): every job with its protocol progress, and marking a
// deal as subcontract work.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { SubcontractError, listJobs, markSubcontract } from '@/lib/subcontractRepo';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const jobs = await listJobs(auth.db);
    const { data: deals } = await auth.db.from('crm_deals').select('id, title, stage, contact_id, closed_at, crm_contacts(name, company)')
      .is('closed_at', null).neq('stage', 'lost').order('updated_at', { ascending: false }).limit(200);
    const taken = new Set(jobs.map((j) => j.deal_id));
    const open = (deals ?? []).filter((d) => !taken.has(d.id)).map((d) => {
      const c = (Array.isArray(d.crm_contacts) ? d.crm_contacts[0] : d.crm_contacts) as { name?: string; company?: string | null } | null;
      return { id: d.id, title: d.title, stage: d.stage, contact: c?.company || c?.name || '' };
    });
    return NextResponse.json({ ok: true, data: { jobs, deals: open } });
  } catch (e) {
    return fail(e);
  }
}

const schema = z.object({ deal_id: z.string().uuid(), end_client: z.string().trim().max(160).nullable().default(null) });

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Pick a deal');
  try {
    return NextResponse.json({ ok: true, data: { job: await markSubcontract(auth.db, parsed.data.deal_id, parsed.data.end_client) } });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof SubcontractError) return badRequest(e.message, e.status);
  return badRequest(e instanceof Error ? e.message : 'Something went wrong', 500);
}
