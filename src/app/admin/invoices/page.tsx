'use client';

// Invoices and estimates from a typed list: one item per line, parsed by
// src/lib/lineItems.ts. Estimates are saved here (migration 039); an invoice
// goes into the client's portal through the add_invoice action, so the portal,
// Stripe, reminders and the CRM deal all work as they do for any invoice.
// "Add from price list" inserts catalog items as typed lines (migration 047);
// "Totals only" makes the client's PDF show category subtotals.

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import s from './billing.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { amountText, categoryTotals, formatLineMoney, isMonthly, lineItemsToText, parseLineItems, splitTotals, totalCents, totalsLabel, type LineItem } from '@/lib/lineItems';
import type { Estimate, EstimateStatus } from '@/lib/estimates';
import { insertUnderHeading, itemLine, priceLabel, missingRequired, suggestionsFor, type Catalog, type PriceItem } from '@/lib/priceCatalog';
import { PriceListDrawer, type Pick } from './PriceListDrawer';

type Mode = 'estimate' | 'invoice';

interface PortalClient { id: string; full_name: string; company_name: string }
interface Contact { id: string; name: string; company: string | null; email: string | null; portal_client_id: string | null }
interface InvoiceRow {
  id: string; client_id: string; invoice_number: string; project_name: string; amount_cents: number;
  invoice_date: string; due_date: string; status: string; line_items?: LineItem[] | null; notes?: string | null;
  totals_only?: boolean | null;
}
interface BillingData { ready: boolean; estimates: Estimate[]; invoices: InvoiceRow[]; clients: PortalClient[]; contacts: Contact[] }

interface Draft {
  mode: Mode;
  /** "p:<portal client id>", "c:<crm contact id>" or "" for a typed name. */
  client: string;
  clientName: string;
  title: string;
  number: string;
  issueDate: string;
  dueDate: string;
  text: string;
  notes: string;
  /** The client's PDF shows category subtotals, not each line. */
  totalsOnly: boolean;
}

const DRAFT_KEY = 'thrive-billing-draft';

const EXAMPLE = `Homepage design | Custom layout for phone and desktop | $600
Inner pages | Services, About, Contact | 6h @ $100
Logo refresh - two concepts $350
  - Three rounds of revisions
Hosting setup | Included
Returning client discount | -$100`;

const STATUS_STYLE: Record<EstimateStatus, { bg: string; fg: string; label: string }> = {
  draft:    { bg: '#f5f5f5', fg: '#141414', label: 'Draft' },
  sent:     { bg: '#3943b7', fg: '#fff',    label: 'Sent' },
  accepted: { bg: '#0cf574', fg: '#141414', label: 'Accepted' },
  declined: { bg: '#e50586', fg: '#fff',    label: 'Declined' },
  invoiced: { bg: '#0a0a0a', fg: '#fff',    label: 'Invoiced' },
};

