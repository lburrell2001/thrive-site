export const runtime = 'nodejs';

// The total for a choice of tier and extras on an estimate (migration 061),
// worked out here so the page never needs the lines a totals-only estimate
// hides. Same token as the page; changes nothing.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadClientEstimate } from '@/lib/estimateAccess';
import { choiceTotal } from '@/lib/estimateChoice';
import { lineSelectionSchema } from '@/lib/lineItems';

const schema = z.object({ token: z.string().min(10).max(128), selection: lineSelectionSchema });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const est = await loadClientEstimate(id, parsed.data.token);
  if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(choiceTotal(est.line_items, parsed.data.selection));
}
