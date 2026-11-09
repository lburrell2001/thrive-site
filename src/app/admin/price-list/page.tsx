'use client';

// Sales → Price list: every service, add-on and fee (migration 047), grouped by
// category. Add, edit, reorder, switch off; rules (requires / suggests) per
// item. The estimate and invoice builder's "Add from price list" reads it.
// Deleting an item that's been on an estimate or invoice switches it off instead.

import { useEffect, useMemo, useState } from 'react';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import {
  exportCatalog, priceLabel, PRICE_TYPE_LABEL, PRICE_TYPES,
  type Catalog, type PriceCategory, type PriceItem, type PriceType, type RuleType,
} from '@/lib/priceCatalog';
import pl from './priceList.module.css';

type Data = Catalog & { ready: boolean };

type ItemForm = {
  category_id: string; name: string; description: string; price: string; price_type: PriceType;
  hours: string; is_optional: boolean; is_active: boolean; unit: string; notes: string;
};

const formFor = (item: PriceItem): ItemForm => ({
  category_id: item.category_id, name: item.name, description: item.description,
  price: item.price === null ? '' : String(item.price), price_type: item.price_type,
  hours: item.hours === null ? '' : String(item.hours), is_optional: item.is_optional,
  is_active: item.is_active, unit: item.unit ?? '', notes: item.notes,
});

const blankForm = (category_id: string): ItemForm => ({
  category_id, name: '', description: '', price: '', price_type: 'flat', hours: '',
  is_optional: false, is_active: true, unit: '', notes: '',
});

function itemBody(f: ItemForm) {
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[$,]/g, '')));
  return {
    category_id: f.category_id,
    name: f.name.trim(),
    description: f.description.trim(),
    price: f.price_type === 'included' ? 0 : num(f.price),
    price_type: f.price_type,
    hours: f.price_type === 'hourly' ? (num(f.hours) ?? 1) : null,
    is_optional: f.is_optional,
    is_active: f.is_active,
    unit: f.unit.trim() || null,
    notes: f.notes,
  };
}

