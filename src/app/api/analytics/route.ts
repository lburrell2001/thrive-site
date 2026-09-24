export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { buildReport } from '@/lib/analyticsReport';
import { sitemapPaths } from '@/lib/sitemapPaths';
import { searchReport } from '@/lib/searchConsole';

const RANGES = new Set([7, 30, 90, 365]);

/** The analytics report for the last ?days= days (7, 30, 90 or 365). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const days = Number(new URL(req.url).searchParams.get('days') ?? 30);
  if (!RANGES.has(days)) return badRequest('days must be 7, 30, 90 or 365');

  // The sitemap is the list of pages that should be getting visits.
  const [paths, search] = await Promise.all([sitemapPaths(), searchReport(days)]);

  try {
    return NextResponse.json({ ok: true, data: await buildReport(auth.db, days, paths, search) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Could not build report', 500);
  }
}
