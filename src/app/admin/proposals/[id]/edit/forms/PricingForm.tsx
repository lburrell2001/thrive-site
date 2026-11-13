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
  /** Tiers and optional extras (migration 061). */
  tier?: string | null;
  is_optional?: boolean;
  /** Phases (migration 062). */
  phase?: string | null;
  phase_terms?: string | null;
}

/** One-tap payment terms for a phase. */
const PHASE_TERMS = ['Due upfront', '50% to start · 50% on delivery', 'Due on completion', 'Monthly'];

type Mode = 'list' | 'tiers' | 'phases';
/** A card of lines: the whole list, what every option includes, one tier, or one phase. */
type Group = { kind: 'list' | 'shared' | 'tier' | 'phase' | 'loose'; name: string };

/** A tier's or phase's name, saved when you leave the box (so typing doesn't reshuffle the cards). */
function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input className={pf.groupNameInput} value={v} aria-label="Name" onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v.trim() && v !== value) onCommit(v); else setV(value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
  );
}

const isMonthly = (d: string | null) => /\/\s*mo(nth)?\.?\s*$/i.test((d ?? '').trim());
const stripMo = (d: string | null) => (d ?? '').replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '');
const lineCents = (item: BuilderLineItem) => Math.round(item.quantity * item.unit_price_cents);

