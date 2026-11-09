'use client';

// Invoices and estimates from a typed list: one item per line, parsed by
// src/lib/lineItems.ts. Estimates are saved here (migration 039); an invoice
// goes into the client's portal through the add_invoice action, so the portal,
// Stripe, reminders and the CRM deal all work as they do for any invoice.
// "Add from price list" inserts catalog items as typed lines (migration 047);
// "Totals only" makes the client's PDF show category subtotals.
//
// Two views: the list (stats, estimates, invoices) and the editor (four steps,
// a live paper preview, and a bar pinned to the bottom with the total and the
// main action). On phones the preview opens as a sheet.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import s from './billing.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { amountText, categoryTotals, formatLineMoney, isMonthly, lineItemsToText, parseLineItems, splitTotals, totalCents, type LineItem } from '@/lib/lineItems';
import type { Estimate, EstimateStatus } from '@/lib/estimates';
import { insertUnderHeading, itemLine, missingRequired, priceLabel, suggestionsFor, type Catalog, type PriceItem } from '@/lib/priceCatalog';
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

const EXAMPLE = `# Website
Homepage design | Custom layout for phone and desktop | $600
Inner pages | Services, About, Contact | 6h @ $100
Hosting setup | Included

# Branding
Logo refresh - two concepts $350
  - Three rounds of revisions
Returning client discount | -$100`;

