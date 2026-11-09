export const runtime = 'nodejs';

// The service price catalog (migration 047). Admin only: GET reads it all for
// the Price List page and the builder's drawer; POST takes one action at a time.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, requireAdmin } from '@/lib/adminAuth';
import { baseName, categoryInput, itemInput, sameName } from '@/lib/priceCatalog';

const missing = (message: string) => /price_(categories|items|item_rules)/.test(message) && /does not exist|schema cache|Could not find/i.test(message);
const NOT_READY = 'Run migration 047 in Supabase to use the price list.';

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const [categories, items, rules] = await Promise.all([
    db.from('price_categories').select('id, name, description, sort_order').order('sort_order'),
    db.from('price_items').select('id, category_id, name, description, price, price_type, hours, is_optional, is_active, sort_order, unit, notes').order('sort_order'),
    db.from('price_item_rules').select('id, item_id, rule_type, related_item_id'),
  ]);
  const error = categories.error ?? items.error ?? rules.error;
  if (error) {
    if (missing(error.message)) return NextResponse.json({ ok: true, data: { ready: false, categories: [], items: [], rules: [] } });
    return badRequest(error.message);
  }
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return NextResponse.json({
    ok: true,
    data: {
      ready: true,
      categories: categories.data,
      items: (items.data ?? []).map((i) => ({ ...i, price: num(i.price), hours: num(i.hours) })),
      rules: rules.data,
    },
  });
}

const uuid = z.string().uuid();
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_category'), category: categoryInput }),
  z.object({ action: z.literal('update_category'), id: uuid, category: categoryInput }),
  z.object({ action: z.literal('delete_category'), id: uuid }),
  z.object({ action: z.literal('create_item'), item: itemInput }),
  z.object({ action: z.literal('update_item'), id: uuid, item: itemInput }),
  z.object({ action: z.literal('delete_item'), id: uuid }),
  z.object({ action: z.literal('set_active'), id: uuid, is_active: z.boolean() }),
  // The full new order of one list (categories, or the items of one category).
  z.object({ action: z.literal('reorder_categories'), ids: z.array(uuid).max(500) }),
  z.object({ action: z.literal('reorder_items'), ids: z.array(uuid).max(1000) }),
  z.object({ action: z.literal('add_rule'), item_id: uuid, rule_type: z.enum(['requires', 'suggests']), related_item_id: uuid }),
  z.object({ action: z.literal('delete_rule'), id: uuid }),
]);

/** Has this item's name been on a saved estimate or invoice? Then it's kept, just inactive. */
async function usedOnPaper(db: import('@supabase/supabase-js').SupabaseClient, name: string): Promise<boolean> {
  const [est, inv] = await Promise.all([
    db.from('estimates').select('line_items'),
    db.from('portal_invoices').select('line_items').not('line_items', 'is', null),
  ]);
  const rows = [...(est.data ?? []), ...(inv.data ?? [])] as { line_items: { name?: string }[] | null }[];
  return rows.some((r) => (r.line_items ?? []).some((l) => typeof l.name === 'string' && sameName(baseName(l.name), name)));
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  const body = parsed.data;
  const fail = (message: string) => badRequest(missing(message) ? NOT_READY : /duplicate key.*price_categories_name/.test(message) ? 'There is already a category with that name' : message);

  switch (body.action) {
    case 'create_category': {
      const { data: last } = await db.from('price_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await db.from('price_categories')
        .insert({ ...body.category, sort_order: (last?.sort_order ?? 0) + 10 }).select('id').single();
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data });
    }
    case 'update_category': {
      const { error } = await db.from('price_categories').update(body.category).eq('id', body.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: null });
    }
    case 'delete_category': {
      const { count } = await db.from('price_items').select('id', { count: 'exact', head: true }).eq('category_id', body.id);
      if (count) return badRequest('Move or delete the items in this category first.');
      const { error } = await db.from('price_categories').delete().eq('id', body.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: null });
    }
    case 'create_item': {
      const { data: last } = await db.from('price_items').select('sort_order').eq('category_id', body.item.category_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await db.from('price_items')
        .insert({ ...normalize(body.item), sort_order: (last?.sort_order ?? 0) + 10 }).select('id').single();
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data });
    }
    case 'update_item': {
      const { data: before } = await db.from('price_items').select('category_id').eq('id', body.id).maybeSingle();
      const row: Record<string, unknown> = { ...normalize(body.item), updated_at: new Date().toISOString() };
      // Moved to another category: to the end of it.
      if (before && before.category_id !== body.item.category_id) {
        const { data: last } = await db.from('price_items').select('sort_order').eq('category_id', body.item.category_id)
          .order('sort_order', { ascending: false }).limit(1).maybeSingle();
        row.sort_order = (last?.sort_order ?? 0) + 10;
      }
      const { error } = await db.from('price_items').update(row).eq('id', body.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: null });
    }
    case 'delete_item': {
      const { data: item } = await db.from('price_items').select('name').eq('id', body.id).maybeSingle();
      if (!item) return badRequest('Item not found', 404);
      if (await usedOnPaper(db, item.name)) {
        const { error } = await db.from('price_items').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', body.id);
        if (error) return fail(error.message);
        return NextResponse.json({ ok: true, data: { result: 'deactivated' } });
      }
      const { error } = await db.from('price_items').delete().eq('id', body.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: { result: 'deleted' } });
    }
    case 'set_active': {
      const { error } = await db.from('price_items').update({ is_active: body.is_active, updated_at: new Date().toISOString() }).eq('id', body.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: null });
    }
    case 'reorder_categories':
    case 'reorder_items': {
      const table = body.action === 'reorder_categories' ? 'price_categories' : 'price_items';
      const results = await Promise.all(body.ids.map((id, i) => db.from(table).update({ sort_order: (i + 1) * 10 }).eq('id', id)));
      const error = results.find((r) => r.error)?.error;
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: null });
    }
    case 'add_rule': {
      if (body.item_id === body.related_item_id) return badRequest('An item can’t require or suggest itself');
      const { data, error } = await db.from('price_item_rules')
        .upsert({ item_id: body.item_id, rule_type: body.rule_type, related_item_id: body.related_item_id }, { onConflict: 'item_id,rule_type,related_item_id' })
        .select('id').single();
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data });
    }
    case 'delete_rule': {
      const { error } = await db.from('price_item_rules').delete().eq('id', body.id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true, data: null });
    }
  }
}

/** Included items cost nothing; only hourly items carry hours. */
function normalize(item: z.infer<typeof itemInput>) {
  return {
    ...item,
    price: item.price_type === 'included' ? 0 : item.price,
    hours: item.price_type === 'hourly' ? (item.hours ?? 1) : null,
  };
}