/** A price list item as a proposal line: hourly items carry hours × rate. */
function lineFor(item: PriceItem, qty: number): Omit<BuilderLineItem, 'position'> {
  const monthly = item.price_type === 'monthly';
  const description = [item.description.trim(), monthly ? '/mo' : ''].filter(Boolean).join(' ') || null;
  // An optional price list item is an extra the client can tick (migration 061).
  const label = item.name;
  const optional = item.is_optional ? { is_optional: true } : {};
  if (item.price_type === 'hourly') {
    return { label, description, quantity: (item.hours ?? 1) * qty, unit_price_cents: Math.round((item.price ?? 0) * 100), ...optional };
  }
  return { label, description, quantity: qty, unit_price_cents: unitCents(item), ...optional };
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
  /** The drawer is open, adding to this group. */
  const [drawerFor, setDrawerFor] = useState<Group | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState('');
  // Tiers and phases named but not given any lines yet.
  const [newTiers, setNewTiers] = useState<string[]>([]);
  const [newPhases, setNewPhases] = useState<{ name: string; terms: string }[]>([]);
  const [groupDraft, setGroupDraft] = useState({ name: '', terms: '' });
  // List · Tiers · Phases: how the prices are laid out (from the lines when it opens).
  const [mode, setMode] = useState<Mode>(() =>
    lineItems.some((i) => i.phase?.trim()) ? 'phases' : lineItems.some((i) => i.tier?.trim()) ? 'tiers' : 'list');

  useEffect(() => {
    apiGet<Catalog & { ready: boolean }>('/api/price-list')
      .then((cat) => { if (cat.ready) setCatalog(cat); })
      .catch(() => { /* custom lines still work */ });
  }, []);

  const tierOf = (i: BuilderLineItem) => i.tier?.trim() || '';
  const phaseOf = (i: BuilderLineItem) => i.phase?.trim() || '';
  const tiers = [...new Set([...lineItems.map(tierOf).filter(Boolean), ...newTiers])];
  const phases: { name: string; terms: string }[] = [];
  for (const i of lineItems) {
    const name = phaseOf(i);
    if (!name) continue;
    const found = phases.find((p) => p.name === name);
    if (!found) phases.push({ name, terms: i.phase_terms?.trim() ?? '' });
    else if (!found.terms && i.phase_terms?.trim()) found.terms = i.phase_terms.trim();
  }
  for (const p of newPhases) if (!phases.some((x) => x.name === p.name)) phases.push(p);

  // Tiers and extras (migration 061): the total is the first option with no extras, as the client first sees it.
  const firstTier = lineItems.find((i) => tierOf(i))?.tier?.trim() ?? null;
  const counted = lineItems.filter((i) => !i.is_optional && (!tierOf(i) || tierOf(i) === firstTier));
  const monthly = counted.filter((i) => isMonthly(i.description)).reduce((n, i) => n + lineCents(i), 0);
  const total = counted.reduce((n, i) => n + lineCents(i), 0);
  const oneTime = total - monthly;
  const sumOf = (items: BuilderLineItem[]) => {
    const all = items.reduce((n, i) => n + lineCents(i), 0);
    const mo = items.filter((i) => isMonthly(i.description)).reduce((n, i) => n + lineCents(i), 0);
    return mo && all === mo ? `${formatMoneyCents(mo, currency)}/mo`
      : mo ? `${formatMoneyCents(all - mo, currency)} + ${formatMoneyCents(mo, currency)}/mo` : formatMoneyCents(all, currency);
  };

  const names = lineItems.map((i) => i.label);
  const missing = catalog ? missingRequired(catalog, names) : [];
  const suggestions = catalog ? suggestionsFor(catalog, names) : [];

  /** The groups shown as cards: the whole list, or what every option has + each tier, or each phase. */
  const groups: Group[] = mode === 'list' ? [{ kind: 'list', name: '' }]
    : mode === 'tiers' ? [{ kind: 'shared', name: '' }, ...tiers.map((name) => ({ kind: 'tier' as const, name }))]
    : [
      ...phases.map((p) => ({ kind: 'phase' as const, name: p.name })),
      // Lines that somehow have no phase stay visible, to be moved into one.
      ...(lineItems.some((i) => !phaseOf(i)) ? [{ kind: 'loose' as const, name: '' }] : []),
    ];
  const inGroup = (g: Group, i: BuilderLineItem) =>
    g.kind === 'list' ? true : g.kind === 'shared' ? !tierOf(i) : g.kind === 'tier' ? tierOf(i) === g.name
      : g.kind === 'loose' ? !phaseOf(i) : phaseOf(i) === g.name;
  /** What a new line in this group carries. */
  const tagFor = (g: Group): Partial<BuilderLineItem> =>
    g.kind === 'tier' ? { tier: g.name } : g.kind === 'phase' ? { phase: g.name, phase_terms: phases.find((p) => p.name === g.name)?.terms || null } : {};

  /** Keeps each group's lines together, in the order the groups are shown. */
  const setItems = (items: BuilderLineItem[]) => {
    const order = (i: BuilderLineItem) => {
      if (mode === 'tiers') return tierOf(i) ? 1 + Math.max(0, tiers.indexOf(tierOf(i))) : 0;
      if (mode === 'phases') return Math.max(0, phases.findIndex((p) => p.name === phaseOf(i)));
      return 0;
    };
    const sorted = items.map((item, n) => ({ item, n })).sort((a, b) => order(a.item) - order(b.item) || a.n - b.n).map((x) => x.item);
    onLineItemsChange(sorted.map((item, index) => ({ ...item, position: index })));
    return sorted;
  };
  const update = (index: number, patch: Partial<BuilderLineItem>) =>
    onLineItemsChange(lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  /** Adds price list items (and what they require) to a group, plus a matching deliverable each. */
  function insert(picks: Pick[], into: Group | null = drawerFor) {
    if (!catalog) return;
    const tag = tagFor(into ?? groups[0] ?? { kind: 'list', name: '' });
    const items = [...lineItems];
    const deliverables = [...c.deliverables];
    const add = (item: PriceItem, qty: number) => {
      const line = { ...lineFor(item, qty), ...tag, position: items.length };
      // Phases don't have optional extras.
      if (tag.phase) delete line.is_optional;
      items.push(line);
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
    setDrawerFor(null);
    setNote(added.join('. '));
  }

  function remove(index: number) {
    const item = lineItems[index];
    const cat = catalog ? itemForLine(catalog.items, item.label) : undefined;
    onLineItemsChange(lineItems.filter((_, i) => i !== index).map((it, n) => ({ ...it, position: n })));
    // Its deliverable goes too, when it came from the price list unchanged.
    if (cat) set({ deliverables: c.deliverables.filter((d) => d.title.trim().toLowerCase() !== cat.name.toLowerCase()) });
    setEditing(null);
  }

  function addCustom(g: Group) {
    const line: BuilderLineItem = { label: '', description: null, quantity: 1, unit_price_cents: 0, position: lineItems.length, ...tagFor(g) };
    // Open it where it lands once each group's lines are kept together.
    setEditing(setItems([...lineItems, line]).indexOf(line));
  }

  /** List · Tiers · Phases. Tiers and phases swap one for one; the list takes every line out of its group. */
  function switchMode(next: Mode) {
    if (next === mode) return;
    const grouped = lineItems.some((i) => tierOf(i) || phaseOf(i));
    if (next === 'list') {
      if (grouped && !window.confirm(`Take every line out of its ${mode === 'tiers' ? 'tier' : 'phase'}? The lines stay, as one list.`)) return;
      onLineItemsChange(lineItems.map((i) => ({ ...i, tier: null, phase: null, phase_terms: null })));
    } else if (next === 'phases') {
      // Each tier becomes a phase; lines in every option (or the whole list) go in the first.
      const first = tiers[0] ?? 'Phase 1';
      onLineItemsChange(lineItems.map((i) => ({ ...i, tier: null, is_optional: undefined, phase: tierOf(i) || first, phase_terms: null })));
      setNewPhases([...new Set([first, ...tiers])].map((name) => ({ name, terms: '' })));
    } else {
      // Each phase becomes a tier.
      onLineItemsChange(lineItems.map((i) => ({ ...i, tier: phaseOf(i) || null, phase: null, phase_terms: null })));
      setNewTiers(phases.map((p) => p.name));
    }
    setEditing(null);
    setMode(next);
  }

  function addGroup() {
    const name = groupDraft.name.trim().replace(/\|/g, ' ').slice(0, 80);
    if (!name) return;
    if (mode === 'tiers' && !tiers.includes(name)) setNewTiers((cur) => [...cur, name]);
    if (mode === 'phases' && !phases.some((p) => p.name === name)) setNewPhases((cur) => [...cur, { name, terms: groupDraft.terms.trim().slice(0, 300) }]);
    setGroupDraft({ name: '', terms: '' });
  }

  function renameGroup(g: Group, to: string) {
    const name = to.trim().replace(/\|/g, ' ').slice(0, 80);
    if (!name || name === g.name || (g.kind === 'tier' ? tiers.includes(name) : phases.some((p) => p.name === name))) return;
    if (g.kind === 'tier') {
      setNewTiers((cur) => cur.map((t) => (t === g.name ? name : t)));
      onLineItemsChange(lineItems.map((i) => (tierOf(i) === g.name ? { ...i, tier: name } : i)));
    } else {
      setNewPhases((cur) => cur.map((p) => (p.name === g.name ? { ...p, name } : p)));
      onLineItemsChange(lineItems.map((i) => (phaseOf(i) === g.name ? { ...i, phase: name } : i)));
    }
  }

  function removeGroup(g: Group) {
    const count = lineItems.filter((i) => inGroup(g, i)).length;
    if (count && !window.confirm(`Remove ${g.name} and its ${count} line${count === 1 ? '' : 's'}?`)) return;
    if (g.kind === 'tier') setNewTiers((cur) => cur.filter((t) => t !== g.name));
    else setNewPhases((cur) => cur.filter((p) => p.name !== g.name));
    onLineItemsChange(lineItems.filter((i) => !inGroup(g, i)).map((it, n) => ({ ...it, position: n })));
    setEditing(null);
  }

  /** A phase's terms, on every line in it. */
  const setPhaseTerms = (name: string, terms: string) => {
    setNewPhases((cur) => (cur.some((p) => p.name === name) ? cur.map((p) => (p.name === name ? { ...p, terms } : p)) : [...cur, { name, terms }]));
    onLineItemsChange(lineItems.map((i) => (phaseOf(i) === name ? { ...i, phase_terms: terms || null } : i)));
  };

  /** Moves a line to another group. */
  function moveTo(index: number, g: Group) {
    const base = { ...lineItems[index], tier: null, phase: null, phase_terms: null };
    setItems(lineItems.map((item, i) => (i === index ? { ...base, ...tagFor(g) } : item)));
    setEditing(null);
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

  const groupTitle = (g: Group, n: number) =>
    g.kind === 'shared' ? 'In every option' : g.kind === 'tier' ? `Option ${n}` : g.kind === 'phase' ? `Phase ${n + 1}` : g.kind === 'loose' ? 'Not in a phase' : '';

  function row(item: BuilderLineItem, index: number) {
    const cat = catalog ? itemForLine(catalog.items, item.label) : undefined;
    const locked = lockedBy(item.label);
    const open = editing === index;
    const perUnit = cat?.unit && cat.price_type !== 'hourly';
    const here = groups.find((g) => inGroup(g, item));
    return (
      <li key={item.id ?? `new-${index}`} className={`${pf.row} ${open ? pf.rowOpen : ''}`}>
        <div className={pf.rowTop}>
          <button type="button" className={pf.rowMain} onClick={() => setEditing(open ? null : index)} aria-expanded={open}>
            <span className={pf.rowName}>
              {item.label || <em>New line</em>}
              {!cat && item.label && <span className={pf.badgeCustom}>Custom</span>}
              {item.is_optional && <span className={pf.badgeCustom}>Optional</span>}
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
            <div className={pf.rowChoices} style={{ padding: 0 }}>
              <label className={pf.check}>
                <input type="checkbox" checked={isMonthly(item.description)}
                  onChange={(e) => update(index, { description: [stripMo(item.description), e.target.checked ? '/mo' : ''].filter(Boolean).join(' ') || null })} />
                Monthly
              </label>
              {mode !== 'phases' && (
                <label className={pf.check}>
                  <input type="checkbox" checked={!!item.is_optional} onChange={(e) => update(index, { is_optional: e.target.checked || undefined })} />
                  Optional extra (the client can add it)
                </label>
              )}
              {groups.filter((g) => g.kind !== 'loose').length > 1 || here?.kind === 'loose' ? (
                <select className={pf.tierSelect} value={here ? `${here.kind}:${here.name}` : ''} aria-label={`Move ${item.label || 'this line'}`}
                  onChange={(e) => { const g = groups.find((x) => x.kind !== 'loose' && `${x.kind}:${x.name}` === e.target.value); if (g) moveTo(index, g); }}>
                  {here?.kind === 'loose' && <option value="loose:">Move to a phase…</option>}
                  {groups.map((g, n) => g.kind === 'loose' ? null : <option key={`${g.kind}:${g.name}`} value={`${g.kind}:${g.name}`}>
                    {here && here.kind === g.kind && here.name === g.name ? 'In' : 'Move to'}: {g.kind === 'shared' ? 'Every option' : `${groupTitle(g, n)} · ${g.name}`}
                  </option>)}
                </select>
              ) : null}
            </div>
            {cat && <p className={s.hint}>Price list: {priceLabel(cat)}. Changing it here only changes this proposal.</p>}
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      <div className={pf.section}>
        <div className={pf.sectionHead}>
          <strong>Prices</strong>
          <span className={pf.total}>
            {mode === 'phases' ? `${phases.length} phase${phases.length === 1 ? '' : 's'}` : monthly && !oneTime ? `${formatMoneyCents(monthly, currency)}/mo` : formatMoneyCents(oneTime, currency)}
            {mode !== 'phases' && monthly > 0 && oneTime > 0 && <small> + {formatMoneyCents(monthly, currency)}/mo</small>}
          </span>
        </div>

        <div className={pf.modes} role="tablist" aria-label="How the prices are laid out">
          {(['list', 'tiers', 'phases'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={`${pf.mode} ${mode === m ? pf.modeOn : ''}`} onClick={() => switchMode(m)}>
              {m === 'list' ? 'List' : m === 'tiers' ? 'Tiers' : 'Phases'}
            </button>
          ))}
        </div>
        <p className={s.hint} style={{ margin: '0 0 12px' }}>
          {mode === 'list' ? 'One price for everything. Tick “Optional extra” on a line for add-ons the client can choose.'
            : mode === 'tiers' ? 'The client picks one option when they approve. Lines in “In every option” are part of all of them.'
            : 'Each phase has its own items, subtotal and payment terms — no grand total. The client approves phases, and you get a text to make the estimate for them.'}
        </p>

        {groups.map((g, n) => {
          const items = lineItems.map((item, index) => ({ item, index })).filter(({ item }) => inGroup(g, item));
          const terms = g.kind === 'phase' ? phases.find((p) => p.name === g.name)?.terms ?? '' : '';
          const shared = lineItems.filter((i) => !tierOf(i) && !i.is_optional);
          return (
            <div key={`${g.kind}:${g.name}`} className={g.kind === 'list' ? undefined : pf.group}>
              {g.kind !== 'list' && (
                <div className={pf.groupHead}>
                  <span className={pf.groupKicker}>{groupTitle(g, n)}</span>
                  {g.kind === 'shared' ? <strong className={pf.groupName}>Included in every option</strong>
                    : g.kind === 'loose' ? <strong className={pf.groupName}>Move these into a phase</strong>
                    : <NameField value={g.name} onCommit={(v) => renameGroup(g, v)} />}
                  <strong className={pf.groupTotal}>
                    {g.kind === 'tier' ? sumOf([...shared, ...items.map((x) => x.item).filter((i) => !i.is_optional)]) : items.length ? sumOf(items.map((x) => x.item).filter((i) => !i.is_optional)) : '—'}
                  </strong>
                  {g.kind !== 'shared' && g.kind !== 'loose' && (
                    <button type="button" className={pf.remove} aria-label={`Remove ${g.name}`} title="Remove" onClick={() => removeGroup(g)}>×</button>
                  )}
                </div>
              )}
              {g.kind === 'phase' && (
                <div className={pf.groupTerms}>
                  <input className={s.input} value={terms} placeholder="Payment terms, e.g. 50% to start · 50% on delivery"
                    aria-label={`Payment terms for ${g.name}`} onChange={(e) => setPhaseTerms(g.name, e.target.value)} />
                  <div className={pf.chips}>
                    {PHASE_TERMS.map((t) => (
                      <button key={t} type="button" className={`${pf.chip} ${terms === t ? pf.chipOn : ''}`} onClick={() => setPhaseTerms(g.name, t)}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              {items.length > 0 ? (
                <ul className={pf.rows}>{items.map(({ item, index }) => row(item, index))}</ul>
              ) : g.kind === 'list' ? (
                <div className={pf.empty}>
                  <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={!catalog} onClick={() => setDrawerFor(g)}
                    title={catalog ? undefined : 'Run migration 047 to use the price list'}>Choose from price list</button>
                  <button type="button" className={pf.link} onClick={() => addCustom(g)}>or add a custom line</button>
                </div>
              ) : <p className={pf.groupEmpty}>{g.kind === 'shared' ? 'Nothing yet — add what every option includes, or leave it empty.' : 'No items yet.'}</p>}
              {(items.length > 0 || g.kind !== 'list') && g.kind !== 'loose' && (
                <div className={pf.tools}>
                  <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnSmall}`} disabled={!catalog} onClick={() => setDrawerFor(g)}
                    title={catalog ? undefined : 'Run migration 047 to use the price list'}>+ From price list</button>
                  <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => addCustom(g)}>+ Custom line</button>
                </div>
              )}
            </div>
          );
        })}

        {mode !== 'list' && (
          <div className={pf.groupAdd}>
            <input className={s.input} value={groupDraft.name} placeholder={mode === 'tiers' ? 'New tier, e.g. Custom store' : 'New phase, e.g. Discovery'}
              onChange={(e) => setGroupDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
            {mode === 'phases' && (
              <input className={s.input} value={groupDraft.terms} placeholder="Payment terms (optional)"
                onChange={(e) => setGroupDraft((d) => ({ ...d, terms: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
            )}
            <button type="button" className={`${s.btn} ${s.btnSmall}`} disabled={!groupDraft.name.trim()} onClick={addGroup}>
              {mode === 'tiers' ? 'Add tier' : 'Add phase'}
            </button>
          </div>
        )}

        {note && <p className={pf.note}>{note}</p>}
        {missing.length > 0 && (
          <div className={pf.required} role="alert">
            {missing.map(({ item, required }) => (
              <p key={required.id}>
                {required.name} is required with {item.name}.
                <button type="button" onClick={() => {
                  // Back into the same tier or phase as the item that needs it.
                  const owner = lineItems.find((i) => i.label.trim().toLowerCase() === item.name.toLowerCase());
                  insert([{ item: required, qty: 1 }], (owner && groups.find((g) => inGroup(g, owner))) ?? null);
                }}>Add it back</button>
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
        <div style={{ margin: '4px 0 14px' }}>
          <Checkbox
            label="Write my own payment terms"
            hint="Off: the line under the total follows the deposit (e.g. “Half due at signing · half due at completion”). On: type your own — or leave it empty for no line."
            checked={c.paymentTerms !== undefined}
            onChange={(v) => set({ paymentTerms: v ? '' : undefined })}
          />
          {c.paymentTerms !== undefined && (
            <TextInput label="Payment terms under the total" value={c.paymentTerms} placeholder="25% to start · 25% at final approval · 50% at launch"
              onChange={(v) => set({ paymentTerms: v })} />
          )}
        </div>
        <TextArea label="Fine print under the total" value={c.footnote ?? ''} rows={2} onChange={(v) => set({ footnote: v || undefined })} />
      </div>

      {/* Percentage discounts go on the estimate or invoice; proposal lines can't be negative. */}
      {drawerFor && catalog && <PriceListDrawer catalog={{ ...catalog, items: catalog.items.filter((i) => i.price_type !== 'percent') }} onInsert={(picks) => insert(picks)} onClose={() => setDrawerFor(null)} />}
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
