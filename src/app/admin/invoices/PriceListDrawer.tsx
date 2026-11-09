'use client';

// "Add from price list": a side drawer (a full-screen sheet on phones) over the
// estimate and invoice builder. Tick items, set a quantity on per-unit ones,
// Insert. The builder turns them into typed lines (src/lib/priceCatalog.ts).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import s from './billing.module.css';
import { priceLabel, unitCents, type Catalog, type PriceItem } from '@/lib/priceCatalog';
import { formatLineMoney } from '@/lib/lineItems';

export type Pick = { item: PriceItem; qty: number };

export function PriceListDrawer({ catalog, onInsert, onClose }: {
  catalog: Catalog;
  onInsert: (picks: Pick[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>('all');
  const [picked, setPicked] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const categories = useMemo(() => [...catalog.categories].sort((a, b) => a.sort_order - b.sort_order), [catalog]);
  const q = query.trim().toLowerCase();
  const groups = categories
    .filter((c) => q || tab === 'all' || tab === c.id)
    .map((c) => ({
      category: c,
      items: catalog.items
        .filter((i) => i.category_id === c.id && i.is_active)
        .filter((i) => !q || `${i.name} ${i.description} ${c.name}`.toLowerCase().includes(q))
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((g) => g.items.length);

  function toggle(item: PriceItem) {
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, 1);
      return next;
    });
  }

  function setQty(item: PriceItem, qty: number) {
    setPicked((cur) => new Map(cur).set(item.id, Math.max(1, Math.min(999, Math.floor(qty) || 1))));
  }

  const picks: Pick[] = [...picked].map(([id, qty]) => ({ item: catalog.items.find((i) => i.id === id)!, qty })).filter((x) => x.item);
  const pickedTotal = picks.reduce((sum, x) => sum + unitCents(x.item) * x.qty, 0);

  return (
    <div className={s.drawerBackdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label="Add from price list">
        <div className={s.drawerHead}>
          <h2 className={s.drawerTitle}>Add from price list</h2>
          <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={onClose}>Close</button>
        </div>
        <input className={p.input} type="search" placeholder="Search services, add-ons, fees…" value={query}
          onChange={(e) => setQuery(e.target.value)} autoFocus aria-label="Search the price list" />
        {!q && (
          <div className={s.drawerTabs} role="tablist" aria-label="Categories">
            <button type="button" role="tab" aria-selected={tab === 'all'} className={`${s.drawerTab} ${tab === 'all' ? s.drawerTabOn : ''}`} onClick={() => setTab('all')}>All</button>
            {categories.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={tab === c.id}
                className={`${s.drawerTab} ${tab === c.id ? s.drawerTabOn : ''}`} onClick={() => setTab(c.id)}>{c.name}</button>
            ))}
          </div>
        )}

        <div className={s.drawerBody}>
          {groups.length === 0 && (
            <p className={s.help}>
              {catalog.items.length ? 'Nothing matches.' : <>The price list is empty. <Link href="/admin/price-list">Add items</Link>.</>}
            </p>
          )}
          {groups.map(({ category, items }) => (
            <section key={category.id} className={s.drawerGroup}>
              <h3 className={s.drawerGroupTitle}>{category.name}</h3>
              {category.description && <p className={s.drawerNote}>{category.description}</p>}
              <ul className={s.drawerList}>
                {items.map((item) => {
                  const on = picked.has(item.id);
                  return (
                    <li key={item.id} className={`${s.drawerItem} ${on ? s.drawerItemOn : ''}`}>
                      <label className={s.drawerItemMain}>
                        <input type="checkbox" checked={on} onChange={() => toggle(item)} />
                        <span className={s.drawerItemText}>
                          <span className={s.drawerItemName}>
                            {item.name}
                            {item.is_optional && <span className={s.badgeOptional}>Optional</span>}
                          </span>
                          {item.description && <span className={s.drawerItemDesc}>{item.description}</span>}
                        </span>
                        <span className={s.drawerItemPrice}>{priceLabel(item)}{item.unit ? <span className={s.drawerUnit}> / {item.unit}</span> : null}</span>
                      </label>
                      {on && item.unit && (
                        <label className={s.qtyRow}>
                          <span>How many {item.unit}s?</span>
                          <input type="number" inputMode="numeric" min={1} max={999} className={`${p.input} ${s.qtyInput}`}
                            value={picked.get(item.id)} onChange={(e) => setQty(item, Number(e.target.value))} />
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className={s.drawerFoot}>
          <span className={s.help} style={{ margin: 0 }}>
            {picks.length ? `${picks.length} selected · ${formatLineMoney(pickedTotal)}` : 'Tick the items to add'}
          </span>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!picks.length} onClick={() => onInsert(picks)}>
            Insert{picks.length ? ` ${picks.length}` : ''}
          </button>
        </div>
      </aside>
    </div>
  );
}
