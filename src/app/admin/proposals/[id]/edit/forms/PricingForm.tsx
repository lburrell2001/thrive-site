'use client';

import { useEffect, useState } from 'react';
import s from '../../../proposals.module.css';
import pf from './pricing.module.css';
import { Checkbox, Repeater, TextArea, TextInput } from '../fields';
import { apiGet, formatMoneyCents } from '../../../adminApi';
import { PriceListDrawer, type Pick } from '../../../../invoices/PriceListDrawer';
import {
  itemForLine, missingRequired, priceLabel, suggestionsFor, unitCents,
  type Catalog, type PriceItem,
} from '@/lib/priceCatalog';
import type { PricingBlock } from '@/types/proposal';
import type { FormProps } from './types';

export interface BuilderLineItem {
  id?: string;
  label: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  position: number;
}

const isMonthly = (d: string | null) => /\/\s*mo(nth)?\.?\s*$/i.test((d ?? '').trim());
const stripMo = (d: string | null) => (d ?? '').replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');
const lineCents = (item: BuilderLineItem) => Math.round(item.quantity * item.unit_price_cents);

/** A price list item as a proposal line: hourly items carry hours × rate. */
function lineFor(item: PriceItem, qty: number): Omit<BuilderLineItem, 'position'> {
  const monthly = item.price_type === 'monthly';
  const description = [item.description.trim(), monthly ? '/mo' : ''].filter(Boolean).join(' ') || null;
  const label = item.is_optional ? `${item.name} (Optional)` : item.name;
  if (item.price_type === 'hourly') {
    return { label, description, quantity: (item.hours ?? 1) * qty, unit_price_cents: Math.round((item.price ?? 0) * 100) };
  }
  return { label, description, quantity: qty, unit_price_cents: unitCents(item) };
}

/**
 * Pricing: built from the price list first. Each line is a row with a
 * quantity and a price; typing a line by hand is "+ Custom line". What the
 * client sees is chosen below: one total with the deliverables list (the
 * default — per-item amounts are never rendered), or every line's price.
 * Monthly lines (description ending "/mo") show as "+ $100/mo" next to the
 * one-time total.
 */