const STATUS_STYLE: Record<EstimateStatus, { cls: string; label: string }> = {
  draft:    { cls: s.stDraft,    label: 'Draft' },
  sent:     { cls: s.stSent,     label: 'Sent' },
  accepted: { cls: s.stAccepted, label: 'Accepted' },
  declined: { cls: s.stDeclined, label: 'Declined' },
  invoiced: { cls: s.stInvoiced, label: 'Invoiced' },
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

/** Paid, overdue (due date gone by) or due. */
function invoiceState(inv: InvoiceRow): { cls: string; label: string } {
  if (inv.status === 'paid') return { cls: s.stAccepted, label: 'Paid' };
  if (inv.status === 'overdue' || (inv.due_date && inv.due_date < today())) return { cls: s.stDeclined, label: 'Overdue' };
  return { cls: s.stSent, label: 'Due' };
}

export default function InvoiceBuilder() {
  const [data, setData] = useState<BillingData | null>(null);
  const [failed, setFailed] = useState('');
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [tab, setTab] = useState<'estimates' | 'invoices'>('estimates');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(storedDraft);
  // The saved estimate being edited, and the estimate an invoice came from.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fromEstimateId, setFromEstimateId] = useState<string | null>(null);
  // The draft as last saved/opened, so leaving with changes can ask first.
  const [snapshot, setSnapshot] = useState('');
  const [busy, setBusy] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
        setView('edit');
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
    return <div className={w.page}><p className={w.muted}>{failed || 'Loading…'}</p></div>;
  }

  const { items, problems } = parseLineItems(draft.text);
  const total = totalCents(items);
  const split = splitTotals(items);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const isInvoice = draft.mode === 'invoice';
  const dirty = editingId ? JSON.stringify(draft) !== snapshot : false;
  const hasDraft = !editingId && (draft.text.trim() !== '' || draft.clientName.trim() !== '');

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

  function pickClient(value: string, name: string) {
    setDraft((d) => ({ ...d, client: value, clientName: name, number: d.mode === 'invoice' ? '' : d.number }));
    if (draft.mode === 'invoice') void fillInvoiceNumber(value);
  }

  function switchMode(mode: Mode) {
    if (mode === draft.mode) return;
    setDraft((d) => ({ ...d, mode, number: '', dueDate: addDays(d.issueDate, mode === 'invoice' ? 14 : 30) }));
    if (mode === 'invoice') void fillInvoiceNumber(draft.client);
    else setFromEstimateId(null);
  }

  const scrollTop = () => document.querySelector('main')?.scrollTo({ top: 0 });

  function leaveEditor() {
    if (dirty && !window.confirm('Leave without saving your changes to this estimate?')) return;
    if (editingId) {
      // Back to whatever unsaved draft was there before.
      setEditingId(null);
      setFromEstimateId(null);
      setDraft(storedDraft());
    }
    setPreviewOpen(false);
    setView('list');
    scrollTop();
  }

  function startNew(mode: Mode) {
    if (hasDraft && !window.confirm('Start fresh? The unsaved draft you had will be cleared.')) return;
    setEditingId(null);
    setFromEstimateId(null);
    setDraft(blankDraft(mode));
    setView('edit');
    scrollTop();
  }

  function continueDraft() {
    setEditingId(null);
    setView('edit');
    scrollTop();
  }

  function clientKeyFor(est: Estimate): string {
    if (est.portal_client_id) return `p:${est.portal_client_id}`;
    if (est.crm_contact_id) return `c:${est.crm_contact_id}`;
    return '';
  }

  function openEstimate(est: Estimate) {
    const next: Draft = {
      mode: 'estimate', client: clientKeyFor(est), clientName: est.client_name, title: est.title,
      number: est.estimate_number, issueDate: est.issue_date, dueDate: est.valid_until ?? '',
      text: lineItemsToText(est.line_items), notes: est.notes ?? '', totalsOnly: est.totals_only ?? false,
    };
    setEditingId(est.id);
    setFromEstimateId(null);
    setDraft(next);
    setSnapshot(JSON.stringify(next));
    setView('edit');
    scrollTop();
  }

  function invoiceFromEstimate(est: Estimate) {
    if (hasDraft && !window.confirm('Turn this into an invoice? The unsaved draft you had will be replaced.')) return;
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
    setView('edit');
    scrollTop();
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
      const next = { ...draft, number: saved.estimate_number };
      setEditingId(saved.id);
      setDraft(next);
      setSnapshot(JSON.stringify(next));
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
      setView('list');
      setTab('invoices');
      scrollTop();
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

  const draftPdf = () => downloadPdf({ kind: draft.mode, number: draft.number, title: draft.title, total, issue: draft.issueDate, due: draft.dueDate, status: 'due', lines: items, notes: draft.notes || null, client: draft.clientName, totalsOnly: draft.totalsOnly });
  const estimatePdf = (est: Estimate) => downloadPdf({ kind: 'estimate', number: est.estimate_number, title: est.title, total: est.total_cents, issue: est.issue_date, due: est.valid_until ?? '', status: est.status, lines: est.line_items, notes: est.notes, client: est.client_name, totalsOnly: est.totals_only ?? false });

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
      if (editingId === est.id) { setEditingId(null); setDraft(storedDraft()); setView('list'); }
      await load();
      show(`Deleted ${est.estimate_number}.`);
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
  const editingEstimate = editingId ? data.estimates.find((e) => e.id === editingId) : undefined;

  // ── List view ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    const q = query.trim().toLowerCase();
    const estimates = data.estimates.filter((e) => !q || `${e.estimate_number} ${e.client_name} ${e.title}`.toLowerCase().includes(q));
    const invoices = data.invoices.filter((i) => !q || `${i.invoice_number} ${clientNameById.get(i.client_id) ?? ''} ${i.project_name}`.toLowerCase().includes(q));
    const open = data.estimates.filter((e) => e.status === 'draft' || e.status === 'sent');
    const accepted = data.estimates.filter((e) => e.status === 'accepted');
    const unpaid = data.invoices.filter((i) => i.status !== 'paid');
    const overdue = unpaid.filter((i) => invoiceState(i).label === 'Overdue');
    const sumEst = (xs: Estimate[]) => xs.reduce((n, x) => n + x.total_cents, 0);
    const sumInv = (xs: InvoiceRow[]) => xs.reduce((n, x) => n + x.amount_cents, 0);

    return (
      <div className={w.page}>
        <div className={w.head}>
          <div>
            <h1 className={w.title}>Estimates &amp; Invoices</h1>
            <p className={w.sub}>Build one from your price list or type it out, then download the PDF or send the invoice to their portal.</p>
          </div>
          <div className={w.headActions}>
            <Link href="/admin/price-list" className={p.btn}>Price list</Link>
            <button type="button" className={p.btn} onClick={() => startNew('invoice')}>New invoice</button>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => startNew('estimate')}>New estimate</button>
          </div>
        </div>

        {!data.ready && (
          <p className={s.notice}>
            Run <code>supabase/migrations/039_invoice_estimate_builder.sql</code> in Supabase to save estimates and invoice lines. Until then you can still build and download PDFs.
          </p>
        )}

        {hasDraft && (
          <div className={s.draftBanner}>
            <div>
              <strong>Unsaved {draft.mode}</strong>
              <span className={w.muted}> · {[draft.clientName, draft.title, items.length ? formatLineMoney(total) : ''].filter(Boolean).join(' · ') || 'started'}</span>
            </div>
            <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} onClick={continueDraft}>Continue</button>
          </div>
        )}

        <div className={`${w.statRow} ${s.stats}`}>
          <div className={w.stat}>
            <p className={w.statLabel}>Open estimates</p>
            <p className={w.statValue}>{formatLineMoney(sumEst(open))}</p>
            <p className={w.statNote}>{open.length} draft or sent</p>
          </div>
          <div className={w.stat}>
            <p className={w.statLabel}>Accepted</p>
            <p className={w.statValue}>{formatLineMoney(sumEst(accepted))}</p>
            <p className={w.statNote}>{accepted.length ? `${accepted.length} ready to invoice` : 'None waiting'}</p>
          </div>
          <div className={w.stat}>
            <p className={w.statLabel}>Unpaid invoices</p>
            <p className={w.statValue}>{formatLineMoney(sumInv(unpaid))}</p>
            <p className={w.statNote}>{overdue.length ? `${overdue.length} overdue` : `${unpaid.length} waiting`}</p>
          </div>
        </div>

        <div className={s.listBar}>
          <div className={w.tabs} role="tablist" aria-label="Show" style={{ margin: 0 }}>
            <button type="button" role="tab" aria-selected={tab === 'estimates'} className={`${w.tab} ${tab === 'estimates' ? w.tabOn : ''}`} onClick={() => setTab('estimates')}>
              Estimates <span className={s.count}>{data.estimates.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'invoices'} className={`${w.tab} ${tab === 'invoices' ? w.tabOn : ''}`} onClick={() => setTab('invoices')}>
              Invoices <span className={s.count}>{data.invoices.length}</span>
            </button>
          </div>
          <input type="search" className={w.searchInput} placeholder="Search by number, client or project" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search estimates and invoices" />
        </div>

        {tab === 'estimates' && (
          estimates.length === 0 ? (
            <div className={s.emptyCard}>
              <p>{q ? 'No estimates match.' : 'No estimates yet.'}</p>
              {!q && <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => startNew('estimate')}>Make your first estimate</button>}
            </div>
          ) : (
            <ul className={s.docList}>
              {estimates.map((est) => {
                const st = STATUS_STYLE[est.status];
                return (
                  <li key={est.id} className={s.doc}>
                    <button type="button" className={s.docMain} onClick={() => openEstimate(est)}>
                      <span className={s.docTop}>
                        <span className={s.docNumber}>{est.estimate_number}</span>
                        <span className={`${s.status} ${st.cls}`}>{st.label}</span>
                      </span>
                      <span className={s.docWho}>{est.client_name || 'No client'}</span>
                      <span className={s.docMeta}>{[est.title, formatDate(est.issue_date)].filter(Boolean).join(' · ')}</span>
                    </button>
                    <span className={s.docAmount}>{formatLineMoney(est.total_cents)}</span>
                    <div className={s.docActions}>
                      {est.status !== 'invoiced' && (
                        <select className={s.statusSelect} value={est.status} aria-label={`Status of ${est.estimate_number}`}
                          onChange={(e) => setStatus(est, e.target.value as EstimateStatus)}>
                          {(['draft', 'sent', 'accepted', 'declined'] as const).map((v) => <option key={v} value={v}>{STATUS_STYLE[v].label}</option>)}
                        </select>
                      )}
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => estimatePdf(est)}>PDF</button>
                      {est.status !== 'invoiced' && (
                        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => invoiceFromEstimate(est)}>Invoice it</button>
                      )}
                      <button type="button" className={s.iconBtn} aria-label={`Delete ${est.estimate_number}`} title="Delete" onClick={() => remove(est)}>×</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === 'invoices' && (
          invoices.length === 0 ? (
            <div className={s.emptyCard}>
              <p>{q ? 'No invoices match.' : 'No invoices yet.'}</p>
              {!q && <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => startNew('invoice')}>Make an invoice</button>}
            </div>
          ) : (
            <ul className={s.docList}>
              {invoices.map((inv) => {
                const st = invoiceState(inv);
                const client = clientNameById.get(inv.client_id) ?? '';
                return (
                  <li key={inv.id} className={s.doc}>
                    <Link href={`/admin/clients?client=${inv.client_id}`} className={s.docMain}>
                      <span className={s.docTop}>
                        <span className={s.docNumber}>{inv.invoice_number}</span>
                        <span className={`${s.status} ${st.cls}`}>{st.label}</span>
                      </span>
                      <span className={s.docWho}>{client || 'Client'}</span>
                      <span className={s.docMeta}>{[inv.project_name, inv.status === 'paid' ? `issued ${formatDate(inv.invoice_date)}` : `due ${formatDate(inv.due_date)}`].filter(Boolean).join(' · ')}</span>
                    </Link>
                    <span className={s.docAmount}>{formatLineMoney(inv.amount_cents)}</span>
                    <div className={s.docActions}>
                      <button type="button" className={`${p.btn} ${p.btnSmall}`}
                        onClick={() => downloadPdf({ kind: 'invoice', number: inv.invoice_number, title: inv.project_name, total: inv.amount_cents, issue: inv.invoice_date, due: inv.due_date, status: inv.status, lines: inv.line_items ?? [], notes: inv.notes ?? null, client, totalsOnly: inv.totals_only ?? false })}>
                        PDF
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
        {tab === 'invoices' && invoices.length > 0 && <p className={s.listFoot}>The 30 most recent. Open a client to see all of theirs, record payments or send a reminder.</p>}
        <Toast toast={toast} />
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  const heading = editingId ? `Edit ${draft.number}` : fromEstimateId ? 'Invoice from estimate' : `New ${isInvoice ? 'invoice' : 'estimate'}`;
  const primaryLabel = isInvoice
    ? (busy ? 'Sending…' : 'Send to client portal')
    : (busy ? 'Saving…' : editingId ? (dirty ? 'Save changes' : 'Saved') : 'Save estimate');
  const primaryDisabled = isInvoice
    ? !canSave || !portalId || busy || !data.ready
    : !canSave || busy || !data.ready || (!!editingId && !dirty);
  const blocker = items.length === 0 ? 'Add at least one item'
    : problems.length ? `Fix line ${problems[0].line}`
    : missing.length ? `${missing[0].required.name} is required`
    : isInvoice && !portalId ? 'Pick a portal client to send it'
    : '';

  return (
    <div className={`${w.page} ${s.editorPage}`}>
      <div className={s.editorTop}>
        <button type="button" className={s.back} onClick={leaveEditor}>← All estimates &amp; invoices</button>
        {returnClient && <Link href={`/admin/clients?client=${returnClient}`} className={s.back}>Back to client</Link>}
      </div>

      <div className={w.head}>
        <div>
          <h1 className={w.title}>{heading}</h1>
          {editingEstimate && (
            <p className={w.sub}>
              <span className={`${s.status} ${STATUS_STYLE[editingEstimate.status].cls}`}>{STATUS_STYLE[editingEstimate.status].label}</span>
              {' '}Saved {formatDate(editingEstimate.updated_at)}{dirty ? ' · unsaved changes' : ''}
            </p>
          )}
          {fromEstimateId && <p className={w.sub}>The estimate will be marked Invoiced once this is sent.</p>}
        </div>
        {!editingId && (
          <div className={w.tabs} role="tablist" aria-label="Document type" style={{ margin: 0 }}>
            {(['estimate', 'invoice'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={draft.mode === m}
                className={`${w.tab} ${draft.mode === m ? w.tabOn : ''}`} onClick={() => switchMode(m)}>
                {m === 'estimate' ? 'Estimate' : 'Invoice'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={s.layout}>
        <div className={s.steps}>
          <section className={s.step}>
            <StepHead n={1} title="Who’s it for?"
              hint={isInvoice ? 'Invoices go to a client with a portal login, where they pay by card.' : 'A portal client, a contact, or just type a name.'} />
            <ClientPicker data={data} value={draft.client} name={draft.clientName}
              onPick={pickClient}
              onType={(name) => setDraft((d) => ({ ...d, client: '', clientName: name }))} />
            {isInvoice && draft.clientName && !portalId && (
              <p className={s.warn}>{draft.clientName} has no portal login, so this can only be downloaded as a PDF.</p>
            )}
          </section>

          <section className={s.step}>
            <StepHead n={2} title="Details" />
            <div className={s.fields}>
              <label className={s.wide}>
                <span className={p.label}>Project</span>
                <input className={p.input} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Website redesign" />
              </label>
              <label>
                <span className={p.label}>{isInvoice ? 'Invoice number' : 'Estimate number'}</span>
                <input className={p.input} value={draft.number} onChange={(e) => set('number', e.target.value)}
                  placeholder={isInvoice ? 'INV-001' : 'Given when saved'} readOnly={!isInvoice} />
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
            <div className={s.quickDates}>
              {(isInvoice ? [['On receipt', 0], ['7 days', 7], ['14 days', 14], ['30 days', 30]] as const : [['14 days', 14], ['30 days', 30], ['60 days', 60]] as const).map(([label, days]) => (
                <button key={label} type="button" className={`${s.chip} ${draft.dueDate === addDays(draft.issueDate, days) ? s.chipOn : ''}`}
                  onClick={() => set('dueDate', addDays(draft.issueDate, days))}>{label}</button>
              ))}
            </div>
          </section>

          <section className={s.step}>
            <StepHead n={3} title="Items" hint="One item per line. Add from your price list or type your own." />
            <div className={s.itemsTools}>
              <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!catalog} onClick={() => setDrawer(true)}
                title={catalog ? undefined : 'Run migration 047 to use the price list'}>
                + Add from price list
              </button>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-expanded={tipsOpen} onClick={() => setTipsOpen((v) => !v)}>
                {tipsOpen ? 'Hide tips' : 'How to type items'}
              </button>
              {!draft.text && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => set('text', EXAMPLE)}>Use the example</button>}
            </div>
            {tipsOpen && (
              <ul className={s.tips}>
                <li><code>Item | description | $price</code>, one per line</li>
                <li><code>| 3h @ $100</code> multiplies; <code>| 3h | $300</code> is a flat price with the hours shown</li>
                <li><code>Logo design $750</code> works without bars</li>
                <li>A line starting with <code>-</code> adds to the description above</li>
                <li><code>Included</code> for $0, <code>-$100</code> for a discount</li>
                <li><code># Website</code> starts a group, for the category totals</li>
                <li>A description ending in <code>/mo</code> is monthly</li>
                <li>Pasting from a spreadsheet works too</li>
              </ul>
            )}
            <textarea aria-label="Items" className={`${p.textarea} ${s.items}`} value={draft.text} spellCheck={false}
              onChange={(e) => set('text', e.target.value)} placeholder={EXAMPLE} />
            {problems.length > 0 && (
              <ul className={s.problems}>
                {problems.map((pr) => <li key={pr.line}>Line {pr.line}: {pr.message}</li>)}
              </ul>
            )}
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
          </section>

          <section className={s.step}>
            <StepHead n={4} title="Finish" />
            <label className={s.switchRow}>
              <span className={s.switchText}>
                <strong>Totals only</strong>
                <small>The client’s PDF shows each category’s subtotal and the total, not every line. You always see every line here.</small>
              </span>
              <input type="checkbox" role="switch" className={s.switch} checked={draft.totalsOnly} onChange={(e) => set('totalsOnly', e.target.checked)} />
            </label>
            <label style={{ display: 'block', marginTop: 16 }}>
              <span className={p.label}>Notes (optional)</span>
              <textarea className={p.textarea} rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)}
                placeholder={isInvoice ? 'Payment terms, thank-you note…' : 'What’s not included, timeline, next steps…'} />
            </label>
            {editingEstimate && editingEstimate.status !== 'invoiced' && (
              <div className={s.finishLinks}>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={dirty} title={dirty ? 'Save your changes first' : undefined}
                  onClick={() => invoiceFromEstimate(editingEstimate)}>Turn into invoice</button>
                <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => remove(editingEstimate)}>Delete estimate</button>
              </div>
            )}
          </section>
        </div>

        <aside className={s.previewCol}>
          <Preview draft={draft} items={items} total={total} />
        </aside>
      </div>

      <div className={s.bar}>
        <div className={s.barTotal}>
          <span className={s.barLabel}>{isInvoice ? 'Total due' : split.monthly && split.oneTime ? 'One-time + monthly' : 'Estimate total'}</span>
          <span className={s.barValue}>
            {isInvoice || !split.monthly ? formatLineMoney(total) : amountText(split.oneTime, split.monthly)}
          </span>
          <span className={s.barMeta}>{blocker || `${items.length} item${items.length === 1 ? '' : 's'}${isInvoice && split.monthly ? ` · first month of ${formatLineMoney(split.monthly)}/mo included` : ''}`}</span>
        </div>
        <div className={s.barActions}>
          <button type="button" className={`${p.btn} ${s.previewBtn}`} onClick={() => setPreviewOpen(true)}>Preview</button>
          <button type="button" className={p.btn} disabled={!canSave} onClick={draftPdf}>PDF</button>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={primaryDisabled}
            onClick={isInvoice ? addToPortal : saveEstimate}>{primaryLabel}</button>
        </div>
      </div>

      {previewOpen && (
        <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Preview">
          <div className={s.sheetHead}>
            <strong>Preview</strong>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setPreviewOpen(false)}>Done</button>
          </div>
          <Preview draft={draft} items={items} total={total} />
        </div>
      )}
      {drawer && catalog && <PriceListDrawer catalog={catalog} onInsert={insertItems} onClose={() => setDrawer(false)} />}
      <div className={s.toastLift}><Toast toast={toast} /></div>
    </div>
  );
}

function StepHead({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className={s.stepHead}>
      <span className={s.stepNum} aria-hidden="true">{n}</span>
      <div>
        <h2 className={s.stepTitle}>{title}</h2>
        {hint && <p className={s.stepHint}>{hint}</p>}
      </div>
    </div>
  );
}

/**
 * One box for who it's for: type to search portal clients and contacts, pick
 * one to link it (portal clients can be invoiced), or keep the typed name.
 */
function ClientPicker({ data, value, name, onPick, onType }: {
  data: BillingData; value: string; name: string;
  onPick: (key: string, name: string) => void; onType: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = name.trim().toLowerCase();
  const linked = value !== '';
  const portal = data.clients
    .filter((c) => !q || clientLabel(c).toLowerCase().includes(q) || c.full_name.toLowerCase().includes(q))
    .slice(0, 6)
    .map((c) => ({ key: `p:${c.id}`, label: clientLabel(c), sub: c.company_name && c.full_name ? c.full_name : 'Portal client', group: 'Portal clients', name: clientLabel(c) }));
  const contacts = data.contacts
    .filter((c) => !c.portal_client_id)
    .filter((c) => q && `${c.name} ${c.company ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q))
    .slice(0, 6)
    .map((c) => ({ key: `c:${c.id}`, label: contactLabel(c), sub: c.email ?? 'Contact', group: 'Contacts', name: c.company || c.name }));
  const options = [...portal, ...contacts];

  function choose(i: number) {
    const o = options[i];
    if (!o) return;
    onPick(o.key, o.name);
    setOpen(false);
  }

  const linkedLabel = value.startsWith('p:') ? 'Portal client' : value.startsWith('c:')
    ? (data.contacts.find((c) => c.id === value.slice(2))?.portal_client_id ? 'Contact with a portal login' : 'CRM contact')
    : '';

  return (
    <div className={s.picker}>
      <input
        className={`${p.input} ${s.pickerInput}`}
        value={name}
        placeholder="Search clients or type a name"
        role="combobox"
        aria-expanded={open && !linked && options.length > 0}
        aria-controls="client-options"
        aria-autocomplete="list"
        aria-label="Client"
        onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setOpen(true); setActive(0); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onChange={(e) => { onType(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (!open || linked) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && options.length) { e.preventDefault(); choose(active); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {linked && (
        <span className={s.linked}>
          {linkedLabel}
          <button type="button" aria-label="Unlink client" onClick={() => onType(name)}>×</button>
        </span>
      )}
      {open && !linked && options.length > 0 && (
        <ul id="client-options" role="listbox" className={s.pickerList}>
          {options.map((o, i) => (
            <Fragment key={o.key}>
              {(i === 0 || options[i - 1].group !== o.group) && <li className={s.pickerGroup} aria-hidden="true">{o.group}</li>}
              <li role="option" aria-selected={i === active} className={`${s.pickerOption} ${i === active ? s.pickerOptionOn : ''}`}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setActive(i)}>
                <strong>{o.label}</strong>
                <span>{o.sub}</span>
              </li>
            </Fragment>
          ))}
          {q && <li className={s.pickerHint} aria-hidden="true">Or keep “{name.trim()}” as a typed name</li>}
        </ul>
      )}
    </div>
  );
}

function Preview({ draft, items, total }: { draft: Draft; items: LineItem[]; total: number }) {
  const isInvoice = draft.mode === 'invoice';
  const groups = categoryTotals(items);
  const grouped = items.some((it) => it.category);
  const split = splitTotals(items);
  const showHours = items.some((it) => it.hours !== null);
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
        <p className={s.paperFlag}>Totals only: the client sees each category’s subtotal, not the lines in grey.</p>
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
            <tr><td colSpan={showHours ? 3 : 2} className={s.paperEmpty}>Your items show here as you add them.</td></tr>
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
