export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { buildReport } from '@/lib/analyticsReport';
import sitemap from '@/app/sitemap';

const RANGES = new Set([7, 30, 90, 365]);

/** The analytics report for the last ?days= days (7, 30, 90 or 365). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const days = Number(new URL(req.url).searchParams.get('days') ?? 30);
  if (!RANGES.has(days)) return badRequest('days must be 7, 30, 90 or 365');

  // The sitemap is the list of pages that should be getting visits.
  let paths: string[] = [];
  try {
    paths = (await sitemap())
      .map((entry) => new URL(entry.url).pathname)
      // Legal pages are there to exist, not to be visited.
      .filter((path) => !/^\/(privacy|sms)$/.test(path));
  } catch {
    paths = [];
  }

  try {
    return NextResponse.json({ ok: true, data: await buildReport(auth.db, days, paths) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not build report', 500);
  }
}
