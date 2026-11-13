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
import { depositPercentFromTerms, hasRange, rangeLines, rangeText, rangeTotals, setPhaseTimelineInText, addToGroupInText, amountText, categoryTotals, formatLineMoney, groupedText, hasChoices, isMonthly, isPhased, lineBlocks, lineItemsToText, lineText, parseLineItems, phaseLines, phaseTermsNote, phasesOf, selectLines, setPhaseInText, setPhaseTermsInText, setTierInText, splitTotals, tierTotal, tiersOf, totalCents, type LineBlock, type LineItem, type LineSelection } from '@/lib/lineItems';
import type { Estimate, EstimateStatus } from '@/lib/estimates';
import { isScopeWork, needsWorkDescription, scopeWorkProblem } from '@/lib/scopeWork';
import { estimateTermsLine } from '@/lib/invoicePDF';
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
interface BillingData { ready: boolean; estimates: Estimate[]; invoices: InvoiceRow[]; clients: PortalClient[]; contacts: Contact[]; projects?: ProjectRow[]; deals?: DealRow[]; proposalLinks?: { id: string; title: string; estimate_id: string; deposit_percent?: number | null }[] }

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
  /** An estimate's deposit to start, as a percent ('' = invoiced in full; migration 064). */
  estDeposit?: string;
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
  /** List · Tiers · Phases, while no line is in a tier or phase yet (after that the lines decide). */
  const [chosenMode, setChosenMode] = useState<PriceMode>('list');
  /** Where "+ From price list" / "+ Custom item" adds: a tier or phase card (null = the plain list). */
  const [target, setTarget] = useState<Group | null>(null);
  const [groupDraft, setGroupDraft] = useState({ name: '', terms: '' });
  /** Phases named in the bar but not given any items yet (migration 062). */
  const [newPhases, setNewPhases] = useState<{ name: string; terms: string; timeline?: string }[]>([]);
  /** A new estimate made from a phased one's phases: saving links it back there and files it under that deal. */
  const [fromPhases, setFromPhases] = useState<{ estimate_id: string; estimate_number: string; phases: string[]; crm_deal_id: string | null } | null>(null);

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
            estDeposit: linked.deposit_percent ? String(Number(linked.deposit_percent)) : '',
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
  // …and phases (migration 062) only on an estimate: an invoice is one bill.
  const items: LineItem[] = draft.mode === 'invoice' ? parsedLines.items.map(({ optional: _o, phase: _p, phase_terms: _t, phase_timeline: _l, ...it }) => { void _o; void _p; void _t; void _l; return it; }) : parsedLines.items;
  // Out-of-scope work always says what the work is, on paper (src/lib/scopeWork.ts).
  const problems = [
    ...parsedLines.problems,
    ...lineBlocks(draft.text).flatMap((b) => {
      const message = b.item ? scopeWorkProblem(b.item) : null;
      return message ? [{ line: b.start + 1, message }] : [];
    }),
  ];
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
    setFromPhases(null);
    setNewPhases([]);
    setNewTiers([]);
    setChosenMode('list');
    setTarget(null);
    setDraft(blankDraft(mode));
    setView('edit');
    scrollTop();
  }

  /** Throws away the unsaved estimate or invoice (it was never saved or sent). */
  function discardDraft() {
    if (!window.confirm(`Delete this unsaved ${draft.mode}${draft.clientName ? ` for ${draft.clientName}` : ''}? It was never saved or sent.`)) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* private window */ }
    setFromEstimateId(null);
    setFromPhases(null);
    setNewPhases([]);
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
      estDeposit: est.deposit_percent ? String(Number(est.deposit_percent)) : '',
    };
    setEditingId(est.id);
    setFromEstimateId(null);
    setNewPhases([]);
    setNewTiers([]);
    setChosenMode('list');
    setTarget(null);
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
      // The estimate's payment terms carry over: just the deposit now (migration 064).
      ...(est.deposit_percent && Number(est.deposit_percent) > 0 && Number(est.deposit_percent) < 100
        ? { depositOn: true, depositMode: 'percent' as const, depositValue: String(Number(est.deposit_percent)), depositDue: t } : {}),
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
      deposit_percent: (() => { const n = Number.parseFloat(draft.estDeposit ?? ''); return n > 0 && n < 100 ? n : null; })(),
      // Made from a phased estimate's phases (migration 062): its deal, and the link back.
      ...(!editingId && fromPhases ? { crm_deal_id: fromPhases.crm_deal_id, from_phases: { estimate_id: fromPhases.estimate_id, phases: fromPhases.phases } } : {}),
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
      setFromPhases(null);
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

  // List · Tiers · Phases (migration 061/062): the lines decide once they're grouped.
  const priceMode: PriceMode = isPhased(items) ? 'phases' : tiersOf(items).length ? 'tiers' : chosenMode;
  const tierNames = [...new Set([...tiersOf(items), ...newTiers])];
  const phaseList: { name: string; terms: string; timeline?: string }[] = [...phasesOf(items).map((ph) => ({ name: ph.name, terms: ph.terms, timeline: ph.timeline })), ...newPhases.filter((x) => !items.some((it) => it.phase === x.name))];
  const groups: Group[] = priceMode === 'list' ? []
    : priceMode === 'tiers' ? [{ kind: 'shared', name: '' }, ...tierNames.map((name) => ({ kind: 'tier' as const, name }))]
    : [...phaseList.map((ph) => ({ kind: 'phase' as const, name: ph.name })), ...(items.some((it) => !it.phase) ? [{ kind: 'loose' as const, name: '' }] : [])];
  const inGroup = (g: Group, it: LineItem) =>
    g.kind === 'shared' ? !it.tier : g.kind === 'tier' ? it.tier === g.name : g.kind === 'loose' ? !it.phase : it.phase === g.name;
  const tagOf = (g: Group | null) =>
    g?.kind === 'tier' ? { tier: g.name } : g?.kind === 'phase' ? {
      phase: g.name,
      phase_terms: phaseList.find((x) => x.name === g.name)?.terms || undefined,
      phase_timeline: phaseList.find((x) => x.name === g.name)?.timeline || undefined,
    } : {};
  const groupLabel = (g: Group) => g.kind === 'shared' ? 'Every option' : g.kind === 'tier' ? g.name : g.kind === 'phase' ? g.name : 'Not in a phase';

  /** Adds catalog items (and anything they require): under their category headings, into the card they were added from. */
  function insertItems(picks: Pick[], into: Group | null = target) {
    if (!catalog) return;
    const added: string[] = [];
    let text = draft.text;
    if (!into || isInvoice) {
      const byCategory = new Map<string, string[]>();
      for (const { item, qty } of picks) {
        const cat = categoryName(item);
        byCategory.set(cat, [...(byCategory.get(cat) ?? []), itemLine(item, qty)]);
      }
      for (const [cat, lines] of byCategory) text = insertUnderHeading(text, cat, lines);
      for (const { item, required } of missingRequired(catalog, parseLineItems(text).items.map((it) => it.name))) {
        text = insertUnderHeading(text, categoryName(required), [itemLine(required)]);
        added.push(`${required.name} added: required with ${item.name}`);
      }
    } else {
      const asItem = (item: PriceItem, qty = 1) => ({ ...parseLineItems(itemLine(item, qty)).items[0], category: categoryName(item) });
      const fresh = picks.map(({ item, qty }) => asItem(item, qty)).filter((x) => x.name);
      const names = [...items.map((it) => it.name), ...fresh.map((x) => x.name)];
      for (const { item, required } of missingRequired(catalog, names)) {
        fresh.push(asItem(required));
        added.push(`${required.name} added: required with ${item.name}`);
      }
      text = addToGroupInText(text, fresh, tagOf(into));
    }
    set('text', text);
    setDrawer(false);
    show(added.length ? added.join('. ') : `Added ${picks.length} item${picks.length === 1 ? '' : 's'}${into && !isInvoice ? ` to ${groupLabel(into)}` : ''}.`);
  }

  /** List · Tiers · Phases. Tiers and phases swap one for one; the list takes every line out of its group. */
  function switchPriceMode(next: PriceMode) {
    if (next === priceMode) return;
    const strip = (it: LineItem): LineItem => { const n = { ...it }; delete n.tier; delete n.phase; delete n.phase_terms; delete n.phase_timeline; return n; };
    if (next === 'list') {
      if (items.some((it) => it.tier || it.phase) && !window.confirm(`Take every item out of its ${priceMode === 'tiers' ? 'tier' : 'phase'}? The items stay, as one list.`)) return;
      if (items.length) set('text', lineItemsToText(items.map(strip)));
      setNewTiers([]); setNewPhases([]);
    } else if (next === 'phases') {
      const first = tierNames[0] ?? 'Phase 1';
      if (items.length) set('text', groupedText(items.map((it) => { const n = strip(it); delete n.optional; n.phase = it.tier || first; return n; })));
      setNewPhases([...new Set([first, ...tierNames])].map((name) => ({ name, terms: '' })));
      setNewTiers([]);
    } else {
      if (items.length) set('text', groupedText(items.map((it) => { const n = strip(it); if (it.phase) n.tier = it.phase; return n; })));
      setNewTiers(phaseList.map((ph) => ph.name));
      setNewPhases([]);
    }
    setChosenMode(next);
    setTarget(null);
  }

  function addGroup() {
    const name = groupDraft.name.trim().replace(/\|/g, ' ').slice(0, 80);
    if (!name || /^(none|end|no phase|all|shared)$/i.test(name)) return;
    if (priceMode === 'tiers' && !tierNames.includes(name)) setNewTiers((cur) => [...cur, name]);
    if (priceMode === 'phases' && !phaseList.some((x) => x.name === name)) setNewPhases((cur) => [...cur, { name, terms: groupDraft.terms.replace(/[|\r\n]+/g, ' ').trim().slice(0, 300) }]);
    setGroupDraft({ name: '', terms: '' });
  }

  function renameGroup(g: Group, to: string) {
    const name = to.trim().replace(/\|/g, ' ').slice(0, 80);
    if (!name || name === g.name || (g.kind === 'tier' ? tierNames.includes(name) : phaseList.some((x) => x.name === name))) return;
    if (g.kind === 'tier') {
      setNewTiers((cur) => cur.map((t) => (t === g.name ? name : t)));
      if (items.some((it) => it.tier === g.name)) set('text', lineItemsToText(items.map((it) => (it.tier === g.name ? { ...it, tier: name } : it))));
    } else {
      setNewPhases((cur) => cur.map((x) => (x.name === g.name ? { ...x, name } : x)));
      if (items.some((it) => it.phase === g.name)) set('text', lineItemsToText(items.map((it) => (it.phase === g.name ? { ...it, phase: name } : it))));
    }
    if (target?.kind === g.kind && target.name === g.name) setTarget({ ...g, name });
  }

  function removeGroup(g: Group) {
    const count = items.filter((it) => inGroup(g, it)).length;
    if (count && !window.confirm(`Remove ${g.name} and its ${count} item${count === 1 ? '' : 's'}?`)) return;
    if (g.kind === 'tier') setNewTiers((cur) => cur.filter((t) => t !== g.name));
    else setNewPhases((cur) => cur.filter((x) => x.name !== g.name));
    if (count) set('text', lineItemsToText(items.filter((it) => !inGroup(g, it))));
    if (target?.kind === g.kind && target.name === g.name) setTarget(null);
  }

  /** Moves a line to another tier or phase. */
  function moveBlock(b: LineBlock, g: Group) {
    const idx = blocks.filter((x) => x.item).indexOf(b);
    if (idx < 0) return;
    if (g.kind === 'phase') set('text', setPhaseInText(draft.text, idx, g.name, phaseList.find((x) => x.name === g.name)?.terms ?? ''));
    else if (g.kind === 'tier' || g.kind === 'shared') set('text', setTierInText(draft.text, idx, g.kind === 'tier' ? g.name : null));
  }

  /** Opens the price list or the custom item form for one card. */
  function addTo(g: Group | null, how: 'list' | 'custom') {
    setTarget(g);
    if (how === 'list') setDrawer(true);
    else setCustomOpen(true);
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

  /** Out-of-scope work: what the work is, typed on its row (always shown to the client). */
  function describeBlock(b: LineBlock, text: string) {
    if (!b.item) return;
    const lines = draft.text.split('\n');
    const monthly = isMonthly(b.item);
    const clean = text.replace(/[|\t\r\n]+/g, ' ').replace(/^[~\s]+/, '');
    const next: LineItem = { ...b.item, description: monthly ? `${clean} /mo` : clean };
    delete next.hide_description;
    lines.splice(b.start, b.end - b.start + 1, ...lineText(next).split('\n'));
    set('text', lines.join('\n'));
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

  function setPhaseTerms(name: string, terms: string) {
    setNewPhases((cur) => cur.map((p) => (p.name === name ? { ...p, terms } : p)));
    if (items.some((it) => it.phase === name)) set('text', setPhaseTermsInText(draft.text, name, terms));
  }

  /** A phase's timeline ("4–6 weeks"), shown in its title. */
  function setPhaseTimeline(name: string, timeline: string) {
    setNewPhases((cur) => cur.map((p) => (p.name === name ? { ...p, timeline } : p)));
    if (items.some((it) => it.phase === name)) set('text', setPhaseTimelineInText(draft.text, name, timeline));
  }

  /** "Make an estimate" from a phased estimate's phases: a new draft with just those lines and their terms. */
  function estimateFromPhases(est: Estimate, phases: string[], end: 'low' | 'high' = 'low') {
    if (!phases.length) return;
    if (hasDraft && !window.confirm('Start a new estimate from these phases? The unsaved draft you had will be replaced.')) return;
    const terms = phaseTermsNote(est.line_items, phases);
    const t = today();
    setEditingId(null);
    setFromEstimateId(null);
    setNewPhases([]);
    setFromPhases({ estimate_id: est.id, estimate_number: est.estimate_number, phases, crm_deal_id: est.crm_deal_id ?? null });
    setDraft({
      ...blankDraft('estimate'), client: clientKeyFor(est), clientName: est.client_name,
      title: [est.title, phases.join(' + ')].filter(Boolean).join(' — ').slice(0, 200),
      issueDate: t, dueDate: addDays(t, 30),
      text: lineItemsToText(phaseLines(est.line_items, phases, end)),
      notes: terms, totalsOnly: est.totals_only ?? false,
      // The phase's terms set the deposit ("50% to start" → 50%), when every chosen phase agrees.
      estDeposit: (() => {
        const pcts = [...new Set(phasesOf(est.line_items).filter((ph) => phases.includes(ph.name)).map((ph) => depositPercentFromTerms(ph.terms)))];
        return pcts.length === 1 && pcts[0] ? String(pcts[0]) : '';
      })(),
    });
    setView('edit');
    scrollTop();
    show(`New estimate from ${phases.join(', ')}. Check it, save, then send.`);
  }

  /** The deposit percent of the proposal an estimate belongs to, as the builder's text ('' = none). */
  function proposalDepositFor(estId: string): string {
    const n = Number(data?.proposalLinks?.find((l) => l.estimate_id === estId)?.deposit_percent ?? 0);
    return n > 0 && n < 100 ? String(n) : '';
  }

  /** The final estimate from a price range (migration 063): the chosen end's items, as a plain estimate. */
  function estimateFromRange(est: Estimate, end: 'low' | 'high') {
    if (hasDraft && !window.confirm('Start the final estimate? The unsaved draft you had will be replaced.')) return;
    const sel = (est as { selection?: LineSelection | null }).selection ?? null;
    const t = today();
    setEditingId(null);
    setFromEstimateId(null);
    setNewPhases([]);
    setNewTiers([]);
    setChosenMode('list');
    setFromPhases({ estimate_id: est.id, estimate_number: est.estimate_number, phases: ['Final estimate'], crm_deal_id: est.crm_deal_id ?? null });
    setDraft({
      ...blankDraft('estimate'), client: clientKeyFor(est), clientName: est.client_name,
      title: est.title, issueDate: t, dueDate: addDays(t, 30),
      text: lineItemsToText(rangeLines(est.line_items, end, sel)),
      notes: est.notes ?? '', totalsOnly: est.totals_only ?? false,
      // The proposal's deposit (a range's estimate doesn't keep one itself).
      estDeposit: proposalDepositFor(est.id),
    });
    setView('edit');
    scrollTop();
    show(`Final estimate from the ${end} end. Adjust it, save, then send.`);
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
    const text = target
      ? addToGroupInText(draft.text, parsed.items, tagOf(target))
      : /^#+\s+/m.test(draft.text)
      ? insertUnderHeading(draft.text, 'Custom items', [line])
      : `${draft.text.replace(/\s+$/, '')}${draft.text.trim() ? '\n' : ''}${line}\n`;
    set('text', text);
    setCustom({ name: '', description: '', price: '', monthly: false });
    setCustomError('');
    show(`Added ${custom.name.trim()}${target ? ` to ${groupLabel(target)}` : ''}.`);
  }

  const clientNameById = new Map(data.clients.map((c) => [c.id, clientLabel(c)]));
  const canSave = items.length > 0 && problems.length === 0 && missing.length === 0 && !depositProblem;
  const editingEstimate = editingId ? data.estimates.find((e) => e.id === editingId) : undefined;
  /** The proposal an estimate belongs to: its pricing is the source. */
  const proposalOf = (estId: string | undefined) => (estId ? data.proposalLinks?.find((l) => l.estimate_id === estId) : undefined);
  const linkedProposal = proposalOf(editingEstimate?.id);

  // The custom item form: inside the tier or phase card it was opened from, else under the list.
  const customForm = (
              <div className={s.customForm}>
                <div className={s.customHead}>
                  <strong>Custom item{target ? ` — ${groupLabel(target)}` : ''}</strong>
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
  );

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
                        {!isPhased(est.line_items) && hasRange(est.line_items) && est.status === 'accepted' && !((est as { selection?: LineSelection | null }).selection?.made ?? []).length && (
                          <span className={`${s.status} ${s.stDeclined}`}>Make the final estimate</span>
                        )}
                        {isPhased(est.line_items) && (() => {
                          // Phases (migration 062): approved phases still waiting on their estimate.
                          const sel = (est as { selection?: LineSelection | null }).selection;
                          const waiting = (sel?.phases ?? []).filter((n) => !(sel?.made ?? []).some((m) => m.phases.includes(n)));
                          return <span className={`${s.status} ${waiting.length ? s.stDeclined : s.stDraft}`}>
                            {waiting.length ? `Make estimate: ${waiting.join(', ')}` : 'Phased'}
                          </span>;
                        })()}
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
                    <span className={s.docAmount}>{isPhased(est.line_items) ? `${phasesOf(est.line_items).length} phases`
                      : hasRange(est.line_items) ? (() => { const e = rangeTotals(est.line_items, (est as { selection?: LineSelection | null }).selection ?? null); return rangeText(e.low, e.high); })()
                      : formatLineMoney(est.total_cents)}</span>
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
                      {est.status !== 'invoiced' && !isPhased(est.line_items) && !hasRange(est.line_items) && (
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
            {!isInvoice && !isPhased(items) && !hasRange(items) && (
              <EstimateDeposit value={draft.estDeposit ?? ''} total={total} locked={!!linkedProposal} onChange={(v) => set('estDeposit', v)} />
            )}
          </section>

          <section className={s.step}>
            <StepHead n={3} title="Items" hint="Choose from your price list. Need something that isn’t on it? Add a custom item." />

            {!isInvoice && (
              <>
                <div className={s.modes} role="tablist" aria-label="How the prices are laid out">
                  {(['list', 'tiers', 'phases'] as const).map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={priceMode === m} className={`${s.mode} ${priceMode === m ? s.modeOn : ''}`} onClick={() => switchPriceMode(m)}>
                      {m === 'list' ? 'List' : m === 'tiers' ? 'Tiers' : 'Phases'}
                    </button>
                  ))}
                </div>
                <p className={s.tierHint} style={{ margin: '0 0 12px' }}>
                  {priceMode === 'list' ? 'One price for everything. Tick Optional on a line for add-ons the client can choose.'
                    : priceMode === 'tiers' ? 'The client picks one option when they accept. Items in “Included in every option” are part of all of them. The total shows the first option until they choose.'
                    : 'Each phase has its own items, subtotal and payment terms — no grand total. The client approves phases, and you get a text to make the estimate for them.'}
                </p>
              </>
            )}
            {blocks.length === 0 && !textOpen && (isInvoice || priceMode === 'list') ? (
              <div className={s.itemsEmpty}>
                <button type="button" className={`${p.btn} ${p.btnPrimary} ${s.bigBtn}`} disabled={!catalog} onClick={() => addTo(null, 'list')}
                  title={catalog ? undefined : 'Run migration 047 to use the price list'}>
                  Choose from price list
                </button>
                {!customOpen && <button type="button" className={s.textLink} onClick={() => addTo(null, 'custom')}>or add a custom item</button>}
              </div>
            ) : (
              <>
                {isInvoice || priceMode === 'list' ? (
                  <>
                    <ItemRows blocks={blocks} catalog={catalog} onRemove={removeBlock} onQty={setBlockQty} onToggleDescription={toggleDescription} onDescribe={describeBlock}
                      onOptional={isInvoice ? undefined : toggleOptional} />
                    <div className={s.itemsTools}>
                      <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!catalog} onClick={() => addTo(null, 'list')}
                        title={catalog ? undefined : 'Run migration 047 to use the price list'}>
                        + Add from price list
                      </button>
                      {!customOpen && <button type="button" className={p.btn} onClick={() => addTo(null, 'custom')}>+ Custom item</button>}
                    </div>
                  </>
                ) : (
                  <>
                    {groups.map((g, n) => {
                      const mine = blocks.filter((b) => b.item && inGroup(g, b.item));
                      const lines = mine.map((b) => b.item!);
                      const terms = phaseList.find((x) => x.name === g.name)?.terms ?? '';
                      const sharedLines = items.filter((it) => !it.tier && !it.optional);
                      const sumText = g.kind === 'tier' ? (lines.length || sharedLines.length ? formatLineMoney(tierTotal(items, g.name)) : '—')
                        : g.kind === 'phase' ? (lines.length ? (() => { const ph = phasesOf(items).find((x) => x.name === g.name); return ph ? amountText(ph.oneTime, ph.monthly) : '—'; })() : '—')
                        : lines.length ? amountText(lines.filter((it) => !it.optional && !isMonthly(it)).reduce((a, it) => a + it.amount_cents, 0), lines.filter((it) => !it.optional && isMonthly(it)).reduce((a, it) => a + it.amount_cents, 0)) : '—';
                      const isTarget = customOpen && target?.kind === g.kind && target.name === g.name;
                      return (
                        <div key={`${g.kind}:${g.name}`} className={s.group}>
                          <div className={s.groupHead}>
                            <span className={s.groupKicker}>{g.kind === 'shared' ? 'In every option' : g.kind === 'tier' ? `Option ${n}` : g.kind === 'phase' ? `Phase ${n + 1}` : 'Not in a phase'}</span>
                            {g.kind === 'shared' ? <strong className={s.groupName}>Included in every option</strong>
                              : g.kind === 'loose' ? <strong className={s.groupName}>Move these into a phase</strong>
                              : <NameField value={g.name} onCommit={(v) => renameGroup(g, v)} />}
                            <strong className={s.groupTotal}>{sumText}</strong>
                            {(g.kind === 'tier' || g.kind === 'phase') && (
                              <button type="button" className={s.iconBtn} aria-label={`Remove ${g.name}`} title="Remove" onClick={() => removeGroup(g)}>×</button>
                            )}
                          </div>
                          {g.kind === 'phase' && (
                            <div className={s.groupTerms}>
                              <input className={p.input} value={phaseList.find((x) => x.name === g.name)?.timeline ?? ''} placeholder="Timeline, e.g. 4–6 weeks or Dec–Feb"
                                aria-label={`Timeline for ${g.name}`} onChange={(e) => setPhaseTimeline(g.name, e.target.value.replace(/[|\r\n]+/g, ' '))} />
                              <input className={p.input} value={terms} placeholder="Payment terms, e.g. 50% to start · 50% on delivery"
                                aria-label={`Payment terms for ${g.name}`} onChange={(e) => setPhaseTerms(g.name, e.target.value.replace(/[|\r\n]+/g, ' '))} />
                              <div className={s.quickDates}>
                                {PHASE_TERMS.map((t) => (
                                  <button key={t} type="button" className={`${s.chip} ${terms === t ? s.chipOn : ''}`} onClick={() => setPhaseTerms(g.name, t)}>{t}</button>
                                ))}
                              </div>
                            </div>
                          )}
                          {mine.length > 0
                            ? <ItemRows blocks={mine} catalog={catalog} onRemove={removeBlock} onQty={setBlockQty} onToggleDescription={toggleDescription} onDescribe={describeBlock}
                                onOptional={priceMode === 'tiers' ? toggleOptional : undefined}
                                move={{ groups: groups.filter((x) => x.kind !== 'loose'), current: g, label: groupLabel, onMove: moveBlock }} />
                            : <p className={s.groupEmpty}>{g.kind === 'shared' ? 'Nothing yet — add what every option includes, or leave it empty.' : 'No items yet.'}</p>}
                          {isTarget && customForm}
                          {g.kind !== 'loose' && (
                            <div className={s.itemsTools} style={{ marginTop: 0 }}>
                              <button type="button" className={`${p.btn} ${p.btnPrimary} ${p.btnSmall}`} disabled={!catalog} onClick={() => addTo(g, 'list')}
                                title={catalog ? undefined : 'Run migration 047 to use the price list'}>+ From price list</button>
                              {!isTarget && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => addTo(g, 'custom')}>+ Custom item</button>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className={s.phaseAdd} style={priceMode === 'tiers' ? { gridTemplateColumns: '1fr auto' } : undefined}>
                      <input className={p.input} value={groupDraft.name} placeholder={priceMode === 'tiers' ? 'New tier, e.g. Custom store' : 'New phase, e.g. Discovery'}
                        onChange={(e) => setGroupDraft((d) => ({ ...d, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
                      {priceMode === 'phases' && (
                        <input className={p.input} value={groupDraft.terms} placeholder="Payment terms (optional)"
                          onChange={(e) => setGroupDraft((d) => ({ ...d, terms: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} />
                      )}
                      <button type="button" className={p.btn} disabled={!groupDraft.name.trim()} onClick={addGroup}>{priceMode === 'tiers' ? 'Add tier' : 'Add phase'}</button>
                    </div>
                  </>
                )}
              </>
            )}

            {problems.length > 0 && (
              <div className={s.problems}>
                {problems.map((pr) => <p key={pr.line}>Line {pr.line}: {pr.message}</p>)}
                {!textOpen && <button type="button" className={s.textLink} onClick={() => setTextOpen(true)}>Fix it in the text</button>}
              </div>
            )}

            {customOpen && !(target && groups.some((g) => g.kind === target.kind && g.name === target.name)) && customForm}

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
                    <button type="button" onClick={() => {
                      // Back into the same tier or phase as the item that needs it.
                      const owner = items.find((it) => it.name.replace(/\s*\(x\d+\)/i, '').toLowerCase() === item.name.toLowerCase());
                      insertItems([{ item: required, qty: 1 }], (owner && groups.find((g) => g.kind !== 'loose' && inGroup(g, owner))) ?? null);
                    }}>Add it back</button>
                  </p>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className={s.suggested}>
                <span className={s.suggestedLabel}>Suggested add-ons</span>
                <div className={s.suggestedList}>
                  {suggestions.map((sg) => (
                    <button key={sg.id} type="button" className={s.suggestedChip} onClick={() => insertItems([{ item: sg, qty: 1 }], priceMode === 'phases' ? groups[0] ?? null : null)}>
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
            {fromPhases && !editingId && (
              <p className={s.phaseFrom}>From {fromPhases.estimate_number}: {fromPhases.phases.join(', ')}. Saving files it under the same deal and marks those phases as estimated.</p>
            )}
            {editingEstimate && isPhased(editingEstimate.line_items) && (
              <PhaseMaker est={editingEstimate} disabled={dirty || busy} onMake={(phases, end) => estimateFromPhases(editingEstimate, phases, end)} />
            )}
            {editingEstimate && !isPhased(editingEstimate.line_items) && hasRange(editingEstimate.line_items) && (
              <FinalMaker est={editingEstimate} disabled={dirty || busy} onMake={(end) => estimateFromRange(editingEstimate, end)} />
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
                  {!isPhased(editingEstimate.line_items) && !hasRange(editingEstimate.line_items) && (
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={dirty} title={dirty ? 'Save your changes first' : undefined}
                    onClick={() => invoiceFromEstimate(editingEstimate)}>Turn into invoice</button>
                  )}
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
function ItemRows({ blocks, catalog, onRemove, onQty, onToggleDescription, onDescribe, onOptional, move }: {
  blocks: LineBlock[]; catalog: Catalog | null;
  onRemove: (b: LineBlock) => void; onQty: (b: LineBlock, item: PriceItem, qty: number) => void;
  onToggleDescription: (b: LineBlock) => void;
  /** Out-of-scope work: its description, typed on the row. */
  onDescribe: (b: LineBlock, text: string) => void;
  /** Estimates (migration 061): the Optional tick (an extra the client can add). */
  onOptional?: (b: LineBlock) => void;
  /** In a tier or phase card: move the line to another one. */
  move?: { groups: Group[]; current: Group; label: (g: Group) => string; onMove: (b: LineBlock, g: Group) => void };
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
              {!move && !hasChoices(valid.map((b) => b.item)) && <span>{amountText(g.oneTime, g.monthly)}</span>}
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
                    {b.item.range && <span className={s.badgeTier}>{b.item.range === 'low' ? 'Low end' : 'High end'}</span>}
                    {!cat && <span className={s.badgeCustom}>Custom</span>}
                    {b.item.percent ? <span className={s.badgePercent}>{b.item.percent}% off</span> : null}
                  </span>
                  {isScopeWork(b.item) ? (
                    <label className={s.workDesc}>
                      <span>What’s the work? <em>Required — always on the client’s paper</em></span>
                      <input className={`${p.input} ${needsWorkDescription(b.item) ? s.workDescMissing : ''}`}
                        value={needsWorkDescription(b.item) ? '' : b.item.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}
                        placeholder="e.g. Extra admin report for ticket sales, not in the original scope"
                        onChange={(e) => onDescribe(b, e.target.value)} />
                    </label>
                  ) : b.item.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '') && (
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
                  {(move || onOptional) && !b.item.percent && (
                    <span className={s.choiceControls}>
                      {move && move.groups.length > 1 && (
                        <select className={s.tierSelect} value={`${move.current.kind}:${move.current.name}`} aria-label={`Move ${name}`}
                          onChange={(e) => { const g = move.groups.find((x) => `${x.kind}:${x.name}` === e.target.value); if (g) move.onMove(b, g); }}>
                          {move.current.kind === 'loose' && <option value="loose:">Move to a phase…</option>}
                          {move.groups.map((g) => (
                            <option key={`${g.kind}:${g.name}`} value={`${g.kind}:${g.name}`}>
                              {g.kind === move.current.kind && g.name === move.current.name ? 'In' : 'Move to'}: {move.label(g)}
                            </option>
                          ))}
                        </select>
                      )}
                      {onOptional && (
                        <label className={s.optionalTick}>
                          <input type="checkbox" checked={optional} onChange={() => onOptional(b)} />
                          Optional
                        </label>
                      )}
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

/** One-tap payment terms for a phase. */
const PHASE_TERMS = ['Due upfront', '50% to start · 50% on delivery', 'Due on completion', 'Monthly'];

/**
 * A saved phased estimate (migration 062): which phases the client approved,
 * which already have an estimate, and "Make estimate" from the ticked ones.
 */
/**
 * An estimate's payment terms (migration 064): a deposit to start. When the
 * client accepts, the invoice asks for just that; the rest stays locked until
 * you open the balance. A proposal's estimate follows the proposal's deposit.
 */
function EstimateDeposit({ value, total, locked, onChange }: { value: string; total: number; locked: boolean; onChange: (v: string) => void }) {
  const n = Number.parseFloat(value);
  const on = n > 0 && n < 100;
  const preset = ['', '25', '50'];
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 16 }}>
      <span className={p.label}>Payment terms</span>
      <div className={s.quickDates}>
        {preset.map((v) => (
          <button key={v || 'full'} type="button" disabled={locked} className={`${s.chip} ${value === v || (!v && !on) ? s.chipOn : ''}`}
            onClick={() => onChange(v)}>{v ? `${v}% deposit` : 'Invoice in full'}</button>
        ))}
        <input className={p.input} style={{ width: 110 }} inputMode="decimal" aria-label="Deposit percent" placeholder="Other %" disabled={locked}
          value={preset.includes(value) ? '' : value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} />
      </div>
      <span className={w.muted} style={{ fontSize: 12.5 }}>
        {locked ? 'Follows the proposal’s deposit.'
          : on ? `When they accept, the invoice asks for ${n}% now (${formatLineMoney(Math.round((total * n) / 100))}); the rest stays locked until you open the balance.`
          : 'When they accept, the whole amount is invoiced.'}
      </span>
    </div>
  );
}

/** Low end / High end: where the final estimate starts from (price ranges, migration 063). */
function EndPick({ end, onEnd }: { end: 'low' | 'high'; onEnd: (end: 'low' | 'high') => void }) {
  return (
    <div className={s.quickDates} role="group" aria-label="Start from">
      <span className={s.tierHint} style={{ alignSelf: 'center' }}>Start from:</span>
      {(['low', 'high'] as const).map((e) => (
        <button key={e} type="button" className={`${s.chip} ${end === e ? s.chipOn : ''}`} onClick={() => onEnd(e)}>{e === 'low' ? 'Low end' : 'High end'}</button>
      ))}
    </div>
  );
}

/**
 * A saved estimate with a price range and no phases (migration 063): the
 * client accepts a range; the final estimate starts from its low or high end.
 */
function FinalMaker({ est, disabled, onMake }: { est: Estimate; disabled: boolean; onMake: (end: 'low' | 'high') => void }) {
  const sel = ((est as { selection?: LineSelection | null }).selection ?? null);
  const [end, setEnd] = useState<'low' | 'high'>('low');
  const ends = rangeTotals(est.line_items, sel);
  const made = sel?.made ?? [];
  const accepted = (est as { accepted_by?: string | null }).accepted_by;
  return (
    <div className={s.tierBar} style={{ marginTop: 16 }}>
      <div className={s.tierBarHead}>
        <strong>Make the final estimate</strong>
        <span className={s.tierHint}>
          {est.status === 'accepted' ? `${accepted ?? 'The client'} accepted the range ${rangeText(ends.low, ends.high)}${sel?.tier ? ` (${sel.tier})` : ''}.` : `Price range ${rangeText(ends.low, ends.high)}.`}
          {' '}The final estimate starts with that end’s items (and everything in both) — adjust it, save and send.
          {made.length ? ` Made so far: ${made.map((m) => m.estimate_number).join(', ')}.` : ''}
        </span>
      </div>
      <EndPick end={end} onEnd={setEnd} />
      <div>
        <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={disabled}
          title={disabled ? 'Save your changes first' : undefined} onClick={() => onMake(end)}>
          Make the final estimate ({end === 'low' ? 'low end' : 'high end'}: {amountText(ends[end].oneTime, ends[end].monthly)})
        </button>
      </div>
    </div>
  );
}

function PhaseMaker({ est, disabled, onMake }: { est: Estimate; disabled: boolean; onMake: (phases: string[], end: 'low' | 'high') => void }) {
  const [end, setEnd] = useState<'low' | 'high'>('low');
  const sel = ((est as { selection?: LineSelection | null }).selection ?? null);
  const approved = sel?.phases ?? [];
  const made = sel?.made ?? [];
  const madeFor = (name: string) => made.find((m) => m.phases.includes(name));
  const phases = phasesOf(est.line_items);
  const [picked, setPicked] = useState<string[]>(() => {
    const open = approved.filter((n) => !madeFor(n));
    return open.length ? [open[0]] : [];
  });
  return (
    <div className={s.tierBar} style={{ marginTop: 16 }}>
      <div className={s.tierBarHead}>
        <strong>Make an estimate from phases</strong>
        <span className={s.tierHint}>
          {approved.length
            ? `${(est as { accepted_by?: string | null }).accepted_by ?? 'The client'} approved ${approved.join(', ')}. Tick the phases to estimate now — the new estimate has just their items, with the payment terms in its notes.`
            : 'Not approved yet. You can still make an estimate from any phase.'}
        </span>
      </div>
      <ul className={s.phaseList}>
        {phases.map((ph, i) => {
          const m = madeFor(ph.name);
          return (
            <li key={ph.name}>
              <label className={s.phasePick}>
                <input type="checkbox" checked={picked.includes(ph.name)}
                  onChange={(e) => setPicked((cur) => phases.map((x) => x.name).filter((n) => (n === ph.name ? e.target.checked : cur.includes(n))))} />
                <span>Phase {i + 1}: {ph.name}{ph.timeline ? ` · ${ph.timeline}` : ''}</span>
                {approved.includes(ph.name) && <span className={s.badgeTier}>Approved</span>}
                {m && <span className={s.badgeCustom}>{m.estimate_number} made</span>}
                <strong>{ph.range ? rangeText(ph.range.low, ph.range.high) : amountText(ph.oneTime, ph.monthly)}</strong>
              </label>
              {ph.terms && <span className={s.tierHint}>Payment terms: {ph.terms}</span>}
            </li>
          );
        })}
      </ul>
      {phases.some((ph) => ph.range && picked.includes(ph.name)) && <EndPick end={end} onEnd={setEnd} />}
      <div>
        <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={disabled || !picked.length}
          title={disabled ? 'Save your changes first' : undefined} onClick={() => onMake(picked, end)}>
          Make estimate{picked.length ? ` from ${picked.length === 1 ? picked[0] : `${picked.length} phases`}` : ''}
        </button>
      </div>
    </div>
  );
}

type PriceMode = 'list' | 'tiers' | 'phases';
/** A card of items: what every option includes, one tier, one phase, or items not in a phase yet. */
type Group = { kind: 'shared' | 'tier' | 'phase' | 'loose'; name: string };

/** A tier's or phase's name, saved when you leave the box (so typing doesn't reshuffle the cards). */
function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input className={s.groupNameInput} value={v} aria-label="Name" onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v.trim() && v !== value) onCommit(v); else setV(value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
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
          ) : !isInvoice && isPhased(items) ? (
            // Phases (migration 062), as the client sees them: each phase, its lines, its subtotal and terms.
            phasesOf(items).map((ph, n) => (
              <Fragment key={ph.name}>
                <tr className={s.catRow}><td colSpan={showHours ? 3 : 2}>Phase {n + 1}: {ph.name}{ph.timeline ? ` · ${ph.timeline}` : ''}{ph.terms ? ` · ${ph.terms}` : ''}</td></tr>
                {items.filter((it) => it.phase === ph.name).map((it, i) => (
                  <tr key={`${ph.name}-${i}`}>
                    <td>
                      <div className={s.lineName}>{it.name}</div>
                      {it.description && <div className={`${s.lineDesc} ${it.hide_description ? s.dimmed : ''}`}>{it.description.replace(/\s*\/\s*mo(nth)?\.?\s*$/i, '')}</div>}
                    </td>
                    {showHours && <td className={s.num}>{it.hours ?? ''}</td>}
                    <td className={s.num} style={{ fontWeight: 700 }}>{isMonthly(it) ? amountText(0, it.amount_cents) : amountText(it.amount_cents, 0)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={showHours ? 2 : 1}><div className={s.lineName}>Phase {n + 1} total</div></td>
                  <td className={s.num} style={{ fontWeight: 800 }}>{amountText(ph.oneTime, ph.monthly)}</td>
                </tr>
              </Fragment>
            ))
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

      {!isInvoice && isPhased(items) ? (
        <p className={s.paperNotes}>Phased: no grand total. The client approves phases, then you make an estimate for them.</p>
      ) : !isInvoice && split.monthly ? (
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

      {!isInvoice && (() => {
        // An estimate's payment terms (migration 064), as the client sees them.
        const line = estimateTermsLine({ deposit_percent: Number.parseFloat(draft.estDeposit ?? '') || null, amount_cents: total, line_items: items });
        return line ? <p className={s.paperNotes} style={{ fontWeight: 700 }}>{line}</p> : null;
      })()}
      {draft.notes.trim() && <p className={s.paperNotes}>{draft.notes.trim()}</p>}
    </section>
  );
}
