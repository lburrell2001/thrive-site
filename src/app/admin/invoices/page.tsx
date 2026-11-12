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
import { useRouter } from 'next/navigation';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import s from './billing.module.css';
import { apiGet, apiSend, formatDate } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { amountText, categoryTotals, formatLineMoney, hasChoices, isMonthly, lineBlocks, lineItemsToText, lineText, parseLineItems, selectLines, setTierInText, splitTotals, tierTotal, tiersOf, totalCents, type LineBlock, type LineItem, type LineSelection } from '@/lib/lineItems';
import type { Estimate, EstimateStatus } from '@/lib/estimates';
import { itemForLine, insertUnderHeading, itemLine, missingRequired, priceLabel, suggestionsFor, type Catalog, type PriceItem } from '@/lib/priceCatalog';
import { PriceListDrawer, type Pick } from './PriceListDrawer';
import SendLater, { laterAt, scheduledFor } from '../SendLater';
import { formatWhen } from '@/lib/scheduleTime';
import { chosenProposalLines, proposalInvoiceText, type InvoicePart, type ProposalLine } from '@/lib/proposalBilling';
import { dueNow, remainingCents } from '@/lib/invoiceDeposit';

type Mode = 'estimate' | 'invoice';

interface PortalClient { id: string; full_name: string; company_name: string }
interface Contact { id: string; name: string; company: string | null; email: string | null; portal_client_id: string | null }
interface InvoiceRow {
  id: string; client_id: string; invoice_number: string; project_name: string; amount_cents: number;
  invoice_date: string; due_date: string; status: string; line_items?: LineItem[] | null; notes?: string | null;
  totals_only?: boolean | null;
  deposit_cents?: number | null; deposit_due_date?: string | null; deposit_paid_at?: string | null; balance_open?: boolean | null;
  /** Accepted or declined by the client in the portal (migration 058). */
  accepted_at?: string | null; declined_at?: string | null; decline_reason?: string | null;
}
interface ProjectRow { id: string; client_id: string; name: string; status: string; archived?: boolean | null }
interface DealRow { id: string; contact_id: string; title: string; stage: string }
type Scheduled = { id: string; kind: 'proposal' | 'estimate' | 'invoice'; target_id: string | null; label: string; send_at: string; status: string; error: string | null; client_id?: string | null; invoice_number?: string | null; amount_cents?: number | null; project_name?: string | null };
interface BillingData { ready: boolean; estimates: Estimate[]; invoices: InvoiceRow[]; clients: PortalClient[]; contacts: Contact[]; projects?: ProjectRow[]; deals?: DealRow[]; proposalLinks?: { id: string; title: string; estimate_id: string }[] }

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
  /** Invoices: ask for a deposit first; the rest waits until Lauren opens it. */
  depositOn?: boolean;
  depositMode?: 'percent' | 'amount';
  depositValue?: string;
  depositDue?: string;
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
  return { mode, client: '', clientName: '', title: '', number: '', issueDate: t, dueDate: addDays(t, mode === 'invoice' ? 14 : 30), text: '', notes: '', totalsOnly: true,
    depositOn: false, depositMode: 'percent', depositValue: '50', depositDue: t };
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

/** Paid, overdue, due — or for a deposit invoice, which part is due (or on hold). */
function invoiceState(inv: InvoiceRow): { cls: string; label: string } {
  const due = dueNow(inv);
  if (due.kind === 'paid') return { cls: s.stAccepted, label: 'Paid' };
  if (due.kind === 'held') return { cls: s.stDraft, label: 'Balance on hold' };
  if (due.kind === 'declined') return { cls: s.stDeclined, label: 'Declined by client' };
  const late = inv.status === 'overdue' || (!!due.dueDate && due.dueDate < today());
  const what = due.part === 'deposit' ? 'Deposit' : due.part === 'balance' ? 'Balance' : '';
  if (late) return { cls: s.stDeclined, label: what ? `${what} overdue` : 'Overdue' };
  return { cls: s.stSent, label: what ? `${what} due` : 'Due' };
}

/** "deposit $500 due Nov 16", "deposit paid · $1,500 on hold", "due Nov 23"… */
function invoiceMeta(inv: InvoiceRow): string {
  if (inv.status === 'paid') return `issued ${formatDate(inv.invoice_date)}`;
  const due = dueNow(inv);
  if (due.kind === 'pay' && due.part === 'deposit') return `${formatLineMoney(due.cents)} deposit due ${formatDate(due.dueDate ?? inv.due_date)}`;
  if (due.kind === 'held') return `deposit paid · ${formatLineMoney(due.cents)} on hold`;
  if (due.kind === 'pay' && due.part === 'balance') return `deposit paid · ${formatLineMoney(due.cents)} due ${formatDate(due.dueDate ?? inv.due_date)}`;
  return `due ${formatDate(inv.due_date)}`;
}