export default function PriceListPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  // "new:<category id>", an item id, or null.
  const [editing, setEditing] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = () => apiGet<Data>('/api/price-list')
    .then(setData)
    .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => [...(data?.categories ?? [])].sort((a, b) => a.sort_order - b.sort_order), [data]);
  const q = query.trim().toLowerCase();

  async function run(body: Record<string, unknown>, done?: string): Promise<unknown> {
    setBusy(true);
    try {
      const res = await apiSend<unknown>('/api/price-list', 'POST', body);
      if (done) show(done);
      await load();
      return res;
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  function itemsOf(categoryId: string) {
    return (data?.items ?? []).filter((i) => i.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);
  }

  async function move(kind: 'category' | 'item', list: { id: string }[], index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= list.length) return;
    const ids = list.map((x) => x.id);
    [ids[index], ids[to]] = [ids[to], ids[index]];
    // Show it moved straight away.
    setData((d) => {
      if (!d) return d;
      const order = new Map(ids.map((id, i) => [id, (i + 1) * 10]));
      return kind === 'category'
        ? { ...d, categories: d.categories.map((c) => (order.has(c.id) ? { ...c, sort_order: order.get(c.id)! } : c)) }
        : { ...d, items: d.items.map((i) => (order.has(i.id) ? { ...i, sort_order: order.get(i.id)! } : i)) };
    });
    await run({ action: kind === 'category' ? 'reorder_categories' : 'reorder_items', ids });
  }

  async function removeItem(item: PriceItem) {
    if (!window.confirm(`Delete “${item.name}”? If it’s been on an estimate or invoice, it’s switched off instead.`)) return;
    const res = await run({ action: 'delete_item', id: item.id }) as { result?: string } | undefined;
    if (res?.result === 'deactivated') show(`“${item.name}” is on past estimates or invoices, so it was switched off instead.`);
    else if (res) show(`Deleted “${item.name}”.`);
    setEditing(null);
  }

  async function removeCategory(c: PriceCategory) {
    if (!window.confirm(`Delete the category “${c.name}”?`)) return;
    await run({ action: 'delete_category', id: c.id }, `Deleted “${c.name}”.`);
  }

  async function newCategory() {
    const name = window.prompt('Name the new category');
    if (!name?.trim()) return;
    await run({ action: 'create_category', category: { name: name.trim(), description: '' } }, `Added “${name.trim()}”.`);
  }

  function download() {
    if (!data) return;
    const blob = new Blob([exportCatalog(data)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thrive-price-list.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeCount = data?.items.filter((i) => i.is_active).length ?? 0;

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Price list</h1>
          <p className={w.sub}>
            Every service, add-on and fee. “Add from price list” in Estimates &amp; invoices inserts them; changing a price here never changes a saved estimate or invoice.
          </p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={p.btn} onClick={download} disabled={!data?.items.length}>Export</button>
          <button type="button" className={p.btn} onClick={newCategory} disabled={!data?.ready || busy}>New category</button>
        </div>
      </div>

      {error && <p className={pl.error}>{error}</p>}
      {!data && !error && <p className={w.muted}>Loading…</p>}
      {data && !data.ready && (
        <div className={w.empty}>Run <code>supabase/migrations/047_price_catalog.sql</code> in Supabase to set up the price list.</div>
      )}

      {data?.ready && (
        <>
          <div className={pl.toolbar}>
            <input type="search" className={`${p.input} ${pl.search}`} placeholder="Search the price list" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Search the price list" />
            <span className={w.muted}>{activeCount} active item{activeCount === 1 ? '' : 's'} in {categories.length} categories</span>
          </div>

          {categories.map((c, ci) => {
            const all = itemsOf(c.id);
            const items = q ? all.filter((i) => `${i.name} ${i.description} ${i.notes}`.toLowerCase().includes(q)) : all;
            if (q && !items.length) return null;
            return (
              <section key={c.id} className={`${w.card} ${pl.category}`}>
                {editingCat === c.id ? (
                  <CategoryForm category={c} busy={busy} onCancel={() => setEditingCat(null)}
                    onSave={async (name, description) => {
                      const ok = await run({ action: 'update_category', id: c.id, category: { name, description } }, 'Category saved.');
                      if (ok !== undefined) setEditingCat(null);
                    }} />
                ) : (
                  <div className={pl.catHead}>
                    <div>
                      <h2 className={pl.catTitle}>{c.name}</h2>
                      {c.description && <p className={pl.catNote}>{c.description}</p>}
                    </div>
                    <div className={pl.actions}>
                      {!q && <>
                        <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-label={`Move ${c.name} up`} disabled={ci === 0 || busy} onClick={() => move('category', categories, ci, -1)}>↑</button>
                        <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-label={`Move ${c.name} down`} disabled={ci === categories.length - 1 || busy} onClick={() => move('category', categories, ci, 1)}>↓</button>
                      </>}
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setEditingCat(c.id)}>Edit</button>
                      {all.length === 0 && <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => removeCategory(c)}>Delete</button>}
                    </div>
                  </div>
                )}

                <ul className={pl.items}>
                  {items.map((item, ii) => (
                    <li key={item.id} className={`${pl.item} ${item.is_active ? '' : pl.inactive}`}>
                      <div className={pl.itemRow}>
                        <div className={pl.itemMain}>
                          <strong>{item.name}</strong>
                          {item.is_optional && <span className={pl.badge}>Optional</span>}
                          {!item.is_active && <span className={`${pl.badge} ${pl.badgeOff}`}>Off</span>}
                          {item.description && <span className={pl.itemDesc}>{item.description}</span>}
                          {item.notes && <span className={pl.itemNotes}>Note: {item.notes}</span>}
                        </div>
                        <span className={pl.price}>
                          {priceLabel(item)}{item.unit && <span className={w.muted}> / {item.unit}</span>}
                        </span>
                        <div className={pl.actions}>
                          {!q && <>
                            <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-label={`Move ${item.name} up`} disabled={ii === 0 || busy} onClick={() => move('item', items, ii, -1)}>↑</button>
                            <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-label={`Move ${item.name} down`} disabled={ii === items.length - 1 || busy} onClick={() => move('item', items, ii, 1)}>↓</button>
                          </>}
                          <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setEditing(editing === item.id ? null : item.id)}>
                            {editing === item.id ? 'Close' : 'Edit'}
                          </button>
                        </div>
                      </div>
                      {editing === item.id && (
                        <ItemEditor key={item.id} item={item} catalog={data} categories={categories} busy={busy}
                          onCancel={() => setEditing(null)}
                          onSave={async (f) => {
                            const ok = await run({ action: 'update_item', id: item.id, item: itemBody(f) }, `Saved “${f.name.trim()}”.`);
                            if (ok !== undefined) setEditing(null);
                          }}
                          onDelete={() => removeItem(item)}
                          onRule={(body) => run(body)} />
                      )}
                    </li>
                  ))}
                </ul>

                {editing === `new:${c.id}` ? (
                  <ItemEditor catalog={data} categories={categories} busy={busy} categoryId={c.id}
                    onCancel={() => setEditing(null)}
                    onSave={async (f) => {
                      const ok = await run({ action: 'create_item', item: itemBody(f) }, `Added “${f.name.trim()}”.`);
                      if (ok !== undefined) setEditing(null);
                    }} />
                ) : (
                  !q && <button type="button" className={`${p.btn} ${p.btnSmall} ${pl.addItem}`} onClick={() => setEditing(`new:${c.id}`)}>+ Add item</button>
                )}
              </section>
            );
          })}
          {q && !categories.some((c) => itemsOf(c.id).some((i) => `${i.name} ${i.description} ${i.notes}`.toLowerCase().includes(q))) && (
            <div className={w.empty}>Nothing matches “{query.trim()}”.</div>
          )}
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}

function CategoryForm({ category, busy, onSave, onCancel }: {
  category: PriceCategory; busy: boolean; onSave: (name: string, description: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description);
  return (
    <div className={pl.form}>
      <label><span className={p.label}>Category</span><input className={p.input} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className={pl.full}>
        <span className={p.label}>Note (for you; shows in the price list drawer)</span>
        <textarea className={p.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className={pl.formActions}>
        <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!name.trim() || busy} onClick={() => onSave(name.trim(), description.trim())}>Save</button>
        <button type="button" className={p.btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ItemEditor({ item, categoryId, catalog, categories, busy, onSave, onCancel, onDelete, onRule }: {
  item?: PriceItem; categoryId?: string; catalog: Catalog; categories: PriceCategory[]; busy: boolean;
  onSave: (f: ItemForm) => void; onCancel: () => void; onDelete?: () => void;
  onRule?: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [f, setF] = useState<ItemForm>(() => (item ? formFor(item) : blankForm(categoryId!)));
  const [ruleType, setRuleType] = useState<RuleType>('suggests');
  const [ruleItem, setRuleItem] = useState('');
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const needsPrice = f.price_type !== 'included';
  const priceOk = !needsPrice || (f.price.trim() !== '' && !Number.isNaN(Number(f.price.replace(/[$,]/g, ''))));
  const valid = f.name.trim() && !/[|]/.test(f.name + f.description) && priceOk;

  const rules = item ? catalog.rules.filter((r) => r.item_id === item.id) : [];
  const nameOf = (id: string) => catalog.items.find((i) => i.id === id)?.name ?? '—';
  const byCategory = categories.map((c) => ({ c, items: catalog.items.filter((i) => i.category_id === c.id && i.id !== item?.id).sort((a, b) => a.sort_order - b.sort_order) }));

  return (
    <div className={pl.form}>
      <label className={pl.full}><span className={p.label}>Name</span><input className={p.input} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!item} /></label>
      <label className={pl.full}><span className={p.label}>Description</span><input className={p.input} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <label>
        <span className={p.label}>Category</span>
        <select className={p.select} value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        <span className={p.label}>Price type</span>
        <select className={p.select} value={f.price_type} onChange={(e) => set('price_type', e.target.value as PriceType)}>
          {PRICE_TYPES.map((t) => <option key={t} value={t}>{PRICE_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      {needsPrice && (
        <label>
          <span className={p.label}>{f.price_type === 'hourly' ? 'Rate per hour ($)' : f.price_type === 'monthly' ? 'Price per month ($)' : 'Price ($)'}</span>
          <input className={p.input} inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} />
        </label>
      )}
      {f.price_type === 'hourly' && (
        <label><span className={p.label}>Hours</span><input className={p.input} inputMode="decimal" value={f.hours} placeholder="1" onChange={(e) => set('hours', e.target.value)} /></label>
      )}
      <label>
        <span className={p.label}>Per unit (gets a quantity box)</span>
        <input className={p.input} value={f.unit} placeholder="e.g. page, slide" onChange={(e) => set('unit', e.target.value)} />
      </label>
      <div className={pl.checks}>
        <label><input type="checkbox" checked={f.is_optional} onChange={(e) => set('is_optional', e.target.checked)} /> Optional add-on</label>
        <label><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active (shows in the builder)</label>
      </div>
      <label className={pl.full}>
        <span className={p.label}>Internal notes (only you see these)</span>
        <textarea className={p.textarea} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {item && onRule && (
        <div className={pl.full}>
          <span className={p.label}>Rules</span>
          {rules.length === 0 && <p className={pl.hint}>None. “Requires” adds the other item automatically; “Suggests” offers it as a one-click add-on.</p>}
          <ul className={pl.rules}>
            {[...rules].sort((a, b) => a.rule_type.localeCompare(b.rule_type)).map((r) => (
              <li key={r.id}>
                <span className={`${pl.badge} ${r.rule_type === 'requires' ? pl.badgeRequires : ''}`}>{r.rule_type === 'requires' ? 'Requires' : 'Suggests'}</span>
                {nameOf(r.related_item_id)}
                <button type="button" className={pl.ruleRemove} aria-label={`Remove rule: ${r.rule_type} ${nameOf(r.related_item_id)}`} disabled={busy}
                  onClick={() => onRule({ action: 'delete_rule', id: r.id })}>×</button>
              </li>
            ))}
          </ul>
          <div className={pl.ruleAdd}>
            <select className={p.select} value={ruleType} onChange={(e) => setRuleType(e.target.value as RuleType)} aria-label="Rule type">
              <option value="suggests">Suggests</option>
              <option value="requires">Requires</option>
            </select>
            <select className={p.select} value={ruleItem} onChange={(e) => setRuleItem(e.target.value)} aria-label="Other item">
              <option value="">Pick an item…</option>
              {byCategory.map(({ c, items }) => items.length > 0 && (
                <optgroup key={c.id} label={c.name}>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={!ruleItem || busy}
              onClick={async () => { await onRule({ action: 'add_rule', item_id: item.id, rule_type: ruleType, related_item_id: ruleItem }); setRuleItem(''); }}>
              Add rule
            </button>
          </div>
        </div>
      )}

      <div className={pl.formActions}>
        <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!valid || busy} onClick={() => onSave(f)}>{item ? 'Save' : 'Add item'}</button>
        <button type="button" className={p.btn} onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className={`${p.btn} ${p.btnDanger} ${pl.push}`} disabled={busy} onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}