export function PricingForm({
  block,
  onContentChange,
  lineItems,
  onLineItemsChange,
  currency,
}: FormProps<PricingBlock> & {
  lineItems: BuilderLineItem[];
  onLineItemsChange: (items: BuilderLineItem[]) => void;
  currency: string;
}) {
  const c = block.content;
  const set = (patch: Partial<PricingBlock['content']>) => onContentChange({ ...c, ...patch });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    apiGet<Catalog & { ready: boolean }>('/api/price-list')
      .then((cat) => { if (cat.ready) setCatalog(cat); })
      .catch(() => { /* custom lines still work */ });
  }, []);

  const monthly = lineItems.filter((i) => isMonthly(i.description)).reduce((n, i) => n + lineCents(i), 0);
  const total = lineItems.reduce((n, i) => n + lineCents(i), 0);
  const oneTime = total - monthly;

  const names = lineItems.map((i) => i.label);
  const missing = catalog ? missingRequired(catalog, names) : [];
  const suggestions = catalog ? suggestionsFor(catalog, names) : [];

  const setItems = (items: BuilderLineItem[]) => onLineItemsChange(items.map((item, index) => ({ ...item, position: index })));
  const update = (index: number, patch: Partial<BuilderLineItem>) =>
    setItems(lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  /** Adds price list items (and what they require), plus a matching deliverable each. */
  function insert(picks: Pick[]) {
    if (!catalog) return;
    const items = [...lineItems];
    const deliverables = [...c.deliverables];
    const add = (item: PriceItem, qty: number) => {
      items.push({ ...lineFor(item, qty), position: items.length });
      if (!deliverables.some((d) => d.title.trim().toLowerCase() === item.name.toLowerCase())) {
        deliverables.push({ title: item.name, description: item.description });
      }
    };
    for (const { item, qty } of picks) add(item, qty);
    const added: string[] = [];
    for (const { item, required } of missingRequired(catalog, items.map((i) => i.label))) {
      add(required, 1);
      added.push(`${required.name} added: required with ${item.name}`);
    }
    setItems(items);
    set({ deliverables });
    setDrawer(false);
    setNote(added.join('. '));
  }

  function remove(index: number) {
    const item = lineItems[index];
    const cat = catalog ? itemForLine(catalog.items, item.label) : undefined;
    setItems(lineItems.filter((_, i) => i !== index));
    // Its deliverable goes too, when it came from the price list unchanged.
    if (cat) set({ deliverables: c.deliverables.filter((d) => d.title.trim().toLowerCase() !== cat.name.toLowerCase()) });
    setEditing(null);
  }

  function addCustom() {
    setItems([...lineItems, { label: '', description: null, quantity: 1, unit_price_cents: 0, position: lineItems.length }]);
    setEditing(lineItems.length);
  }

  /** Which item requires this one, if any: it can't be removed while that's on. */
  const lockedBy = (label: string) => {
    if (!catalog) return '';
    const me = itemForLine(catalog.items, label);
    if (!me) return '';
    const present = names.map((n) => itemForLine(catalog.items, n)?.id).filter(Boolean);
    const rule = catalog.rules.find((r) => r.rule_type === 'requires' && r.related_item_id === me.id && present.includes(r.item_id));
    return rule ? catalog.items.find((i) => i.id === rule.item_id)?.name ?? '' : '';
  };

  return (
    <>
      <div className={pf.section}>
        <div className={pf.sectionHead}>
          <strong>Prices</strong>
          <span className={pf.total}>
            {monthly && !oneTime ? `${formatMoneyCents(monthly, currency)}/mo` : formatMoneyCents(oneTime, currency)}
            {monthly > 0 && oneTime > 0 && <small> + {formatMoneyCents(monthly, currency)}/mo</small>}
          </span>
        </div>

        {lineItems.length === 0 ? (
          <div className={pf.empty}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={!catalog} onClick={() => setDrawer(true)}
              title={catalog ? undefined : 'Run migration 047 to use the price list'}>
              Choose from price list
            </button>
            <button type="button" className={pf.link} onClick={addCustom}>or add a custom line</button>
          </div>
        ) : (
          <ul className={pf.rows}>
            {lineItems.map((item, index) => {
              const cat = catalog ? itemForLine(catalog.items, item.label) : undefined;
              const locked = lockedBy(item.label);
              const open = editing === index;
              const perUnit = cat?.unit && cat.price_type !== 'hourly';
              return (
                <li key={item.id ?? `new-${index}`} className={`${pf.row} ${open ? pf.rowOpen : ''}`}>
                  <div className={pf.rowTop}>
                    <button type="button" className={pf.rowMain} onClick={() => setEditing(open ? null : index)} aria-expanded={open}>
                      <span className={pf.rowName}>
                        {item.label || <em>New line</em>}
                        {!cat && item.label && <span className={pf.badgeCustom}>Custom</span>}
                      </span>
                      {stripMo(item.description) && <span className={pf.rowDesc}>{stripMo(item.description)}</span>}
                      {locked && <span className={pf.lock}>Required with {locked}</span>}
                    </button>
                    {perUnit ? (
                      <span className={pf.stepper} role="group" aria-label={`How many ${cat!.unit}s`}>
                        <button type="button" aria-label="One fewer" disabled={item.quantity <= 1} onClick={() => update(index, { quantity: item.quantity - 1 })}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" aria-label="One more" onClick={() => update(index, { quantity: item.quantity + 1 })}>+</button>
                      </span>
                    ) : <span />}
                    <span className={pf.amount}>{formatMoneyCents(lineCents(item), currency)}{isMonthly(item.description) ? '/mo' : ''}</span>
                    <button type="button" className={pf.remove} aria-label={`Remove ${item.label || 'line'}`} disabled={!!locked}
                      title={locked ? `Required with ${locked}` : 'Remove'} onClick={() => remove(index)}>×</button>
                  </div>
                  {open && (
                    <div className={pf.edit}>
                      <TextInput label="Name" value={item.label} onChange={(v) => update(index, { label: v })} />
                      <TextInput label="Description" value={stripMo(item.description)}
                        onChange={(v) => update(index, { description: [v, isMonthly(item.description) ? '/mo' : ''].filter(Boolean).join(' ') || null })} />
                      <div className={s.inlineRow}>
                        <MoneyInput label="Unit price" cents={item.unit_price_cents} currency={currency} onChange={(cents) => update(index, { unit_price_cents: cents })} />
                        <QuantityInput value={item.quantity} onChange={(quantity) => update(index, { quantity })} />
                      </div>
                      <label className={pf.check}>
                        <input type="checkbox" checked={isMonthly(item.description)}
                          onChange={(e) => update(index, { description: [stripMo(item.description), e.target.checked ? '/mo' : ''].filter(Boolean).join(' ') || null })} />
                        Monthly
                      </label>
                      {cat && <p className={s.hint}>Price list: {priceLabel(cat)}. Changing it here only changes this proposal.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {lineItems.length > 0 && (
          <div className={pf.tools}>
            <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`} disabled={!catalog} onClick={() => setDrawer(true)}>+ Add from price list</button>
            <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={addCustom}>+ Custom line</button>
          </div>
        )}

        {note && <p className={pf.note}>{note}</p>}
        {missing.length > 0 && (
          <div className={pf.required} role="alert">
            {missing.map(({ item, required }) => (
              <p key={required.id}>
                {required.name} is required with {item.name}.
                <button type="button" onClick={() => insert([{ item: required, qty: 1 }])}>Add it back</button>
              </p>
            ))}
          </div>
        )}
        {suggestions.length > 0 && (
          <div className={pf.suggested}>
            <span>Suggested add-ons</span>
            <div>
              {suggestions.map((sg) => (
                <button key={sg.id} type="button" onClick={() => insert([{ item: sg, qty: 1 }])}>+ {sg.name} · {priceLabel(sg)}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={pf.section}>
        <div className={pf.sectionHead}><strong>What the client sees</strong></div>
        <Checkbox
          label="Show each line’s price"
          hint="Off: the client sees the deliverables below and the total — line prices are never shown. On: every line with its price."
          checked={c.showLineItemPrices}
          onChange={(v) => set({ showLineItemPrices: v })}
        />
        {!c.showLineItemPrices && (
          <Repeater
            label="Deliverables"
            items={c.deliverables}
            addLabel="Add a deliverable"
            blank={() => ({ title: '', description: '' })}
            onChange={(deliverables) => set({ deliverables })}
            render={(item, upd) => (
              <>
                <TextInput label="Title" value={item.title} onChange={(v) => upd({ title: v })} />
                <TextArea label="Description" value={item.description} rows={2} onChange={(v) => upd({ description: v })} />
              </>
            )}
          />
        )}
      </div>

      <div className={pf.section}>
        <div className={pf.sectionHead}><strong>Wording</strong></div>
        <TextInput label="Kicker" value={c.kicker ?? ''} onChange={(v) => set({ kicker: v || undefined })} />
        <TextArea label="Intro" value={c.intro} rows={3} onChange={(v) => set({ intro: v })} />
        <TextInput label="Total label" value={c.totalLabel} onChange={(v) => set({ totalLabel: v })} />
        <TextArea label="Fine print under the total" value={c.footnote ?? ''} rows={2} onChange={(v) => set({ footnote: v || undefined })} />
      </div>

      {drawer && catalog && <PriceListDrawer catalog={catalog} onInsert={insert} onClose={() => setDrawer(false)} />}
    </>
  );
}

function MoneyInput({ label, cents, currency, onChange }: { label: string; cents: number; currency: string; onChange: (cents: number) => void }) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label} ({currency})</label>
      <input className={s.input} type="number" min={0} step="0.01" inputMode="decimal"
        value={cents === 0 ? '' : (cents / 100).toString()} placeholder="0.00"
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
        }} />
    </div>
  );
}

function QuantityInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className={s.field}>
      <label className={s.label}>Quantity</label>
      <input className={s.input} type="number" min={0} step="0.25" inputMode="decimal" value={value}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
        }} />
    </div>
  );
}