/** Today in Dallas, YYYY-MM-DD. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function blankDraft(mode: Mode = 'estimate'): Draft {
  const t = today();
  return { mode, client: '', clientName: '', title: '', number: '', issueDate: t, dueDate: addDays(t, mode === 'invoice' ? 14 : 30), text: '', notes: '', totalsOnly: true };
}

function storedDraft(): Draft {
  if (typeof window === 'undefined') return blankDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    return saved ? { ...blankDraft(saved.mode), ...saved } : blankDraft();
  } catch {
    return blankDraft();
  }
}

const clientLabel = (c: PortalClient) => c.company_name || c.full_name || 'Unnamed client';
const contactLabel = (c: Contact) => [c.name, c.company].filter(Boolean).join(' · ') || c.email || 'Unnamed contact';

export default function InvoiceBuilder() {
  const [data, setData] = useState<BillingData | null>(null);
  const [failed, setFailed] = useState('');
  const [draft, setDraft] = useState<Draft>(storedDraft);
  // The saved estimate being edited, and the estimate an invoice came from.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fromEstimateId, setFromEstimateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The portal client this was opened from (a project's "+ Invoice" / "+ Estimate").
  const [returnClient, setReturnClient] = useState<string | null>(null);
  const { toast, show } = useToast();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    apiGet<Catalog & { ready: boolean }>('/api/price-list')
      .then((c) => { if (c.ready) setCatalog(c); })
      .catch(() => { /* the builder works without the catalog */ });
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<BillingData>('/api/estimates'));
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not load');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet<BillingData>('/api/estimates')
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // ?mode=invoice|estimate&client=<portal client id>&project=<name>, from a client's project.
        const params = new URLSearchParams(window.location.search);
        const portal = params.get('client');
        const client = portal ? d.clients.find((c) => c.id === portal) : undefined;
        if (!client) return;
        setReturnClient(client.id);
        const mode: Mode = params.get('mode') === 'estimate' ? 'estimate' : 'invoice';
        const project = (params.get('project') ?? '').slice(0, 200);
        const key = `p:${client.id}`;
        const current = storedDraft();
        const sameJob = current.client === key && current.title === project && current.mode === mode;
        if (!sameJob && current.text.trim() && !window.confirm(`Start a new ${mode} for ${clientLabel(client)}? The draft you had open will be replaced.`)) return;
        if (!sameJob) {
          setEditingId(null);
          setFromEstimateId(null);
          setDraft({ ...blankDraft(mode), client: key, clientName: clientLabel(client), title: project });
        }
        if (mode === 'invoice' && !(sameJob && current.number)) {
          apiSend<{ invoice_number: string }>('/api/admin', 'POST', { action: 'next_invoice_number', clientId: client.id })
            .then((r) => setDraft((dr) => (dr.client === key && !dr.number ? { ...dr, number: r.invoice_number } : dr)))
            .catch(() => { /* the number can be typed */ });
        }
        window.history.replaceState(null, '', window.location.pathname);
      })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error ? e.message : 'Could not load'); });
    return () => { cancelled = true; };
  }, []);

  // Keep the list typed so far if the tab closes.
  useEffect(() => {
    if (!editingId) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, editingId]);

  if (!data) {
    return <div className={p.screen}><div className={p.wrap}><p className={p.empty}>{failed || 'Loading…'}</p></div></div>;
  }

  const { items, problems } = parseLineItems(draft.text);
  const total = totalCents(items);
  const showHours = items.some((it) => it.hours !== null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  /** The portal login behind the chosen client, if any: needed to invoice in the portal. */
  function portalIdOf(client: string): string | null {
    if (client.startsWith('p:')) return client.slice(2);
    if (client.startsWith('c:')) return data!.contacts.find((c) => c.id === client.slice(2))?.portal_client_id ?? null;
    return null;
  }
  const portalId = portalIdOf(draft.client);

  async function fillInvoiceNumber(client: string) {
    const id = portalIdOf(client);
    if (!id) return;
    try {
      const r = await apiSend<{ invoice_number: string }>('/api/admin', 'POST', { action: 'next_invoice_number', clientId: id });
      setDraft((d) => (d.client === client ? { ...d, number: r.invoice_number } : d));
    } catch { /* the number can be typed */ }
  }

  function pickClient(value: string) {
    let name = '';
    if (value.startsWith('p:')) { const c = data!.clients.find((x) => x.id === value.slice(2)); name = c ? clientLabel(c) : ''; }
    if (value.startsWith('c:')) { const c = data!.contacts.find((x) => x.id === value.slice(2)); name = c ? c.company || c.name : ''; }
    setDraft((d) => ({ ...d, client: value, clientName: value ? name : d.clientName, number: d.mode === 'invoice' ? '' : d.number }));
    if (draft.mode === 'invoice') void fillInvoiceNumber(value);
  }

  function switchMode(mode: Mode) {
    if (mode === draft.mode) return;
    setDraft((d) => ({ ...d, mode, number: '', dueDate: addDays(d.issueDate, mode === 'invoice' ? 14 : 30) }));
    if (mode === 'invoice') void fillInvoiceNumber(draft.client);
    else setFromEstimateId(null);
  }

  function startNew() {
    if (draft.text.trim() && !window.confirm('Clear this and start a new one?')) return;
    setEditingId(null);
    setFromEstimateId(null);
    setDraft(blankDraft(draft.mode));
  }

  function clientKeyFor(est: Estimate): string {
    if (est.portal_client_id) return `p:${est.portal_client_id}`;
    if (est.crm_contact_id) return `c:${est.crm_contact_id}`;
    return '';
  }

  function openEstimate(est: Estimate) {
    setEditingId(est.id);
    setFromEstimateId(null);
    setDraft({
      mode: 'estimate', client: clientKeyFor(est), clientName: est.client_name, title: est.title,
      number: est.estimate_number, issueDate: est.issue_date, dueDate: est.valid_until ?? '',
      text: lineItemsToText(est.line_items), notes: est.notes ?? '', totalsOnly: est.totals_only ?? false,
    });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function invoiceFromEstimate(est: Estimate) {
    const client = clientKeyFor(est);
    const t = today();
    setEditingId(null);
    setFromEstimateId(est.id);
    setDraft({
      mode: 'invoice', client, clientName: est.client_name, title: est.title, number: '',
      issueDate: t, dueDate: addDays(t, 14), text: lineItemsToText(est.line_items), notes: est.notes ?? '',
      totalsOnly: est.totals_only ?? false,
    });
    void fillInvoiceNumber(client);
    if (!portalIdOf(client)) show('Pick a client with a portal login to add this invoice to their portal.', 'error');
    document.querySelector("main")?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function estimateBody() {
    return {
      portal_client_id: draft.client.startsWith('p:') ? draft.client.slice(2) : null,
      crm_contact_id: draft.client.startsWith('c:') ? draft.client.slice(2) : null,
      client_name: draft.clientName,
      title: draft.title,
      line_items: items,
      notes: draft.notes || null,
      issue_date: draft.issueDate,
      valid_until: draft.dueDate || null,
      totals_only: draft.totalsOnly,
    };
  }

  async function saveEstimate() {
    setBusy(true);
    try {
      const saved = editingId
        ? await apiSend<Estimate>(`/api/estimates/${editingId}`, 'PATCH', estimateBody())
        : await apiSend<Estimate>('/api/estimates', 'POST', estimateBody());
      setEditingId(saved.id);
      setDraft((d) => ({ ...d, number: saved.estimate_number }));
      localStorage.removeItem(DRAFT_KEY);
      show(editingId ? 'Estimate updated.' : `Saved as ${saved.estimate_number}.`);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
    }
    setBusy(false);
  }

  async function addToPortal() {
    if (!portalId) return;
    if (!draft.number.trim()) { show('Add an invoice number.', 'error'); return; }
    if (!window.confirm(`Add invoice ${draft.number} for ${formatLineMoney(total)} to ${draft.clientName || 'this client'}'s portal? They'll get an email (and a text if they've opted in).`)) return;
    setBusy(true);
    try {
      const inv = await apiSend<InvoiceRow>('/api/admin', 'POST', {
        action: 'add_invoice',
        clientId: portalId,
        invoice_number: draft.number.trim(),
        project_name: draft.title.trim() || 'Creative services',
        invoice_date: draft.issueDate,
        due_date: draft.dueDate,
        status: 'due',
        line_items: items,
        notes: draft.notes,
        totals_only: draft.totalsOnly,
      });
      if (fromEstimateId) {
        await apiSend(`/api/estimates/${fromEstimateId}`, 'PATCH', { status: 'invoiced', invoice_id: inv.id }).catch(() => undefined);
      }
      localStorage.removeItem(DRAFT_KEY);
      setFromEstimateId(null);
      setDraft(blankDraft('invoice'));
      show(`Invoice ${inv.invoice_number} added to the portal and sent.`);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not add the invoice', 'error');
    }
    setBusy(false);
  }

  async function downloadPdf(doc: {
    kind: Mode; number: string; title: string; total: number; issue: string; due: string;
    status: string; lines: LineItem[]; notes: string | null; client: string; totalsOnly: boolean;
  }) {
    const { generateInvoicePDF } = await import('@/lib/invoicePDF');
    await generateInvoicePDF({
      kind: doc.kind, invoice_number: doc.number || 'DRAFT', project_name: doc.title, amount_cents: doc.total,
      invoice_date: doc.issue, due_date: doc.due, status: doc.status, line_items: doc.lines, notes: doc.notes,
      totals_only: doc.totalsOnly,
    }, doc.client || null);
  }

  async function setStatus(est: Estimate, status: EstimateStatus) {
    try {
      await apiSend(`/api/estimates/${est.id}`, 'PATCH', { status });
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  async function remove(est: Estimate) {
    if (!window.confirm(`Delete estimate ${est.estimate_number}?`)) return;
    try {
      await apiSend(`/api/estimates/${est.id}`, 'DELETE');
      if (editingId === est.id) { setEditingId(null); setDraft(blankDraft('estimate')); }
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  // Price list rules, read from what's in the box now (so deleting a line by hand counts).
  const lineNames = items.map((it) => it.name);
  const missing = catalog ? missingRequired(catalog, lineNames) : [];
  const suggestions = catalog ? suggestionsFor(catalog, lineNames) : [];

  const categoryName = (item: PriceItem) => catalog?.categories.find((c) => c.id === item.category_id)?.name ?? 'Other';

  /** Adds catalog items under their category headings, plus anything they require. */
  function insertItems(picks: Pick[]) {
    if (!catalog) return;
    let text = draft.text;
    const byCategory = new Map<string, string[]>();
    for (const { item, qty } of picks) {
      const cat = categoryName(item);
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), itemLine(item, qty)]);
    }
    for (const [cat, lines] of byCategory) text = insertUnderHeading(text, cat, lines);
    // Required items come along automatically.
    const added: string[] = [];
    for (const { item, required } of missingRequired(catalog, parseLineItems(text).items.map((it) => it.name))) {
      text = insertUnderHeading(text, categoryName(required), [itemLine(required)]);
      added.push(`${required.name} added: required with ${item.name}`);
    }
    set('text', text);
    setDrawer(false);
    show(added.length ? added.join('. ') : `Added ${picks.length} item${picks.length === 1 ? '' : 's'}.`);
  }

  const clientNameById = new Map(data.clients.map((c) => [c.id, clientLabel(c)]));
  const canSave = items.length > 0 && problems.length === 0 && missing.length === 0;
  const isInvoice = draft.mode === 'invoice';

  return (
    <div className={p.screen}>
      <div className={p.wrap} style={{ maxWidth: 1280 }}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>Invoices and estimates</h1>
            <p className={p.pageSub}>Type one item per line. The preview updates as you go.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {returnClient && <Link href={`/admin/clients?client=${returnClient}`} className={p.btn}>← Back to client</Link>}
            <button type="button" className={p.btn} onClick={startNew}>New</button>
          </div>
        </div>

        {!data.ready && (
          <p className={p.card} style={{ marginBottom: 16, color: '#e50586' }}>
            Run <code>supabase/migrations/039_invoice_estimate_builder.sql</code> in Supabase to save estimates and invoice lines. Until then you can still build and download PDFs.
          </p>
        )}

        <div className={s.layout}>
          <section className={p.card}>
            <div className={s.modes} role="tablist" aria-label="Document type">
              {(['estimate', 'invoice'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={draft.mode === m}
                  className={`${s.mode} ${draft.mode === m ? s.modeOn : ''}`} onClick={() => switchMode(m)}>
                  {m === 'estimate' ? 'Estimate' : 'Invoice'}
                </button>
              ))}
            </div>

            <div className={s.fields}>
              <label style={{ gridColumn: '1 / -1' }}>
                <span className={p.label}>Client</span>
                <select className={p.select} value={draft.client} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">Someone else (type their name below)</option>
                  <optgroup label="Portal clients">
                    {data.clients.map((c) => <option key={c.id} value={`p:${c.id}`}>{clientLabel(c)}</option>)}
                  </optgroup>
                  <optgroup label="CRM contacts">
                    {data.contacts.filter((c) => !c.portal_client_id).map((c) => <option key={c.id} value={`c:${c.id}`}>{contactLabel(c)}</option>)}
                  </optgroup>
                </select>
              </label>
              <label>
                <span className={p.label}>{isInvoice ? 'Billed to' : 'Prepared for'}</span>
                <input className={p.input} value={draft.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Business or person" />
              </label>
              <label>
                <span className={p.label}>Project</span>
                <input className={p.input} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Website redesign" />
              </label>
            </div>

            <div className={s.fields}>
              <label>
                <span className={p.label}>{isInvoice ? 'Invoice number' : 'Estimate number'}</span>
                <input className={p.input} value={draft.number} onChange={(e) => set('number', e.target.value)}
                  placeholder={isInvoice ? 'INV-001' : 'Given on save'} readOnly={!isInvoice} />
              </label>
              <label>
                <span className={p.label}>Date</span>
                <input type="date" className={p.input} value={draft.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
              </label>
              <label>
                <span className={p.label}>{isInvoice ? 'Due' : 'Good until'}</span>
                <input type="date" className={p.input} value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
              </label>
            </div>

            <div className={s.itemsHead}>
              <label htmlFor="billing-items" className={p.label} style={{ margin: 0 }}>Items</label>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={!catalog} onClick={() => setDrawer(true)}
                title={catalog ? undefined : 'Run migration 047 to use the price list'}>
                + Add from price list
              </button>
            </div>
            <textarea id="billing-items" className={`${p.textarea} ${s.items}`} value={draft.text} spellCheck={false}
              onChange={(e) => set('text', e.target.value)} placeholder={EXAMPLE} />
            {items.length > 0 && <p className={s.runningTotal}>{totalsLabel(items)}</p>}
            {missing.length > 0 && (
              <div className={s.required} role="alert">
                {missing.map(({ item, required }) => (
                  <p key={required.id}>
                    {required.name} is required with {item.name}.
                    <button type="button" onClick={() => insertItems([{ item: required, qty: 1 }])}>Add it back</button>
                  </p>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className={s.suggested}>
                <span className={s.suggestedLabel}>Suggested add-ons</span>
                <div className={s.suggestedList}>
                  {suggestions.map((sg) => (
                    <button key={sg.id} type="button" className={s.suggestedChip} onClick={() => insertItems([{ item: sg, qty: 1 }])}>
                      + {sg.name} · {priceLabel(sg)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className={s.help}>
              <code>Item | description | $price</code>. Hours are optional: <code>| 3h | $300</code> is a flat price, <code>| 3h @ $100</code> multiplies.
              No bars needed for simple lines: <code>Logo design $750</code>. Start a line with <code>-</code> to add to the description above.
              Use <code>Included</code> for $0 and <code>-$100</code> for a discount. Paste from a spreadsheet works too.
              A <code># Heading</code> line groups the lines under it for the category totals; a description ending in <code>/mo</code> is monthly.
              {!draft.text && <> <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => set('text', EXAMPLE)}>Use the example</button></>}
            </p>
            {problems.length > 0 && (
              <ul className={s.problems}>
                {problems.map((pr) => <li key={pr.line}>Line {pr.line}: {pr.message}</li>)}
              </ul>
            )}

            <label style={{ display: 'block', marginTop: 14 }}>
              <span className={p.label}>Notes (optional)</span>
              <textarea className={p.textarea} value={draft.notes} onChange={(e) => set('notes', e.target.value)}
                placeholder={isInvoice ? 'Payment terms, thank-you note…' : 'What’s not included, timeline, next steps…'} />
            </label>

            <label className={s.switchRow}>
              <input type="checkbox" checked={draft.totalsOnly} onChange={(e) => set('totalsOnly', e.target.checked)} />
              <span>
                Totals only
                <small>The client’s PDF shows each category’s subtotal and the total, not every line. You always see every line here.</small>
              </span>
            </label>

            <div className={s.actions}>
              {isInvoice ? (
                <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!canSave || !portalId || busy || !data.ready} onClick={addToPortal}
                  title={portalId ? undefined : 'Pick a client with a portal login'}>
                  {busy ? 'Adding…' : 'Add to client portal'}
                </button>
              ) : (
                <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!canSave || busy || !data.ready} onClick={saveEstimate}>
                  {busy ? 'Saving…' : editingId ? 'Save changes' : 'Save estimate'}
                </button>
              )}
              <button type="button" className={p.btn} disabled={!canSave}
                onClick={() => downloadPdf({ kind: draft.mode, number: draft.number, title: draft.title, total, issue: draft.issueDate, due: draft.dueDate, status: 'due', lines: items, notes: draft.notes || null, client: draft.clientName, totalsOnly: draft.totalsOnly })}>
                Download PDF
              </button>
            </div>
            {isInvoice && !portalId && (
              <p className={s.help}>Only clients with a portal login can be invoiced in the portal (where they pay by card). For anyone else, download the PDF.</p>
            )}
            {fromEstimateId && <p className={s.help}>From an estimate: it will be marked Invoiced once this is added.</p>}
            {missing.length > 0 && <p className={s.help}>Add the required items back to save.</p>}
          </section>

          <Preview draft={draft} items={items} total={total} showHours={showHours} />
        </div>

        <section className={p.card} style={{ marginTop: 18 }}>
          <h2 className={p.cardTitle}>Estimates</h2>
          {data.estimates.length === 0 ? <p className={p.rowMeta}>No estimates yet.</p> : (
            <ul className={s.list}>
              {data.estimates.map((est) => {
                const st = STATUS_STYLE[est.status];
                return (
                  <li key={est.id} className={s.listRow}>
                    <div className={s.listMain}>
                      <strong style={{ fontSize: 14 }}>{est.estimate_number}</strong>{' '}
                      <span className={s.pill} style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                      <p className={p.rowMeta}>
                        {[est.client_name, est.title, formatLineMoney(est.total_cents), formatDate(est.issue_date)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {est.status !== 'invoiced' && (
                      <select className={p.select} style={{ width: 'auto' }} value={est.status} aria-label={`Status of ${est.estimate_number}`}
                        onChange={(e) => setStatus(est, e.target.value as EstimateStatus)}>
                        {(['draft', 'sent', 'accepted', 'declined'] as const).map((v) => <option key={v} value={v}>{STATUS_STYLE[v].label}</option>)}
                      </select>
                    )}
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => openEstimate(est)}>Edit</button>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`}
                      onClick={() => downloadPdf({ kind: 'estimate', number: est.estimate_number, title: est.title, total: est.total_cents, issue: est.issue_date, due: est.valid_until ?? '', status: est.status, lines: est.line_items, notes: est.notes, client: est.client_name, totalsOnly: est.totals_only ?? false })}>
                      PDF
                    </button>
                    {est.status !== 'invoiced' && (
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => invoiceFromEstimate(est)}>Turn into invoice</button>
                    )}
                    <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => remove(est)}>Delete</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={p.card} style={{ marginTop: 16 }}>
          <h2 className={p.cardTitle}>Recent invoices</h2>
          {data.invoices.length === 0 ? <p className={p.rowMeta}>No invoices yet.</p> : (
            <ul className={s.list}>
              {data.invoices.map((inv) => (
                <li key={inv.id} className={s.listRow}>
                  <div className={s.listMain}>
                    <strong style={{ fontSize: 14 }}>{inv.invoice_number}</strong>
                    <p className={p.rowMeta}>
                      {[clientNameById.get(inv.client_id), inv.project_name, formatLineMoney(inv.amount_cents), `due ${formatDate(inv.due_date)}`, inv.status].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Link href={`/admin/clients?client=${inv.client_id}`} className={`${p.btn} ${p.btnSmall}`}>Client</Link>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`}
                    onClick={() => downloadPdf({ kind: 'invoice', number: inv.invoice_number, title: inv.project_name, total: inv.amount_cents, issue: inv.invoice_date, due: inv.due_date, status: inv.status, lines: inv.line_items ?? [], notes: inv.notes ?? null, client: clientNameById.get(inv.client_id) ?? '', totalsOnly: inv.totals_only ?? false })}>
                    PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {drawer && catalog && <PriceListDrawer catalog={catalog} onInsert={insertItems} onClose={() => setDrawer(false)} />}
      <Toast toast={toast} />
    </div>
  );
}


function Preview({ draft, items, total, showHours }: { draft: Draft; items: LineItem[]; total: number; showHours: boolean }) {
  const isInvoice = draft.mode === 'invoice';
  const groups = categoryTotals(items);
  const grouped = items.some((it) => it.category);
  const split = splitTotals(items);
  return (
    <section className={s.paper} aria-label="Preview">
      <div className={s.paperHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/new-thrive/logo.png" alt="Thrive Creative Studios" className={s.paperLogo} />
        <h2 className={s.paperKind}>{isInvoice ? 'Invoice' : 'Estimate'}</h2>
      </div>

      <div className={s.paperMeta}>
        <div>
          {draft.clientName && <><span className={s.paperLabel}>{isInvoice ? 'BILLED TO' : 'PREPARED FOR'}</span><strong style={{ fontSize: 15 }}>{draft.clientName}</strong></>}
          {draft.title && <div style={{ marginTop: 8 }}><span className={s.paperLabel}>PROJECT</span>{draft.title}</div>}
        </div>
        <div className={s.paperMetaRight}>
          <span className={s.paperLabel}>{isInvoice ? 'INVOICE #' : 'ESTIMATE #'}</span>{draft.number || (isInvoice ? '—' : 'On save')}
          <div style={{ marginTop: 6 }}><span className={s.paperLabel}>DATE</span>{formatDate(draft.issueDate)}</div>
          {draft.dueDate && <div style={{ marginTop: 6 }}><span className={s.paperLabel}>{isInvoice ? 'DUE' : 'GOOD UNTIL'}</span>{formatDate(draft.dueDate)}</div>}
        </div>
      </div>

      {draft.totalsOnly && items.length > 0 && (
        <p className={s.paperFlag}>Totals only: the client’s PDF shows each category’s subtotal, not the lines in grey.</p>
      )}
      <table className={s.table}>
        <thead>
          <tr>
            <th>DESCRIPTION</th>
            {showHours && <th className={s.num}>HOURS</th>}
            <th className={s.num}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={showHours ? 3 : 2} className={s.paperEmpty}>Your items show here as you type.</td></tr>
          ) : groups.map((g) => (
            <Fragment key={g.category}>
              {(grouped || draft.totalsOnly) && (
                <tr className={s.catRow}>
                  <td colSpan={showHours ? 2 : 1}>{g.category}</td>
                  <td className={s.num}>{amountText(g.oneTime, g.monthly)}</td>
                </tr>
              )}
              {g.items.map((it, i) => (
                <tr key={i} className={draft.totalsOnly ? s.dimmed : undefined}>
                  <td>
                    <div className={s.lineName}>{it.name}</div>
                    {it.description && <div className={s.lineDesc}>{it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}</div>}
                  </td>
                  {showHours && <td className={s.num}>{it.hours ?? ''}</td>}
                  <td className={s.num} style={{ fontWeight: 700 }}>
                    {isMonthly(it) ? amountText(0, it.amount_cents) : amountText(it.amount_cents, 0)}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      {!isInvoice && split.monthly ? (
        <>
          {split.oneTime !== 0 && (
            <div className={s.total}>
              <span className={s.totalLabel}>ONE-TIME TOTAL</span>
              <span className={s.totalValue}>{formatLineMoney(split.oneTime)}</span>
            </div>
          )}
          <div className={s.total}>
            <span className={s.totalLabel}>MONTHLY</span>
            <span className={s.totalValue}>{formatLineMoney(split.monthly)}/mo</span>
          </div>
        </>
      ) : (
        <div className={s.total}>
          <span className={s.totalLabel}>{isInvoice ? 'TOTAL DUE' : 'ESTIMATE TOTAL'}</span>
          <span className={s.totalValue}>{formatLineMoney(total)}</span>
        </div>
      )}
      {isInvoice && split.monthly !== 0 && (
        <p className={s.paperNotes}>Includes the first month of monthly services ({formatLineMoney(split.monthly)}/mo).</p>
      )}

      {draft.notes.trim() && <p className={s.paperNotes}>{draft.notes.trim()}</p>}
    </section>
  );
}