export default function InvoiceBuilder() {
  const router = useRouter();
  const [data, setData] = useState<BillingData | null>(null);
  const [failed, setFailed] = useState('');
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [tab, setTab] = useState<'estimates' | 'invoices'>('estimates');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(storedDraft);
  // The saved estimate being edited, and the estimate an invoice came from.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fromEstimateId, setFromEstimateId] = useState<string | null>(null);
  // The deal of the estimate an invoice came from, so the invoice joins it too.
  const [fromDealId, setFromDealId] = useState<string | null>(null);
  // The draft as last saved/opened, so leaving with changes can ask first.
  const [snapshot, setSnapshot] = useState('');
  const [busy, setBusy] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  // Typing is tucked away: a small custom-item form, and the whole list as text.
  const [customOpen, setCustomOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [custom, setCustom] = useState({ name: '', description: '', price: '', monthly: false });
  const [customError, setCustomError] = useState('');
  // The Project dropdown's "Something else…": type a name instead.
  const [projectOther, setProjectOther] = useState(false);
  // "Open balance" on a held deposit invoice: which row, and the balance's due date.
  const [opening, setOpening] = useState<{ id: string; due: string } | null>(null);
  // "Send" on an estimate: the email dialog.
  const [sending, setSending] = useState<{ est: Estimate; email: string; note: string; loading: boolean; when: string | null } | null>(null);
  // Scheduled sends (migration 053): estimates waiting to go, invoices not created yet.
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  // The invoice builder's "Send later" time; null = send now.
  const [invoiceWhen, setInvoiceWhen] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // The portal client this was opened from (a project's "+ Invoice" / "+ Estimate").
  const [returnClient, setReturnClient] = useState<string | null>(null);
  const { toast, show } = useToast();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [drawer, setDrawer] = useState(false);
  /** Tiers named in the bar but not given any items yet (migration 061). */
  const [newTiers, setNewTiers] = useState<string[]>([]);

  useEffect(() => {
    apiGet<Catalog & { ready: boolean }>('/api/price-list')
      .then((c) => { if (c.ready) setCatalog(c); })
      .catch(() => { /* the builder works without the catalog */ });
  }, []);

  const loadScheduled = useCallback(() => {
    apiGet<{ sends: Scheduled[] }>('/api/scheduled-sends').then((r) => setScheduled(r.sends)).catch(() => setScheduled([]));
  }, []);

  const load = useCallback(async () => {
    loadScheduled();
    try {
      setData(await apiGet<BillingData>('/api/estimates'));
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not load');
    }
  }, [loadScheduled]);

  useEffect(() => {
    let cancelled = false;
    loadScheduled();
    apiGet<BillingData>('/api/estimates')
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // ?mode=invoice|estimate&client=<portal client id>&project=<name>, from a client's project.
        const params = new URLSearchParams(window.location.search);
        // ?estimate=<id>, from the estimate on a deal in a contact's panel.
        const estimateId = params.get('estimate');
        const linked = estimateId ? d.estimates.find((e) => e.id === estimateId) : undefined;
        if (linked) {
          window.history.replaceState(null, '', window.location.pathname);
          const next: Draft = {
            ...blankDraft('estimate'), client: linked.portal_client_id ? `p:${linked.portal_client_id}` : linked.crm_contact_id ? `c:${linked.crm_contact_id}` : '',
            clientName: linked.client_name, title: linked.title, number: linked.estimate_number, issueDate: linked.issue_date,
            dueDate: linked.valid_until ?? '', text: lineItemsToText(linked.line_items), notes: linked.notes ?? '', totalsOnly: linked.totals_only ?? false,
          };
          setEditingId(linked.id);
          setDraft(next);
          setSnapshot(JSON.stringify(next));
          setView('edit');
          return;
        }
        // ?proposal=<id>&part=full|deposit|balance, from a signed proposal.
        const proposalId = params.get('proposal');
        if (proposalId) {
          window.history.replaceState(null, '', window.location.pathname);
          const part = (['full', 'deposit', 'balance'].includes(params.get('part') ?? '') ? params.get('part') : 'full') as InvoicePart;
          apiGet<{ proposal: { title: string; deposit_percent: number }; lineItems: ProposalLine[]; client: { name: string; company: string | null; portal_client_id: string | null } | null; estimate?: { selection?: { tier: string | null; optional: number[] } | null } | null }>(`/api/proposals/${proposalId}`)
            .then((pr) => {
              if (cancelled) return;
              const current = storedDraft();
              if (current.text.trim() && !window.confirm('Start an invoice from this proposal? The draft you had open will be replaced.')) return;
              const portalClient = pr.client?.portal_client_id ? d.clients.find((c) => c.id === pr.client!.portal_client_id) : undefined;
              const key = portalClient ? `p:${portalClient.id}` : '';
              setEditingId(null);
              setFromEstimateId(null);
              setDraft({
                ...blankDraft('invoice'), client: key,
                clientName: portalClient ? clientLabel(portalClient) : (pr.client?.company || pr.client?.name || ''),
                title: pr.proposal.title, text: proposalInvoiceText(part, pr.proposal, chosenProposalLines(pr.lineItems, pr.estimate?.selection)), totalsOnly: part === 'full',
                // The whole proposal on one invoice, with its deposit first.
                ...(part === 'full' && pr.proposal.deposit_percent > 0 && pr.proposal.deposit_percent < 100
                  ? { depositOn: true, depositMode: 'percent' as const, depositValue: String(pr.proposal.deposit_percent) }
                  : {}),
              });
              setView('edit');
              if (portalClient) {
                apiSend<{ invoice_number: string }>('/api/admin', 'POST', { action: 'next_invoice_number', clientId: portalClient.id })
                  .then((r) => setDraft((dr) => (dr.client === key && !dr.number ? { ...dr, number: r.invoice_number } : dr)))
                  .catch(() => { /* the number can be typed */ });
              }
            })
            .catch((e) => setFailed(e instanceof Error ? e.message : 'Could not load the proposal'));
          return;
        }
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
  }, [loadScheduled]);

  // Keep the list typed so far if the tab closes.
  useEffect(() => {
    if (!editingId) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, editingId]);

  if (!data) {
    return <div className={w.page}><p className={w.muted}>{failed || 'Loading…'}</p></div>;
  }

  const parsedLines = parseLineItems(draft.text);
  // An invoice bills everything on it: "optional" only means something on an estimate (migration 061).
  const items = draft.mode === 'invoice' ? parsedLines.items.map(({ optional: _o, ...it }) => { void _o; return it; }) : parsedLines.items;
  const { problems } = parsedLines;
  const total = totalCents(items);
  const split = splitTotals(items);
  const depositCents = isDepositOn(draft) ? depositFor(draft, total) : 0;
  const depositProblem = isDepositOn(draft) && (depositCents <= 0 || depositCents >= total)
    ? 'The deposit must be more than $0 and less than the total' : '';
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

  /** The chosen client's portal projects, active ones first. */
  function projectsOf(client: string): ProjectRow[] {
    const id = portalIdOf(client);
    if (!id) return [];
    return (data!.projects ?? []).filter((pr) => pr.client_id === id && pr.name.trim())
      .sort((x, y) => Number(!!x.archived) - Number(!!y.archived));
  }

  /** Their open deals with no project of the same name (portal client or CRM contact). */
  function dealsOf(client: string): DealRow[] {
    const contactId = client.startsWith('c:') ? client.slice(2)
      : client.startsWith('p:') ? data!.contacts.find((c) => c.portal_client_id === client.slice(2))?.id : undefined;
    if (!contactId) return [];
    const names = new Set(projectsOf(client).map((pr) => pr.name.trim().toLowerCase()));
    return (data!.deals ?? []).filter((d) => d.contact_id === contactId && d.title.trim() && !names.has(d.title.trim().toLowerCase()));
  }

  function pickClient(value: string, name: string) {
    // One active project (or, with none, one open deal): that's almost certainly the one.
    const projectsActive = projectsOf(value).filter((pr) => !pr.archived);
    const openDeals = dealsOf(value);
    const active = projectsActive.length ? projectsActive : openDeals.length === 1 && !projectsOf(value).length ? [{ name: openDeals[0].title }] : [];
    setProjectOther(false);
    setDraft((d) => ({
      ...d, client: value, clientName: name, number: d.mode === 'invoice' ? '' : d.number,
      title: !d.title.trim() && active.length === 1 ? active[0].name : d.title,
    }));
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

  /** Throws away the unsaved estimate or invoice (it was never saved or sent). */
  function discardDraft() {
    if (!window.confirm(`Delete this unsaved ${draft.mode}${draft.clientName ? ` for ${draft.clientName}` : ''}? It was never saved or sent.`)) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* private window */ }
    setFromEstimateId(null);
    setInvoiceWhen(null);
    setDraft(blankDraft(draft.mode));
    show(`Unsaved ${draft.mode} deleted.`);
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
    setFromDealId(est.crm_deal_id ?? null);
    setDraft({
      mode: 'invoice', client, clientName: est.client_name, title: est.title, number: '',
      // Tiers and extras (migration 061): the client's choice (or the first option, no extras).
      issueDate: t, dueDate: addDays(t, 14), text: lineItemsToText(selectLines(est.line_items, (est as { selection?: LineSelection | null }).selection ?? null)), notes: est.notes ?? '',
      totalsOnly: est.totals_only ?? false,
    });
    void fillInvoiceNumber(client);
    if (!portalIdOf(client)) show('Pick a client with a portal login to add this invoice to their portal.', 'error');
    setView('edit');
    scrollTop();
  }

  /** "Turn into proposal": the Thrive layout with this estimate's client and lines as its pricing. */
  async function proposalFromEstimate(est: Estimate) {
    const discounts = est.line_items.filter((l) => l.amount_cents < 0).map((l) => l.name);
    if (discounts.length && !window.confirm(`Proposals can’t show a discount line, so ${discounts.join(', ')} will be left out. Make the proposal anyway?`)) return;
    setBusy(true);
    try {
      const created = await apiSend<{ id: string }>('/api/proposals', 'POST', {
        title: est.title || (est.client_name ? `Proposal for ${est.client_name}` : 'Proposal'),
        fromEstimateId: est.id,
        starter: true,
      });
      router.push(`/admin/crm/proposals/${created.id}/edit`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not make the proposal', 'error');
      setBusy(false);
    }
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
    const what = depositCents
      ? `invoice ${draft.number} for ${formatLineMoney(total)}, with a ${formatLineMoney(depositCents)} deposit due ${formatDate(draft.depositDue ?? '')} (the rest stays locked until you open it),`
      : `invoice ${draft.number} for ${formatLineMoney(total)}`;
    const later = laterAt(invoiceWhen);
    if (later?.problem) { show(later.problem, 'error'); return; }
    if (!window.confirm(later
      ? `Schedule ${what} for ${draft.clientName || 'this client'}? It's added to their portal at ${formatWhen(later.iso)}, when they get an email (and a text if they've opted in). Until then they can't see it.`
      : `Add ${what} to ${draft.clientName || 'this client'}'s portal? They'll get an email (and a text if they've opted in).`)) return;
    setBusy(true);
    try {
      const params = {
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
        ...(depositCents ? { deposit_cents: depositCents, deposit_due_date: draft.depositDue } : {}),
        ...(fromEstimateId && fromDealId ? { crm_deal_id: fromDealId } : {}),
      };
      if (later) {
        await apiSend('/api/scheduled-sends', 'POST', {
          kind: 'invoice', label: `Invoice ${draft.number.trim()} for ${draft.clientName || 'a client'}`,
          payload: { params, from_estimate_id: fromEstimateId }, send_at: later.iso,
        });
        localStorage.removeItem(DRAFT_KEY);
        setFromEstimateId(null);
        setInvoiceWhen(null);
        setDraft(blankDraft('invoice'));
        setView('list');
        setTab('invoices');
        scrollTop();
        show(`Invoice ${draft.number.trim()}: ${scheduledFor(later.iso)}`);
        await load();
        setBusy(false);
        return;
      }
      const inv = await apiSend<InvoiceRow>('/api/admin', 'POST', params);
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
    deposit?: { cents: number; due: string; paidAt: string | null; balanceOpen: boolean } | null;
  }) {
    const { generateInvoicePDF } = await import('@/lib/invoicePDF');
    await generateInvoicePDF({
      kind: doc.kind, invoice_number: doc.number || 'DRAFT', project_name: doc.title, amount_cents: doc.total,
      invoice_date: doc.issue, due_date: doc.due, status: doc.status, line_items: doc.lines, notes: doc.notes,
      totals_only: doc.totalsOnly,
      ...(doc.deposit ? { deposit_cents: doc.deposit.cents, deposit_due_date: doc.deposit.due, deposit_paid_at: doc.deposit.paidAt, balance_open: doc.deposit.balanceOpen } : {}),
    }, doc.client || null);
  }

  const draftPdf = () => downloadPdf({ kind: draft.mode, number: draft.number, title: draft.title, total, issue: draft.issueDate, due: draft.dueDate, status: 'due', lines: items, notes: draft.notes || null, client: draft.clientName, totalsOnly: draft.totalsOnly,
    deposit: depositCents ? { cents: depositCents, due: draft.depositDue ?? '', paidAt: null, balanceOpen: false } : null });
  const estimatePdf = (est: Estimate) => downloadPdf({ kind: 'estimate', number: est.estimate_number, title: est.title, total: est.total_cents, issue: est.issue_date, due: est.valid_until ?? '', status: est.status, lines: est.line_items, notes: est.notes, client: est.client_name, totalsOnly: est.totals_only ?? false });

  /** Turns on the rest of a deposit invoice; the client is emailed (and texted if opted in). */
  async function openBalance() {
    if (!opening) return;
    setBusy(true);
    try {
      await apiSend('/api/admin', 'POST', { action: 'open_balance', id: opening.id, due_date: opening.due });
      setOpening(null);
      show('The balance is open and the client has been told.');
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not open the balance', 'error');
    }
    setBusy(false);
  }

  /** Cancels a scheduled send (or dismisses one that failed). */
  async function cancelScheduled(row: Scheduled) {
    const what = row.kind === 'invoice' ? `invoice ${row.invoice_number ?? ''}`.trim() : row.label || 'this send';
    if (row.status === 'scheduled' && !window.confirm(`Cancel the scheduled ${what}? Nothing is sent.`)) return;
    try {
      await apiSend(`/api/scheduled-sends?id=${row.id}`, 'DELETE');
      show(row.status === 'failed' ? 'Dismissed.' : 'Cancelled. Nothing was sent.');
      loadScheduled();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not cancel it', 'error');
    }
  }
  const scheduledFor_ = (kind: Scheduled['kind'], id: string) => scheduled.find((r) => r.kind === kind && r.target_id === id);

  /** Opens the Send dialog with their email filled in when it's on file. */
  async function startSend(est: Estimate) {
    setSending({ est, email: '', note: '', loading: true, when: null });
    try {
      const r = await apiGet<{ email: string }>(`/api/estimates/${est.id}/send`);
      setSending((cur) => (cur && cur.est.id === est.id ? { ...cur, email: cur.email || r.email, loading: false } : cur));
    } catch {
      setSending((cur) => (cur ? { ...cur, loading: false } : cur));
    }
  }

  /** Emails the estimate PDF (made here, exactly as the PDF button makes it). */
  async function sendEstimate() {
    if (!sending) return;
    const est = sending.est;
    setSending({ ...sending, loading: true });
    try {
      const { generateInvoicePDF } = await import('@/lib/invoicePDF');
      const pdf = await generateInvoicePDF({
        kind: 'estimate', invoice_number: est.estimate_number, project_name: est.title, amount_cents: est.total_cents,
        invoice_date: est.issue_date, due_date: est.valid_until ?? '', status: est.status, line_items: est.line_items,
        notes: est.notes, totals_only: est.totals_only ?? false,
      }, est.client_name || null, { output: 'base64' });
      const later = laterAt(sending.when);
      if (later) {
        if (later.problem) throw new Error(later.problem);
        await apiSend('/api/scheduled-sends', 'POST', {
          kind: 'estimate', target_id: est.id, label: `Estimate ${est.estimate_number} to ${sending.email}`,
          payload: { email: sending.email, note: sending.note, pdf }, send_at: later.iso,
        });
        setSending(null);
        show(`${est.estimate_number} to ${sending.email}: ${scheduledFor(later.iso)}`);
        await load();
        return;
      }
      await apiSend(`/api/estimates/${est.id}/send`, 'POST', { email: sending.email, note: sending.note, pdf });
      setSending(null);
      show(`${est.estimate_number} sent to ${sending.email}.`);
      await load();
    } catch (e) {
      setSending((cur) => (cur ? { ...cur, loading: false } : cur));
      show(e instanceof Error ? e.message : 'Could not send it', 'error');
    }
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
      if (editingId === est.id) { setEditingId(null); setDraft(storedDraft()); setView('list'); }
      await load();
      show(`Deleted ${est.estimate_number}.`);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  // An unpaid invoice can always be deleted (nothing paid on it: no deposit either).
  async function removeInvoice(inv: InvoiceRow) {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? It leaves the client’s portal too.`)) return;
    try {
      await apiSend('/api/admin', 'POST', { action: 'delete_invoice', id: inv.id });
      await load();
      show(`Deleted ${inv.invoice_number}.`);
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

  const blocks = lineBlocks(draft.text);

  /** Removes one item's lines, and its heading if nothing is left under it. */
  function removeBlock(b: LineBlock) {
    const lines = draft.text.split('\n');
    lines.splice(b.start, b.end - b.start + 1);
    // Drop headings left with no items, and doubled blank lines.
    const kept = lines.filter((l, i) => {
      if (!/^#+\s+/.test(l)) return true;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#+\s+/.test(lines[j])) return false;
        if (lines[j].trim() && !lines[j].trim().startsWith('//')) return true;
      }
      return false;
    });
    set('text', kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, ''));
  }

  /** "Show description" on one line: rewrites just that item's lines. */
  function toggleDescription(b: LineBlock) {
    if (!b.item) return;
    const lines = draft.text.split('\n');
    const next: LineItem = { ...b.item, hide_description: !b.item.hide_description };
    if (!next.hide_description) delete next.hide_description;
    lines.splice(b.start, b.end - b.start + 1, ...lineText(next).split('\n'));
    set('text', lines.join('\n'));
  }

  /** Optional (migration 061): an extra the client can tick — rewrites just that item's lines. */
  function toggleOptional(b: LineBlock) {
    if (!b.item) return;
    const lines = draft.text.split('\n');
    const next: LineItem = { ...b.item, optional: !b.item.optional };
    if (!next.optional) delete next.optional;
    lines.splice(b.start, b.end - b.start + 1, ...lineText(next).split('\n'));
    set('text', lines.join('\n'));
  }

  /** Tier (migration 061): which option a line belongs to (null = every option). Rewrites the list, keeping each tier's lines together. */
  function setBlockTier(b: LineBlock, tier: string | null) {
    const idx = blocks.filter((x) => x.item).indexOf(b);
    if (idx >= 0) set('text', setTierInText(draft.text, idx, tier));
  }

  /** "Extra page (x3)": changes the quantity of a per-unit price list item. */
  function setBlockQty(b: LineBlock, item: PriceItem, qty: number) {
    const lines = draft.text.split('\n');
    lines[b.start] = itemLine(item, Math.max(1, Math.min(999, qty)));
    set('text', lines.join('\n'));
  }

  function addCustom() {
    const price = custom.price.trim() || 'Included';
    const description = [custom.description.trim(), custom.monthly ? '/mo' : ''].filter(Boolean).join(' ');
    const line = [custom.name.trim(), description, price].filter(Boolean).join(' | ').replace(/\t/g, ' ');
    const parsed = parseLineItems(line);
    if (!custom.name.trim()) { setCustomError('Give it a name'); return; }
    if (custom.name.includes('|') || custom.description.includes('|')) { setCustomError('Leave out the | character'); return; }
    if (parsed.problems.length || !parsed.items.length) { setCustomError('Try a price like $500, 3h @ $45, -$100 or Included'); return; }
    const text = /^#+\s+/m.test(draft.text)
      ? insertUnderHeading(draft.text, 'Custom items', [line])
      : `${draft.text.replace(/\s+$/, '')}${draft.text.trim() ? '\n' : ''}${line}\n`;
    set('text', text);
    setCustom({ name: '', description: '', price: '', monthly: false });
    setCustomError('');
    show(`Added ${custom.name.trim()}.`);
  }

  const clientNameById = new Map(data.clients.map((c) => [c.id, clientLabel(c)]));
  const canSave = items.length > 0 && problems.length === 0 && missing.length === 0 && !depositProblem;
  const editingEstimate = editingId ? data.estimates.find((e) => e.id === editingId) : undefined;
  /** The proposal an estimate belongs to: its pricing is the source. */
  const proposalOf = (estId: string | undefined) => (estId ? data.proposalLinks?.find((l) => l.estimate_id === estId) : undefined);
  const linkedProposal = proposalOf(editingEstimate?.id);

  // ── List view ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    const q = query.trim().toLowerCase();
    const estimates = data.estimates.filter((e) => !q || `${e.estimate_number} ${e.client_name} ${e.title}`.toLowerCase().includes(q));
    const invoices = data.invoices.filter((i) => !q || `${i.invoice_number} ${clientNameById.get(i.client_id) ?? ''} ${i.project_name}`.toLowerCase().includes(q));
    const scheduledInvoices = scheduled.filter((r) => r.kind === 'invoice' && (!q || `${r.invoice_number ?? ''} ${(r.client_id && clientNameById.get(r.client_id)) || ''} ${r.project_name ?? ''}`.toLowerCase().includes(q)));
    const open = data.estimates.filter((e) => e.status === 'draft' || e.status === 'sent');
    const accepted = data.estimates.filter((e) => e.status === 'accepted');
    const unpaid = data.invoices.filter((i) => i.status !== 'paid');
    const overdue = unpaid.filter((i) => /overdue/i.test(invoiceState(i).label));
    const sumEst = (xs: Estimate[]) => xs.reduce((n, x) => n + x.total_cents, 0);
    // What's still owed (a paid deposit taken off).
    const sumInv = (xs: InvoiceRow[]) => xs.reduce((n, x) => n + remainingCents(x), 0);

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
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ background: '#fff', color: '#141414' }} onClick={discardDraft}>Delete</button>
              <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} onClick={continueDraft}>Continue</button>
            </span>
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
                        {proposalOf(est.id) && <span className={`${s.status} ${s.stDraft}`}>With a proposal</span>}
                        {(() => {
                          const sch = scheduledFor_('estimate', est.id);
                          return sch && <span className={`${s.status} ${sch.status === 'failed' ? s.stDeclined : s.stSent}`} title={sch.error ?? undefined}>
                            {sch.status === 'failed' ? 'Scheduled send failed' : `Sends ${formatWhen(sch.send_at)}`}
                          </span>;
                        })()}
                      </span>
                      <span className={s.docWho}>{est.client_name || 'No client'}</span>
                      <span className={s.docMeta}>{[est.title, formatDate(est.issue_date)].filter(Boolean).join(' · ')}</span>
                      {est.status === 'declined' && est.decline_reason && <span className={s.docMeta} style={{ color: '#e50586' }}>Declined{est.declined_by ? ` by ${est.declined_by}` : ''}: “{est.decline_reason}”</span>}
                    </button>
                    <span className={s.docAmount}>{formatLineMoney(est.total_cents)}</span>
                    <div className={s.docActions}>
                      {est.status !== 'invoiced' && (
                        <select className={s.statusSelect} value={est.status} aria-label={`Status of ${est.estimate_number}`}
                          onChange={(e) => setStatus(est, e.target.value as EstimateStatus)}>
                          {(['draft', 'sent', 'accepted', 'declined'] as const).map((v) => <option key={v} value={v}>{STATUS_STYLE[v].label}</option>)}
                        </select>
                      )}
                      {scheduledFor_('estimate', est.id) ? (
                        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => cancelScheduled(scheduledFor_('estimate', est.id)!)}>
                          {scheduledFor_('estimate', est.id)!.status === 'failed' ? 'Dismiss' : 'Cancel send'}
                        </button>
                      ) : (
                        <button type="button" className={`${p.btn} ${p.btnSmall} ${est.status === 'draft' ? p.btnPrimary : ''}`} onClick={() => startSend(est)}>
                          {est.status === 'draft' ? 'Send' : 'Send again'}
                        </button>
                      )}
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => estimatePdf(est)}>PDF</button>
                      {proposalOf(est.id) ? (
                        <Link href={`/admin/crm/proposals/${proposalOf(est.id)!.id}/edit`} className={`${p.btn} ${p.btnSmall}`}>Open proposal</Link>
                      ) : (
                        <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy} onClick={() => proposalFromEstimate(est)}>Proposal</button>
                      )}
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

        {tab === 'invoices' && scheduledInvoices.length > 0 && (
          <>
            <h2 className={s.listGroup}>Scheduled</h2>
            <ul className={s.docList} style={{ marginBottom: 18 }}>
              {scheduledInvoices.map((row) => (
                <li key={row.id} className={s.doc}>
                  <div className={s.docMain}>
                    <span className={s.docTop}>
                      <span className={s.docNumber}>{row.invoice_number ?? 'Invoice'}</span>
                      <span className={`${s.status} ${row.status === 'failed' ? s.stDeclined : s.stSent}`} title={row.error ?? undefined}>
                        {row.status === 'failed' ? 'Didn’t send' : row.status === 'sending' ? 'Sending' : `Sends ${formatWhen(row.send_at)}`}
                      </span>
                    </span>
                    <span className={s.docWho}>{(row.client_id && clientNameById.get(row.client_id)) || 'Client'}</span>
                    <span className={s.docMeta}>{row.status === 'failed' ? row.error : [row.project_name, 'not in their portal yet'].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className={s.docAmount}>{row.amount_cents != null ? formatLineMoney(row.amount_cents) : ''}</span>
                  <div className={s.docActions}>
                    {row.status !== 'sending' && (
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => cancelScheduled(row)}>{row.status === 'failed' ? 'Dismiss' : 'Cancel'}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
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
                      <span className={s.docMeta}>{[inv.project_name, invoiceMeta(inv), inv.accepted_at && !inv.declined_at && inv.status !== 'paid' ? `accepted ${formatDate(inv.accepted_at)}` : ''].filter(Boolean).join(' · ')}</span>
                      {inv.declined_at && <span className={s.docMeta} style={{ color: '#e50586' }}>Declined: “{inv.decline_reason}”. Reopen it from the client’s Client tab.</span>}
                    </Link>
                    <span className={s.docAmount}>{formatLineMoney(inv.amount_cents)}</span>
                    <div className={s.docActions}>
                      {dueNow(inv).kind === 'held' && (opening?.id === inv.id ? (
                        <span className={s.openBalance}>
                          <input type="date" className={p.input} aria-label="Balance due" value={opening.due}
                            onChange={(e) => setOpening({ id: inv.id, due: e.target.value })} />
                          <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={busy || !opening.due} onClick={openBalance}>Open</button>
                          <button type="button" className={s.iconBtn} aria-label="Cancel" onClick={() => setOpening(null)}>×</button>
                        </span>
                      ) : (
                        <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`}
                          onClick={() => setOpening({ id: inv.id, due: addDays(today(), 14) })}>Open balance</button>
                      ))}
                      <button type="button" className={`${p.btn} ${p.btnSmall}`}
                        onClick={() => downloadPdf({ kind: 'invoice', number: inv.invoice_number, title: inv.project_name, total: inv.amount_cents, issue: inv.invoice_date, due: inv.due_date, status: inv.status, lines: inv.line_items ?? [], notes: inv.notes ?? null, client, totalsOnly: inv.totals_only ?? false,
                          deposit: inv.deposit_cents ? { cents: inv.deposit_cents, due: inv.deposit_due_date ?? '', paidAt: inv.deposit_paid_at ?? null, balanceOpen: inv.balance_open !== false } : null })}>
                        PDF
                      </button>
                      {inv.status !== 'paid' && !inv.deposit_paid_at && (
                        <button type="button" className={s.iconBtn} aria-label={`Delete ${inv.invoice_number}`} title="Delete" onClick={() => removeInvoice(inv)}>×</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
        {tab === 'invoices' && invoices.length > 0 && <p className={s.listFoot}>The 30 most recent. Open a client to see all of theirs, record payments or send a reminder.</p>}
      {sending && (
        <SendDialog
          number={sending.est.estimate_number}
          email={sending.email}
          note={sending.note}
          loading={sending.loading}
          when={sending.when}
          onChange={(patch) => setSending((cur) => (cur ? { ...cur, ...patch } : cur))}
          onSend={sendEstimate}
          onClose={() => setSending(null)}
        />
      )}
        <Toast toast={toast} />
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  const heading = editingId ? `Edit ${draft.number}` : fromEstimateId ? 'Invoice from estimate' : `New ${isInvoice ? 'invoice' : 'estimate'}`;
  const primaryLabel = isInvoice
    ? (busy ? (invoiceWhen ? 'Scheduling…' : 'Sending…') : invoiceWhen ? 'Schedule' : 'Send to client portal')
    : (busy ? 'Saving…' : editingId ? (dirty ? 'Save changes' : 'Saved') : 'Save estimate');
  const primaryDisabled = isInvoice
    ? !canSave || !portalId || busy || !data.ready
    : !canSave || busy || !data.ready || (!!editingId && !dirty) || !!linkedProposal;
  const blocker = items.length === 0 ? 'Add at least one item'
    : problems.length ? `Fix line ${problems[0].line}`
    : missing.length ? `${missing[0].required.name} is required`
    : depositProblem ? depositProblem
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
          {linkedProposal && (
            <p className={s.proposalLink}>
              This is the estimate for the proposal <strong>{linkedProposal.title}</strong>. It’s rebuilt from the proposal’s pricing, so change prices there.
              {' '}<Link href={`/admin/crm/proposals/${linkedProposal.id}/edit`}>Open the proposal →</Link>
            </p>
          )}
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
              <ProjectField
                projects={projectsOf(draft.client)}
                deals={dealsOf(draft.client)}
                value={draft.title}
                other={projectOther}
                onOther={setProjectOther}
                onChange={(title) => set('title', title)}
              />
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
                <span className={p.label}>{isInvoice ? (isDepositOn(draft) ? 'Balance due' : 'Due') : 'Good until'}</span>
                <input type="date" className={p.input} value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
              </label>
            </div>
            <div className={s.quickDates}>
              {(isInvoice ? [['On receipt', 0], ['7 days', 7], ['14 days', 14], ['30 days', 30]] as const : [['14 days', 14], ['30 days', 30], ['60 days', 60]] as const).map(([label, days]) => (
                <button key={label} type="button" className={`${s.chip} ${draft.dueDate === addDays(draft.issueDate, days) ? s.chipOn : ''}`}
                  onClick={() => set('dueDate', addDays(draft.issueDate, days))}>{label}</button>
              ))}
            </div>
            {isInvoice && (
              <DepositFields draft={draft} total={total} depositCents={depositCents} problem={depositProblem}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
            )}
          </section>

          <section className={s.step}>
            <StepHead n={3} title="Items" hint="Choose from your price list. Need something that isn’t on it? Add a custom item." />

            {blocks.length === 0 && !textOpen ? (
              <div className={s.itemsEmpty}>
                <button type="button" className={`${p.btn} ${p.btnPrimary} ${s.bigBtn}`} disabled={!catalog} onClick={() => setDrawer(true)}
                  title={catalog ? undefined : 'Run migration 047 to use the price list'}>
                  Choose from price list
                </button>
                {!customOpen && <button type="button" className={s.textLink} onClick={() => setCustomOpen(true)}>or add a custom item</button>}
              </div>
            ) : (
              <>
                {!isInvoice && (
                  <TierBar items={items} extra={newTiers} onAdd={(t) => setNewTiers((cur) => (cur.includes(t) ? cur : [...cur, t]))} />
                )}
                <ItemRows blocks={blocks} catalog={catalog} onRemove={removeBlock} onQty={setBlockQty} onToggleDescription={toggleDescription}
                  choices={isInvoice ? undefined : { tiers: [...new Set([...tiersOf(items), ...newTiers])], onTier: setBlockTier, onOptional: toggleOptional }} />
                <div className={s.itemsTools}>
                  <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!catalog} onClick={() => setDrawer(true)}
                    title={catalog ? undefined : 'Run migration 047 to use the price list'}>
                    + Add from price list
                  </button>
                  {!customOpen && <button type="button" className={p.btn} onClick={() => setCustomOpen(true)}>+ Custom item</button>}
                </div>
              </>
            )}

            {problems.length > 0 && (
              <div className={s.problems}>
                {problems.map((pr) => <p key={pr.line}>Line {pr.line}: {pr.message}</p>)}
                {!textOpen && <button type="button" className={s.textLink} onClick={() => setTextOpen(true)}>Fix it in the text</button>}
              </div>
            )}

            {customOpen && (
              <div className={s.customForm}>
                <div className={s.customHead}>
                  <strong>Custom item</strong>
                  <button type="button" className={s.iconBtn} aria-label="Close custom item" onClick={() => { setCustomOpen(false); setCustomError(''); }}>×</button>
                </div>
                <div className={s.customFields}>
                  <label className={s.wide}>
                    <span className={p.label}>Name</span>
                    <input className={p.input} value={custom.name} autoFocus placeholder="e.g. Event signage"
                      onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
                  </label>
                  <label className={s.wide}>
                    <span className={p.label}>Description (optional)</span>
                    <input className={p.input} value={custom.description} placeholder="What’s included"
                      onChange={(e) => setCustom((c) => ({ ...c, description: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
                  </label>
                  <label>
                    <span className={p.label}>Price</span>
                    <input className={p.input} value={custom.price} placeholder="$250, 3h @ $45, Included" inputMode="text"
                      onChange={(e) => setCustom((c) => ({ ...c, price: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
                  </label>
                  <label className={s.monthlyCheck}>
                    <input type="checkbox" checked={custom.monthly} onChange={(e) => setCustom((c) => ({ ...c, monthly: e.target.checked }))} />
                    Monthly
                  </label>
                </div>
                {customError && <p className={s.warn}>{customError}</p>}
                <div className={s.customActions}>
                  <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={addCustom}>Add item</button>
                  <button type="button" className={s.textLink} aria-expanded={textOpen} onClick={() => setTextOpen((v) => !v)}>
                    {textOpen ? 'Hide the text editor' : 'Or edit the whole list as text'}
                  </button>
                </div>
              </div>
            )}

            {textOpen && (
              <div className={s.textEditor}>
                <div className={s.customHead}>
                  <strong>Edit as text</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-expanded={tipsOpen} onClick={() => setTipsOpen((v) => !v)}>
                      {tipsOpen ? 'Hide tips' : 'Tips'}
                    </button>
                    <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setTextOpen(false)}>Done</button>
                  </div>
                </div>
                {tipsOpen && (
                  <ul className={s.tips}>
                    <li><code>Item | description | $price</code>, one per line</li>
                    <li><code>| 3h @ $100</code> multiplies; <code>| 3h | $300</code> is a flat price with the hours shown</li>
                    <li>A line starting with <code>-</code> adds to the description above</li>
                    <li><code>Included</code> for $0, <code>-$100</code> for a discount</li>
                    <li><code># Website</code> starts a group, for the category totals</li>
                    <li>A description ending in <code>/mo</code> is monthly; starting it with <code>~</code> hides it from the client</li>
                    <li>Pasting from a spreadsheet works too</li>
                  </ul>
                )}
                <textarea aria-label="Items as text" className={`${p.textarea} ${s.items}`} value={draft.text} spellCheck={false}
                  onChange={(e) => set('text', e.target.value)} placeholder={EXAMPLE} />
              </div>
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
            {isInvoice && !editingId && (
              <div style={{ display: 'grid', gap: 6, marginTop: 16 }}>
                <span className={p.label}>When it goes to their portal</span>
                <SendLater when={invoiceWhen} onChange={setInvoiceWhen} disabled={busy} />
                {invoiceWhen && <span className={w.muted} style={{ fontSize: 12.5 }}>The invoice is created at that time, so they can’t see it before then. It waits under Scheduled on the Invoices tab, where you can cancel it.</span>}
              </div>
            )}
            {editingEstimate && (
              <div className={s.finishLinks}>
                {linkedProposal ? (
                  <Link href={`/admin/crm/proposals/${linkedProposal.id}/edit`} className={`${p.btn} ${p.btnSmall}`}>Open the proposal</Link>
                ) : (
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={dirty || busy} title={dirty ? 'Save your changes first' : undefined}
                    onClick={() => proposalFromEstimate(editingEstimate)}>Turn into proposal</button>
                )}
                {editingEstimate.status !== 'invoiced' && <>
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={dirty} title={dirty ? 'Save your changes first' : undefined}
                    onClick={() => invoiceFromEstimate(editingEstimate)}>Turn into invoice</button>
                  <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => remove(editingEstimate)}>Delete estimate</button>
                </>}
              </div>
            )}
          </section>
        </div>

        <aside className={s.previewCol}>
          <Preview draft={draft} items={items} total={total} depositCents={depositCents} />
        </aside>
      </div>

      <div className={s.bar}>
        <div className={s.barTotal}>
          <span className={s.barLabel}>{isInvoice ? 'Total due' : split.monthly && split.oneTime ? 'One-time + monthly' : 'Estimate total'}</span>
          <span className={s.barValue}>
            {isInvoice || !split.monthly ? formatLineMoney(total) : amountText(split.oneTime, split.monthly)}
          </span>
          <span className={s.barMeta}>{blocker || `${items.length} item${items.length === 1 ? '' : 's'}${depositCents ? ` · ${formatLineMoney(depositCents)} deposit first` : ''}${isInvoice && split.monthly ? ` · first month of ${formatLineMoney(split.monthly)}/mo included` : ''}`}</span>
        </div>
        <div className={s.barActions}>
          <button type="button" className={`${p.btn} ${s.previewBtn}`} onClick={() => setPreviewOpen(true)}>Preview</button>
          <button type="button" className={p.btn} disabled={!canSave} onClick={draftPdf}>PDF</button>
          {!isInvoice && editingEstimate && !dirty ? (
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => startSend(editingEstimate)}>
              {editingEstimate.status === 'draft' ? 'Send to client' : 'Send again'}
            </button>
          ) : (
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={primaryDisabled}
              onClick={isInvoice ? addToPortal : saveEstimate}>{primaryLabel}</button>
          )}
        </div>
      </div>

      {previewOpen && (
        <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Preview">
          <div className={s.sheetHead}>
            <strong>Preview</strong>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setPreviewOpen(false)}>Done</button>
          </div>
          <Preview draft={draft} items={items} total={total} depositCents={depositCents} />
        </div>
      )}
      {sending && (
        <SendDialog
          number={sending.est.estimate_number}
          email={sending.email}
          note={sending.note}
          loading={sending.loading}
          when={sending.when}
          onChange={(patch) => setSending((cur) => (cur ? { ...cur, ...patch } : cur))}
          onSend={sendEstimate}
          onClose={() => setSending(null)}
        />
      )}
      {drawer && catalog && <PriceListDrawer catalog={catalog} onInsert={insertItems} onClose={() => setDrawer(false)} />}
      <div className={s.toastLift}><Toast toast={toast} /></div>
    </div>
  );
}

/** The items as rows, grouped by category: quantity for per-unit price list items, and remove. */
function ItemRows({ blocks, catalog, onRemove, onQty, onToggleDescription, choices }: {
  blocks: LineBlock[]; catalog: Catalog | null;
  onRemove: (b: LineBlock) => void; onQty: (b: LineBlock, item: PriceItem, qty: number) => void;
  onToggleDescription: (b: LineBlock) => void;
  /** Estimates (migration 061): each line's tier and whether it's optional. */
  choices?: { tiers: string[]; onTier: (b: LineBlock, tier: string | null) => void; onOptional: (b: LineBlock) => void };
}) {
  const valid = blocks.filter((b): b is LineBlock & { item: LineItem } => b.item !== null);
  const names = valid.map((b) => b.item.name);
  const present = catalog ? names.map((n) => itemForLine(catalog.items, n)).filter((i): i is PriceItem => !!i) : [];
  /** "Required with Mobile App (MVP)" when another item on the list needs this one. */
  const requiredBy = (item: PriceItem | undefined) => {
    if (!catalog || !item) return '';
    const rule = catalog.rules.find((r) => r.rule_type === 'requires' && r.related_item_id === item.id && present.some((x) => x.id === r.item_id));
    return rule ? catalog.items.find((i) => i.id === rule.item_id)?.name ?? '' : '';
  };
  const groups = categoryTotals(valid.map((b) => b.item));
  const headed = valid.some((b) => b.item.category?.trim());
  return (
    <div className={s.rows}>
      {groups.map((g) => (
        <div key={g.category} className={s.rowGroup}>
          {headed && (
            <div className={s.rowGroupHead}>
              <span>{g.category}</span>
              {/* With tiers or extras a category's sum would mix options: the Tiers box has the totals. */}
              {!(choices && hasChoices(valid.map((b) => b.item))) && <span>{amountText(g.oneTime, g.monthly)}</span>}
            </div>
          )}
          {valid.filter((b) => (b.item.category?.trim() || 'Other') === g.category).map((b) => {
            const cat = catalog ? itemForLine(catalog.items, b.item.name) : undefined;
            const qty = Number(b.item.name.match(/\(x(\d+)\)/i)?.[1] ?? 1);
            const lockedBy = requiredBy(cat);
            const optional = !!b.item.optional;
            const name = b.item.name.replace(/\s*\(x\d+\)/i, '').replace(/\s*\(optional\)\s*$/i, '');
            return (
              <div key={b.start} className={s.itemRow}>
                <div className={s.itemRowMain}>
                  <span className={s.itemRowName}>
                    {name}
                    {optional && <span className={s.badgeOptional}>Optional</span>}
                    {b.item.tier && <span className={s.badgeTier}>{b.item.tier}</span>}
                    {!cat && <span className={s.badgeCustom}>Custom</span>}
                    {b.item.percent ? <span className={s.badgePercent}>{b.item.percent}% off</span> : null}
                  </span>
                  {b.item.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '') && (
                    <>
                      <span className={`${s.itemRowDesc} ${b.item.hide_description ? s.descHidden : ''}`}>
                        {b.item.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}
                      </span>
                      <label className={s.descSwitch}>
                        <input type="checkbox" role="switch" className={s.switchSm} checked={!b.item.hide_description}
                          onChange={() => onToggleDescription(b)} />
                        {b.item.hide_description ? 'Description hidden from client' : 'Show description'}
                      </label>
                    </>
                  )}
                  {lockedBy && <span className={s.itemRowLock}>Required with {lockedBy}</span>}
                  {choices && !b.item.percent && (
                    <span className={s.choiceControls}>
                      {choices.tiers.length > 0 && (
                        <select className={s.tierSelect} value={b.item.tier ?? ''} aria-label={`Tier for ${name}`}
                          onChange={(e) => choices.onTier(b, e.target.value || null)}>
                          <option value="">Every option</option>
                          {choices.tiers.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                      <label className={s.optionalTick}>
                        <input type="checkbox" checked={optional} onChange={() => choices.onOptional(b)} />
                        Optional
                      </label>
                    </span>
                  )}
                </div>
                {cat?.unit && cat.price_type !== 'hourly' ? (
                  <div className={s.stepper} role="group" aria-label={`How many ${cat.unit}s`}>
                    <button type="button" aria-label="One fewer" disabled={qty <= 1} onClick={() => onQty(b, cat, qty - 1)}>−</button>
                    <span>{qty}</span>
                    <button type="button" aria-label="One more" onClick={() => onQty(b, cat, qty + 1)}>+</button>
                  </div>
                ) : <span />}
                <span className={s.itemRowAmount}>
                  {isMonthly(b.item) ? amountText(0, b.item.amount_cents) : amountText(b.item.amount_cents, 0)}
                </span>
                <button type="button" className={s.iconBtn} aria-label={`Remove ${name}`} disabled={!!lockedBy}
                  title={lockedBy ? `Required with ${lockedBy}` : 'Remove'} onClick={() => onRemove(b)}>×</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Tiers (migration 061): each option's total, and a box to name a new one.
 * Lines join a tier from their row's menu; the client picks one tier.
 */
function TierBar({ items, extra, onAdd }: { items: LineItem[]; extra: string[]; onAdd: (tier: string) => void }) {
  const [name, setName] = useState('');
  const tiers = [...new Set([...tiersOf(items), ...extra])];
  const add = () => { const t = name.trim().slice(0, 80); if (t && !/^(none|all|shared)$/i.test(t)) { onAdd(t); setName(''); } };
  return (
    <div className={s.tierBar}>
      <div className={s.tierBarHead}>
        <strong>Tiers</strong>
        <span className={s.tierHint}>
          {tiers.length
            ? 'The client picks one option when they accept. Use the menu under each line to put it in a tier (“Every option” = included in all). Tick Optional for extras they can add.'
            : 'Offer options (e.g. Template store / Custom store): name a tier, then pick it from the menu under each line.'}
        </span>
      </div>
      {tiers.length > 0 && (
        <ul className={s.tierList}>
          {tiers.map((t, i) => (
            <li key={t}><span>Option {i + 1}: {t}</span><strong>{items.some((it) => it.tier === t) ? formatLineMoney(tierTotal(items, t)) : 'no lines yet'}</strong></li>
          ))}
        </ul>
      )}
      {hasChoices(items) && <p className={s.tierHint}>The estimate total shows the first option with no extras until the client chooses.</p>}
      <div className={s.tierAdd}>
        <input className={p.input} value={name} placeholder="New tier, e.g. Custom store" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className={p.btn} onClick={add} disabled={!name.trim()}>Add tier</button>
      </div>
    </div>
  );
}

/**
 * Project: a dropdown of the client's portal projects (an invoice filed under
 * a project's name joins that project's deal), or a typed name for anyone
 * else and for "Something else…".
 */
function ProjectField({ projects, deals, value, other, onOther, onChange }: {
  projects: ProjectRow[]; deals: DealRow[]; value: string; other: boolean;
  onOther: (v: boolean) => void; onChange: (title: string) => void;
}) {
  const choices = projects.length + deals.length;
  const known = projects.some((pr) => pr.name === value) || deals.some((d) => d.title === value);
  const typing = choices === 0 || other || (value.trim() !== '' && !known);
  const active = projects.filter((pr) => !pr.archived);
  const finished = projects.filter((pr) => pr.archived);
  return (
    <label className={s.wide}>
      <span className={p.label}>Project</span>
      {choices > 0 && (
        <select className={p.select} value={typing ? '__other' : value}
          onChange={(e) => {
            if (e.target.value === '__other') { onOther(true); onChange(''); return; }
            onOther(false);
            onChange(e.target.value);
          }}>
          <option value="">Choose a project…</option>
          {active.length > 0 && (
            <optgroup label="Projects">
              {active.map((pr) => <option key={pr.id} value={pr.name}>{pr.name}</option>)}
            </optgroup>
          )}
          {deals.length > 0 && (
            <optgroup label="Deals on your pipeline">
              {deals.map((d) => <option key={d.id} value={d.title}>{d.title}</option>)}
            </optgroup>
          )}
          {finished.length > 0 && (
            <optgroup label="Finished">
              {finished.map((pr) => <option key={pr.id} value={pr.name}>{pr.name}</option>)}
            </optgroup>
          )}
          <option value="__other">Something else…</option>
        </select>
      )}
      {typing && (
        <input className={p.input} style={choices ? { marginTop: 8 } : undefined} value={value} autoFocus={other && !value}
          onChange={(e) => onChange(e.target.value)} placeholder={choices ? 'Name it' : 'Website redesign'} />
      )}
    </label>
  );
}

const isDepositOn = (d: Draft) => d.mode === 'invoice' && !!d.depositOn;

/** The deposit in cents: a percent of the total, or a dollar amount. */
function depositFor(d: Draft, total: number): number {
  const v = Number.parseFloat((d.depositValue ?? '').replace(/[$,%\s]/g, ''));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return d.depositMode === 'amount' ? Math.round(v * 100) : Math.round((total * Math.min(v, 100)) / 100);
}

/** Invoices: "Ask for a deposit first" — amount, its date, and what happens to the rest. */
function DepositFields({ draft, total, depositCents, problem, onChange }: {
  draft: Draft; total: number; depositCents: number; problem: string; onChange: (patch: Partial<Draft>) => void;
}) {
  const on = !!draft.depositOn;
  return (
    <div className={s.deposit}>
      <label className={s.switchRow}>
        <span className={s.switchText}>
          <strong>Ask for a deposit first</strong>
          <small>The client pays the deposit now. The rest stays locked in their portal until you open it.</small>
        </span>
        <input type="checkbox" role="switch" className={s.switch} checked={on} onChange={(e) => onChange({ depositOn: e.target.checked })} />
      </label>
      {on && (
        <div className={s.depositFields}>
          <div className={s.quickDates}>
            {['25', '50'].map((pct) => (
              <button key={pct} type="button" className={`${s.chip} ${draft.depositMode !== 'amount' && draft.depositValue === pct ? s.chipOn : ''}`}
                onClick={() => onChange({ depositMode: 'percent', depositValue: pct })}>{pct}%</button>
            ))}
            <span className={s.depositAmount}>
              <input className={p.input} inputMode="decimal" aria-label="Deposit amount" value={draft.depositValue ?? ''}
                onChange={(e) => onChange({ depositValue: e.target.value })} />
              <select className={p.select} aria-label="Percent or dollars" value={draft.depositMode ?? 'percent'}
                onChange={(e) => onChange({ depositMode: e.target.value as 'percent' | 'amount' })}>
                <option value="percent">%</option>
                <option value="amount">$</option>
              </select>
            </span>
          </div>
          <label>
            <span className={p.label}>Deposit due</span>
            <input type="date" className={p.input} value={draft.depositDue ?? ''} onChange={(e) => onChange({ depositDue: e.target.value })} />
          </label>
          <div className={s.quickDates}>
            {([['On receipt', 0], ['7 days', 7], ['14 days', 14]] as const).map(([label, days]) => (
              <button key={label} type="button" className={`${s.chip} ${draft.depositDue === addDays(draft.issueDate, days) ? s.chipOn : ''}`}
                onClick={() => onChange({ depositDue: addDays(draft.issueDate, days) })}>{label}</button>
            ))}
          </div>
          {total > 0 && !problem && (
            <p className={s.depositSum}>
              <strong>{formatLineMoney(depositCents)}</strong> deposit now · <strong>{formatLineMoney(total - depositCents)}</strong> when you open the balance
            </p>
          )}
          {problem && total > 0 && <p className={s.warn}>{problem}</p>}
        </div>
      )}
    </div>
  );
}

/** "Send estimate": to whom, an optional note, and Send. The PDF goes attached. */
function SendDialog({ number, email, note, loading, when, onChange, onSend, onClose }: {
  number: string; email: string; note: string; loading: boolean; when: string | null;
  onChange: (patch: { email?: string; note?: string; when?: string | null }) => void; onSend: () => void; onClose: () => void;
}) {
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  return (
    <div className={s.drawerBackdrop} style={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className={s.sendDialog} role="dialog" aria-modal="true" aria-labelledby="send-title">
        <h2 id="send-title" className={s.drawerTitle}>Send {number}</h2>
        <p className={s.stepHint}>They get a short email with the estimate attached as a PDF. It’s marked Sent and logged on their timeline.</p>
        <label>
          <span className={p.label}>To</span>
          <input className={p.input} type="email" value={email} placeholder={loading ? 'Looking up their email…' : 'name@business.com'}
            onChange={(e) => onChange({ email: e.target.value })} autoFocus />
        </label>
        <label>
          <span className={p.label}>Note (optional)</span>
          <textarea className={p.textarea} rows={3} value={note} placeholder="A line from you, e.g. Let me know if you have any questions."
            onChange={(e) => onChange({ note: e.target.value })} />
        </label>
        <SendLater when={when} onChange={(v) => onChange({ when: v })} disabled={loading} />
        <div className={s.sendActions}>
          <button type="button" className={p.btn} onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!valid || loading} onClick={onSend}>
            {loading ? (when ? 'Scheduling…' : 'Sending…') : when ? 'Schedule' : 'Send estimate'}
          </button>
        </div>
      </div>
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

function Preview({ draft, items, total, depositCents }: { draft: Draft; items: LineItem[]; total: number; depositCents: number }) {
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
        <p className={s.paperFlag}>Totals only: categories with two or more items show as one subtotal. The client doesn’t see what’s in grey.</p>
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
          ) : !isInvoice && hasChoices(items) ? (() => {
            // Tiers and extras (migration 061), as the client sees them: the items, then each option's total, then the extras.
            const tiers = tiersOf(items);
            const line = (it: LineItem, i: number) => (
              <tr key={`${it.name}-${i}`}>
                <td>
                  <div className={s.lineName}>{it.name}{it.tier ? <span className={s.badgeTier}>{it.tier}</span> : null}{it.optional ? ' (optional)' : ''}</div>
                  {it.description && (
                    <div className={`${s.lineDesc} ${it.hide_description ? s.dimmed : ''}`}>{it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}</div>
                  )}
                </td>
                {showHours && <td className={s.num}>{it.hours ?? ''}</td>}
                <td className={s.num} style={{ fontWeight: 700 }}>
                  {isMonthly(it) ? amountText(0, it.amount_cents) : amountText(it.amount_cents, 0)}
                </td>
              </tr>
            );
            return (
              <>
                {items.filter((it) => !it.optional).map(line)}
                {tiers.length > 0 && (
                  <tr className={s.catRow}><td colSpan={showHours ? 3 : 2}>Choose one option</td></tr>
                )}
                {tiers.map((t, n) => (
                  <tr key={t}>
                    <td colSpan={showHours ? 2 : 1}><div className={s.lineName}>Option {n + 1}: {t}</div></td>
                    <td className={s.num} style={{ fontWeight: 700 }}>{formatLineMoney(tierTotal(items, t))}</td>
                  </tr>
                ))}
                {items.some((it) => it.optional) && (
                  <tr className={s.catRow}><td colSpan={showHours ? 3 : 2}>Optional extras — the client can tick these</td></tr>
                )}
                {items.filter((it) => it.optional).map(line)}
              </>
            );
          })() : groups.map((g) => {
            // What the client sees with Totals only: a category with two or more
            // lines collapses to its subtotal; a lone or uncategorised line keeps its name.
            const collapsed = draft.totalsOnly && g.items.length > 1 && g.items.some((it) => it.category?.trim());
            return (
            <Fragment key={g.category}>
              {(collapsed || (grouped && !draft.totalsOnly && g.items.some((it) => it.category?.trim()))) && (
                <tr className={s.catRow}>
                  <td colSpan={showHours ? 2 : 1}>{g.category}</td>
                  <td className={s.num}>{amountText(g.oneTime, g.monthly)}</td>
                </tr>
              )}
              {g.items.map((it, i) => (
                <tr key={i} className={collapsed ? s.dimmed : undefined}>
                  <td>
                    <div className={s.lineName}>{it.name}</div>
                    {it.description && (
                      <div className={`${s.lineDesc} ${it.hide_description ? s.dimmed : ''}`}>{it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}</div>
                    )}
                  </td>
                  {showHours && <td className={s.num}>{it.hours ?? ''}</td>}
                  <td className={s.num} style={{ fontWeight: 700 }}>
                    {isMonthly(it) ? amountText(0, it.amount_cents) : amountText(it.amount_cents, 0)}
                  </td>
                </tr>
              ))}
            </Fragment>
            );
          })}
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
          <span className={s.totalLabel}>{isInvoice ? 'TOTAL DUE' : hasChoices(items) ? `ESTIMATE TOTAL${tiersOf(items)[0] ? ` — ${tiersOf(items)[0].toUpperCase()}` : ''}, NO EXTRAS` : 'ESTIMATE TOTAL'}</span>
          <span className={s.totalValue}>{formatLineMoney(total)}</span>
        </div>
      )}
      {isInvoice && depositCents > 0 && (
        <div className={s.depositBox}>
          <div><span>Deposit due {formatDate(draft.depositDue ?? '')}</span><strong>{formatLineMoney(depositCents)}</strong></div>
          <div><span>Balance, due when we let you know</span><strong>{formatLineMoney(total - depositCents)}</strong></div>
        </div>
      )}
      {isInvoice && split.monthly !== 0 && (
        <p className={s.paperNotes}>Includes the first month of monthly services ({formatLineMoney(split.monthly)}/mo).</p>
      )}

      {draft.notes.trim() && <p className={s.paperNotes}>{draft.notes.trim()}</p>}
    </section>
  );
}
