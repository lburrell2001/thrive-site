'use client';

import s from '../../../proposals.module.css';
import { Checkbox, Repeater, TextArea, TextInput } from '../fields';
import { formatMoneyCents } from '../../../adminApi';
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

/**
 * The one place line-item prices are visible and editable.
 *
 * "Show individual prices to client" is off by default and stays off unless
 * it is deliberately turned on — with it off, the client view renders the
 * deliverable list below and a single total, and never touches these
 * amounts. The running total here comes from the same numbers the database
 * trigger uses, so what Lauren sees and what the client sees cannot drift.
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

  const total = lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unit_price_cents),
    0,
  );

  return (
    <>
      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
      />
      <TextArea label="Intro" value={c.intro} rows={4} onChange={(v) => set({ intro: v })} />

      <Checkbox
        label="Show individual prices to client"
        hint="Off by default. With this off the client sees the deliverables below and one total — the per-item amounts are never sent to the browser."
        checked={c.showLineItemPrices}
        onChange={(v) => set({ showLineItemPrices: v })}
      />

      <Repeater
        label="Deliverables shown to the client"
        items={c.deliverables}
        addLabel="Add a deliverable"
        blank={() => ({ title: '', description: '' })}
        onChange={(deliverables) => set({ deliverables })}
        render={(item, update) => (
          <>
            <TextInput label="Title" value={item.title} onChange={(v) => update({ title: v })} />
            <TextArea
              label="Description"
              value={item.description}
              rows={3}
              onChange={(v) => update({ description: v })}
            />
          </>
        )}
      />

      <hr style={{ border: 'none', borderTop: '1px solid #e4e1de', margin: '20px 0 16px' }} />

      <Repeater
        label="Line items — the money"
        items={lineItems}
        addLabel="Add a line item"
        blank={() => ({
          label: '',
          description: null,
          quantity: 1,
          unit_price_cents: 0,
          position: lineItems.length,
        })}
        onChange={(items) =>
          onLineItemsChange(items.map((item, index) => ({ ...item, position: index })))
        }
        render={(item, update) => (
          <>
            <TextInput label="Label" value={item.label} onChange={(v) => update({ label: v })} />
            <TextInput
              label="Description"
              value={item.description ?? ''}
              onChange={(v) => update({ description: v || null })}
            />
            <div className={s.inlineRow}>
              <MoneyInput
                label="Unit price"
                cents={item.unit_price_cents}
                currency={currency}
                onChange={(cents) => update({ unit_price_cents: cents })}
              />
              <QuantityInput
                value={item.quantity}
                onChange={(quantity) => update({ quantity })}
              />
            </div>
            <p className={s.hint}>
              Line total {formatMoneyCents(Math.round(item.quantity * item.unit_price_cents), currency)}
            </p>
          </>
        )}
      />

      <div className={s.totalRow}>
        <span>Total</span>
        <span>{formatMoneyCents(total, currency)}</span>
      </div>
      <p className={s.hint}>
        The database recalculates this on save; the client always sees the saved figure.
      </p>
    </>
  );
}

function MoneyInput({
  label,
  cents,
  currency,
  onChange,
}: {
  label: string;
  cents: number;
  currency: string;
  onChange: (cents: number) => void;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>
        {label} ({currency})
      </label>
      <input
        className={s.input}
        type="number"
        min={0}
        step="0.01"
        value={cents === 0 ? '' : (cents / 100).toString()}
        placeholder="0.00"
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
        }}
      />
    </div>
  );
}

function QuantityInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>Quantity</label>
      <input
        className={s.input}
        type="number"
        min={0}
        step="0.25"
        value={value}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
        }}
      />
    </div>
  );
}
