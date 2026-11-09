export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { estimateRow, estimateSchema, missingEstimatesTable, missingTotalsOnly, nextEstimateNumber, withoutTotalsOnly } from '@/lib/estimates';

const INVOICE_COLUMNS = 'id, client_id, invoice_number, project_name, amount_cents, invoice_date, due_date, status';

/** Everything the builder needs: estimates, recent invoices, and who to bill. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const [estimates, clients, contacts] = await Promise.all([
    db.from('estimates').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('portal_clients').select('id, full_name, company_name').eq('role', 'client').order('company_name'),
    db.from('crm_contacts').select('id, name, company, email, portal_client_id').order('name').limit(2000),
  ]);

  // Lines and notes only exist once 039 is in.
  const recent = (columns: string) => db.from('portal_invoices').select(columns).order('created_at', { ascending: false }).limit(30);
  let invoices = await recent(`${INVOICE_COLUMNS}, line_items, notes, totals_only`);
  if (invoices.error) invoices = await recent(`${INVOICE_COLUMNS}, line_items, notes`);
  if (invoices.error) invoices = await recent(INVOICE_COLUMNS);

  return NextResponse.json({
    ok: true,
    data: {
      ready: !estimates.error,
      estimates: estimates.data ?? [],
      invoices: invoices.data ?? [],
      clients: clients.data ?? [],
      contacts: contacts.data ?? [],
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const parsed = estimateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid estimate');

  // The unique number is the guard if two saves race; try once more.
  let row = estimateRow(parsed.data);
  for (let attempt = 0; attempt < 3; attempt++) {
    const estimate_number = await nextEstimateNumber(auth.db);
    const { data, error } = await auth.db
      .from('estimates')
      .insert({ ...row, estimate_number })
      .select('*')
      .single();
    if (!error) return NextResponse.json({ ok: true, data });
    if (missingTotalsOnly(error.message) && 'totals_only' in row) { row = withoutTotalsOnly(row); continue; }
    if (missingEstimatesTable(error.message)) return badRequest('Run migration 039 in Supabase to save estimates.', 503);
    if (error.code !== '23505') return badRequest(error.message);
  }
  return badRequest('Could not number the estimate. Try again.');
}
