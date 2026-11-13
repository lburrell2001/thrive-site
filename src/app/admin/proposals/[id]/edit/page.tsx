'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import s from '../../proposals.module.css';
import pb from './builder.module.css';
import b from '../../../invoices/billing.module.css';
import { proposalTotals } from '@/lib/proposalBilling';
import { apiGet, apiSend, formatMoneyCents } from '../../adminApi';
import { Toast, useToast } from '../../Toast';
import { BlockEditor } from './BlockEditor';
import { BlockPicker } from './BlockPicker';
import { BlockRail } from './BlockRail';
import { BuilderProvider, Field, TextInput } from './fields';
import type { BuilderLineItem } from './forms/PricingForm';
import { ProposalRenderer } from '@/components/proposal/ProposalRenderer';
import { proposalFontClass } from '@/lib/proposalFonts';
import { emptyBlock } from '@/lib/proposalSchemas';
import { adminHeaders } from '@/lib/adminSession';
import SendLater, { laterAt, scheduledFor } from '../../../SendLater';
import { formatWhen } from '@/lib/scheduleTime';
import type {
  AccentName,
  BlockType,
  Proposal,
  ProposalBlock,
  ProposalStatus,
} from '@/types/proposal';

interface SignatureRow {
  id: string;
  signer_name: string;
  signer_email: string;
  signer_title: string | null;
  typed_name: string;
  signed_at: string;
  ip_address: string | null;
  content_hash: string | null;
  total_cents: number;
}

interface LoadResponse {
  proposal: Proposal;
  blocks: ProposalBlock[];
  lineItems: BuilderLineItem[];
  signatures: SignatureRow[];
  imageUrls: Record<string, string>;
  estimate?: LinkedEstimate | null;
}

interface LinkedEstimate { id: string; estimate_number: string; status: string; total_cents: number }

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
}

/** Everything the builder edits, held as one value so a save is one snapshot. */
interface Doc {
  title: string;
  clientId: string;
  proposalDate: string;
  validUntil: string;
  depositPercent: number;
  accent: AccentName;
  agencyName: string;
  headerNote: string;
  blocks: ProposalBlock[];
  lineItems: BuilderLineItem[];
}

type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 800;

export default function ProposalBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast, show } = useToast();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [meta, setMeta] = useState<{ slug: string; status: ProposalStatus; currency: string } | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [declinedAt, setDeclinedAt] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'details' | 'pricing' | 'pages'>('pages');
  // Its estimate (migration 050), rebuilt from the pricing on every save.
  const [estimate, setEstimate] = useState<LinkedEstimate | null>(null);
  // "Send": the email dialog.
  const [sending, setSending] = useState<{ email: string; note: string; busy: boolean; when: string | null } | null>(null);
  // A scheduled send of this proposal (migration 053), if there is one.
  const [scheduledSend, setScheduledSend] = useState<{ id: string; send_at: string; status: string; error: string | null; label: string } | null>(null);
  const loadScheduled = useCallback(() => {
    apiGet<{ sends: { id: string; kind: string; target_id: string | null; send_at: string; status: string; error: string | null; label: string }[] }>('/api/scheduled-sends')
      .then((r) => setScheduledSend(r.sends.find((x) => x.kind === 'proposal' && x.target_id === id) ?? null))
      .catch(() => setScheduledSend(null));
  }, [id]);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [publishing, setPublishing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loadError, setLoadError] = useState('');

  /** The last snapshot the server confirmed. A failed save rolls back to this. */
  const lastGood = useRef<Doc | null>(null);
  const saving = useRef(false);

  // ------------------------------------------------------------- load

  useEffect(() => {
    (async () => {
      try {
        const [loaded, clientRows] = await Promise.all([
          apiGet<LoadResponse>(`/api/proposals/${id}`),
          apiGet<ClientRow[]>('/api/proposal-clients').catch(() => [] as ClientRow[]),
        ]);

        const theme = loaded.proposal.theme ?? {};
        const next: Doc = {
          title: loaded.proposal.title,
          clientId: loaded.proposal.client_id ?? '',
          proposalDate: loaded.proposal.proposal_date,
          validUntil: loaded.proposal.valid_until ?? '',
          depositPercent: loaded.proposal.deposit_percent,
          accent: theme.accent ?? 'magenta',
          agencyName: theme.agencyName ?? 'Thrive Creative Studios',
          headerNote: theme.headerNote ?? '',
          blocks: loaded.blocks,
          lineItems: loaded.lineItems,
        };

        setDoc(next);
        lastGood.current = next;
        setMeta({
          slug: loaded.proposal.slug,
          status: loaded.proposal.status,
          currency: loaded.proposal.currency,
        });
        setTotalCents(loaded.proposal.total_cents);
        setDeclineReason(loaded.proposal.decline_reason);
        setDeclinedAt(loaded.proposal.declined_at);
        setImageUrls(loaded.imageUrls);
        setSignatures(loaded.signatures ?? []);
        setEstimate(loaded.estimate ?? null);
        setClients(clientRows ?? []);
        setTab(loaded.proposal.client_id ? 'pages' : 'details');
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load this proposal');
      }
    })();
  }, [id]);

  // --------------------------------------------------------- autosave

  const edit = useCallback((patch: Partial<Doc> | ((current: Doc) => Partial<Doc>)) => {
    setDoc((current) => {
      if (!current) return current;
      return { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
    });
    setSaveState('pending');
  }, []);

  useEffect(() => {
    if (!doc || saveState !== 'pending') return;

    const timer = setTimeout(async () => {
      if (saving.current) {
        // A save is already in flight; stay pending so the effect re-runs.
        setSaveState('pending');
        return;
      }

      const snapshot = doc;
      saving.current = true;
      setSaveState('saving');

      try {
        const result = await apiSend<{ total_cents: number; status: ProposalStatus; estimate?: LinkedEstimate | null }>(
          `/api/proposals/${id}`,
          'PATCH',
          {
            proposal: {
              title: snapshot.title,
              client_id: snapshot.clientId || null,
              proposal_date: snapshot.proposalDate,
              valid_until: snapshot.validUntil || null,
              deposit_percent: snapshot.depositPercent,
              theme: {
                accent: snapshot.accent,
                agencyName: snapshot.agencyName,
                headerNote: snapshot.headerNote,
              },
            },
            blocks: snapshot.blocks,
            lineItems: snapshot.lineItems,
          },
        );

        lastGood.current = snapshot;
        setTotalCents(result.total_cents);
        if (result.estimate) setEstimate(result.estimate);
        setMeta((current) => (current ? { ...current, status: result.status } : current));
        setSaveState((current) => (current === 'saving' ? 'saved' : current));
      } catch (error) {
        // Roll back to the last confirmed state rather than leaving the
        // screen showing edits the database never accepted.
        if (lastGood.current) setDoc(lastGood.current);
        setSaveState('error');
        show(
          error instanceof Error ? `Not saved — ${error.message}` : 'Not saved. Changes reverted.',
          'error',
        );
      } finally {
        saving.current = false;
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [doc, saveState, id, show]);

  // Warn before losing an unsaved edit on a hard navigation.
  useEffect(() => {
    if (saveState !== 'pending' && saveState !== 'saving') return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);

  // ----------------------------------------------------- block actions

  const addBlock = useCallback(
    (type: BlockType) => {
      const created = emptyBlock(type, crypto.randomUUID(), 0);
      edit((current) => ({
        blocks: [...current.blocks, { ...created, position: current.blocks.length }],
      }));
      setSelectedId(created.id);
    },
    [edit],
  );

  /** Show or hide the cover; adds one at the top if there isn't one yet. */
  const toggleCover = useCallback(() => {
    let addedId: string | null = null;
    edit((current) => {
      if (current.blocks.some((block) => block.type === 'cover')) {
        return {
          blocks: current.blocks.map((block) =>
            block.type === 'cover' ? { ...block, visible: !block.visible } : block,
          ),
        };
      }
      const created = emptyBlock('cover', crypto.randomUUID(), 0);
      if (created.type === 'cover') {
        created.content = {
          ...created.content,
          dateLabel: current.headerNote,
          preparedBy: current.agencyName || 'Thrive Creative Studios',
          preparedFor: clients.find((c) => c.id === current.clientId)?.name ?? '',
        };
      }
      addedId = created.id;
      return { blocks: [created, ...current.blocks].map((block, i) => ({ ...block, position: i })) };
    });
    if (addedId) setSelectedId(addedId);
  }, [edit, clients]);

  const duplicateBlock = useCallback(
    (blockId: string) => {
      edit((current) => {
        const index = current.blocks.findIndex((block) => block.id === blockId);
        if (index === -1) return {};
        // A copy needs its own id — sharing one would make the two rows
        // collide on save.
        const copy = { ...current.blocks[index], id: crypto.randomUUID() };
        const blocks = [...current.blocks];
        blocks.splice(index + 1, 0, copy);
        return { blocks: blocks.map((block, i) => ({ ...block, position: i })) };
      });
    },
    [edit],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      if (!window.confirm('Delete this block?')) return;
      edit((current) => ({
        blocks: current.blocks
          .filter((block) => block.id !== blockId)
          .map((block, i) => ({ ...block, position: i })),
      }));
      setSelectedId((current) => (current === blockId ? null : current));
    },
    [edit],
  );

  const registerImageUrl = useCallback((path: string, url: string) => {
    setImageUrls((current) => ({ ...current, [path]: url }));
  }, []);

  // -------------------------------------------------------- publishing

  async function publish() {
    setPublishing(true);
    try {
      const result = await apiSend<{ url: string; path: string }>(
        `/api/proposals/${id}/send`,
        'POST',
      );
      setMeta((current) => (current ? { ...current, status: 'sent' } : current));
      setDeclineReason(null);
      setDeclinedAt(null);
      const link = result.url || `${window.location.origin}${result.path}`;
      const reopened = meta?.status === 'declined';
      try {
        await navigator.clipboard.writeText(link);
        show(reopened ? 'Reopened. Client link copied.' : 'Published. Client link copied.');
      } catch {
        show(reopened ? 'Reopened.' : 'Published.');
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not publish', 'error');
    }
    setPublishing(false);
  }

  /** Opens the Send dialog with their email filled in. */
  async function startSend() {
    setSending({ email: '', note: '', busy: true, when: null });
    try {
      const r = await apiGet<{ email: string }>(`/api/proposals/${id}/email`);
      setSending((cur) => (cur ? { ...cur, email: cur.email || r.email, busy: false } : cur));
    } catch {
      setSending((cur) => (cur ? { ...cur, busy: false } : cur));
    }
  }

  /** Publishes and emails the client a button to the proposal. */
  async function sendProposal() {
    if (!sending) return;
    setSending({ ...sending, busy: true });
    try {
      const later = laterAt(sending.when);
      if (later) {
        if (later.problem) throw new Error(later.problem);
        await apiSend('/api/scheduled-sends', 'POST', {
          kind: 'proposal', target_id: id, label: `Proposal “${doc?.title ?? 'Untitled'}” to ${sending.email}`,
          payload: { email: sending.email, note: sending.note }, send_at: later.iso,
        });
        setSending(null);
        show(`“${doc?.title ?? 'The proposal'}” to ${sending.email}: ${scheduledFor(later.iso)} It’s published then.`);
        loadScheduled();
        return;
      }
      const r = await apiSend<{ to: string }>(`/api/proposals/${id}/email`, 'POST', { email: sending.email, note: sending.note });
      setMeta((current) => (current && (current.status === 'draft' || current.status === 'declined') ? { ...current, status: 'sent' } : current));
      setDeclineReason(null);
      setDeclinedAt(null);
      setSending(null);
      show(`Sent to ${r.to}.`);
      loadScheduled();
    } catch (error) {
      setSending((cur) => (cur ? { ...cur, busy: false } : cur));
      show(error instanceof Error ? error.message : 'Could not send it', 'error');
    }
  }

  /**
   * The PDF route needs the admin passcode in a header, which a plain link
   * cannot send — so fetch the bytes and hand the browser a blob.
   */
  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/proposals/${id}/pdf`, {
        headers: await adminHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not build the PDF (${res.status})`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'proposal.pdf';
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not build the PDF', 'error');
    }
    setDownloading(false);
  }

  const builderCtx = useMemo(
    () => ({ proposalId: id, imageUrls, registerImageUrl }),
    [id, imageUrls, registerImageUrl],
  );

  if (loadError) {
    return (
      <div className={s.screen}>
        <div className={s.wrap}>
          <p className={s.empty}>{loadError}</p>
          <Link href="/admin/crm/proposals" className={s.btn}>
            Back to proposals
          </Link>
        </div>
      </div>
    );
  }

  if (!doc || !meta) {
    return (
      <div className={s.screen}>
        <p className={s.empty}>Loading…</p>
      </div>
    );
  }

  const selected = doc.blocks.find((block) => block.id === selectedId) ?? null;
  const hasCover = doc.blocks.some((block) => block.type === 'cover' && block.visible);
  const pricingBlock = doc.blocks.find((block) => block.type === 'pricing') ?? null;
  const { oneTime, monthly } = proposalTotals(doc.lineItems);
  const status = STATUS[meta.status];
  const addDays = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const editBlock = (updated: ProposalBlock) =>
    edit((current) => ({ blocks: current.blocks.map((block) => (block.id === updated.id ? updated : block)) }));

  const blockEditor = (block: ProposalBlock) => (
    <BlockEditor
      block={block}
      currency={meta.currency}
      lineItems={doc.lineItems}
      onLineItemsChange={(lineItems) => edit({ lineItems })}
      onChange={editBlock}
    />
  );

  return (
    <BuilderProvider value={builderCtx}>
      <div className={`${s.builder} ${pb.builder}`}>
        <div className={s.pane}>
          <div className={pb.top}>
            <div className={pb.topRow}>
              <Link href="/admin/crm/proposals" className={pb.back}>← Proposals</Link>
              <span className={`${b.status} ${status.cls}`}>{status.label}</span>
              <span
                className={`${s.saveState} ${saveState === 'error' ? s.saveStateError : saveState === 'saved' ? s.saveStateSaved : ''}`}
                role="status"
                aria-live="polite"
              >
                {{ clean: 'Up to date', pending: 'Unsaved', saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[saveState]}
              </span>
            </div>
            <input
              className={pb.titleInput}
              value={doc.title}
              aria-label="Proposal name"
              placeholder="Proposal name"
              onChange={(e) => edit({ title: e.target.value })}
            />
            <div className={pb.actions}>
              <Link href={`/admin/crm/proposals/${id}/preview`} target="_blank" className={`${s.btn} ${s.btnSmall}`}>Preview</Link>
              <button type="button" className={`${s.btn} ${s.btnSmall}`} disabled={downloading} onClick={downloadPdf}>
                {downloading ? 'Building…' : 'PDF'}
              </button>
              <details className={pb.more}>
                <summary className={`${s.btn} ${s.btnSmall}`}>More</summary>
                <div className={pb.menu}>
                  <button type="button" onClick={publish} disabled={publishing}>{meta.status === 'draft' ? 'Publish & copy the client link' : 'Copy the client link'}</button>
                  <button type="button" onClick={toggleCover}>{hasCover ? 'Hide the cover page' : 'Add a cover page'}</button>
                  <Link href={`/admin/crm/proposals/${id}/tune`}>Tune the design</Link>
                  <Link href={`/admin/crm/proposals/templates?from=${id}`}>Save as a template</Link>
                </div>
              </details>
              <button type="button" className={`${s.btn} ${s.btnSmall} ${s.btnPrimary} ${pb.primary}`} disabled={!!sending} onClick={startSend}>
                {publishLabel(meta.status)}
              </button>
            </div>
          </div>

          {signatures.length > 0 && (
            <SignedBanner signature={signatures[0]} currency={meta.currency} proposalId={id} depositPercent={doc.depositPercent}
              phasedEstimateId={doc.lineItems.some((i) => i.phase?.trim()) ? estimate?.id ?? null : undefined} />
          )}
          {meta.status === 'declined' && <DeclinedBanner reason={declineReason} declinedAt={declinedAt} />}
          {scheduledSend && (
            <div className={pb.scheduled} role="status">
              <span>
                {scheduledSend.status === 'failed'
                  ? <>The scheduled send didn’t go: {scheduledSend.error}</>
                  : <>Scheduled: {scheduledSend.label.replace(/^Proposal “.*” to /, 'to ')} on <strong>{formatWhen(scheduledSend.send_at)}</strong>. Edits until then go out with it.</>}
              </span>
              {scheduledSend.status !== 'sending' && (
                <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={async () => {
                  if (scheduledSend.status === 'scheduled' && !window.confirm('Cancel the scheduled send? Nothing is sent.')) return;
                  try { await apiSend(`/api/scheduled-sends?id=${scheduledSend.id}`, 'DELETE'); show(scheduledSend.status === 'failed' ? 'Dismissed.' : 'Cancelled. Nothing was sent.'); loadScheduled(); }
                  catch (e) { show(e instanceof Error ? e.message : 'Could not cancel it', 'error'); }
                }}>{scheduledSend.status === 'failed' ? 'Dismiss' : 'Cancel send'}</button>
              )}
            </div>
          )}

          <div className={pb.tabs} role="tablist" aria-label="Edit">
            {([['details', 'Details'], ['pricing', 'Pricing'], ['pages', 'Pages']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value}
                className={`${pb.tab} ${tab === value ? pb.tabOn : ''}`}
                onClick={() => { setTab(value); if (value === 'pages') setSelectedId(null); }}>
                {label}
                {value === 'pricing' && doc.lineItems.length > 0 && <span className={pb.tabNote}>{formatMoneyCents(oneTime || monthly, meta.currency)}</span>}
              </button>
            ))}
          </div>

          {tab === 'details' && (
            <div className={pb.panel}>
              <Field label="Client">
                {(fieldId) => (
                  <select id={fieldId} className={s.select} value={doc.clientId} onChange={(e) => edit({ clientId: e.target.value })}>
                    <option value="">No client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company ? `${client.name} · ${client.company}` : client.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <div className={s.inlineRow}>
                <Field label="Date">
                  {(fieldId) => (
                    <input id={fieldId} type="date" className={s.input} value={doc.proposalDate} onChange={(e) => edit({ proposalDate: e.target.value })} />
                  )}
                </Field>
                <Field label="Good until">
                  {(fieldId) => (
                    <input id={fieldId} type="date" className={s.input} value={doc.validUntil} onChange={(e) => edit({ validUntil: e.target.value })} />
                  )}
                </Field>
              </div>
              <div className={pb.chips}>
                {[14, 30, 60].map((days) => (
                  <button key={days} type="button" className={`${pb.chip} ${doc.validUntil === addDays(doc.proposalDate, days) ? pb.chipOn : ''}`}
                    onClick={() => edit({ validUntil: addDays(doc.proposalDate, days) })}>{days} days</button>
                ))}
                <button type="button" className={`${pb.chip} ${!doc.validUntil ? pb.chipOn : ''}`} onClick={() => edit({ validUntil: '' })}>No end date</button>
              </div>

              <div className={pb.group}>
                <span className={s.label}>Deposit due at signing</span>
                <div className={pb.chips}>
                  {[0, 25, 50, 100].map((pct) => (
                    <button key={pct} type="button" className={`${pb.chip} ${doc.depositPercent === pct ? pb.chipOn : ''}`}
                      onClick={() => edit({ depositPercent: pct })}>{pct === 0 ? 'None' : pct === 100 ? 'In full' : `${pct}%`}</button>
                  ))}
                  <input type="number" min={0} max={100} className={`${s.input} ${pb.pct}`} aria-label="Deposit percent" value={doc.depositPercent}
                    onChange={(e) => edit({ depositPercent: Math.min(100, Math.max(0, Number.parseInt(e.target.value, 10) || 0)) })} />
                  <span className={pb.pctSign}>%</span>
                </div>
                {doc.depositPercent > 0 && oneTime > 0 && (
                  <p className={s.hint}>{formatMoneyCents(Math.round((oneTime * doc.depositPercent) / 100), meta.currency)} due at signing</p>
                )}
              </div>

              <div className={pb.group}>
                <span className={s.label}>Accent colour</span>
                <div className={pb.swatches}>
                  {(['magenta', 'orange', 'blue', 'green', 'purple'] as AccentName[]).map((accent) => (
                    <button key={accent} type="button" aria-label={accent} aria-pressed={doc.accent === accent}
                      className={`${pb.swatch} ${pb[`sw_${accent}`]} ${doc.accent === accent ? pb.swatchOn : ''}`}
                      onClick={() => edit({ accent })} />
                  ))}
                </div>
              </div>

              <details className={pb.disclosure}>
                <summary>Running header</summary>
                <TextInput label="Left" value={doc.agencyName} onChange={(agencyName) => edit({ agencyName })} />
                <TextInput label="Right" value={doc.headerNote} onChange={(headerNote) => edit({ headerNote })} hint="On every page, e.g. the date." />
              </details>

              <button type="button" className={`${s.btn} ${s.btnPrimary} ${pb.next}`} onClick={() => setTab('pricing')}>Next: Pricing →</button>
            </div>
          )}

          {tab === 'pricing' && (
            <div className={pb.panel}>
              <div className={pb.estimateCard}>
                {estimate ? (
                  <>
                    <div>
                      <strong>Estimate {estimate.estimate_number}</strong>
                      <span>{formatMoneyCents(estimate.total_cents, meta.currency)} · {ESTIMATE_STATUS[estimate.status] ?? estimate.status} · updates from this pricing · the client can download it</span>
                    </div>
                    <Link href={`/admin/invoices?estimate=${estimate.id}`} className={`${s.btn} ${s.btnSmall}`}>Open</Link>
                  </>
                ) : (
                  <div>
                    <strong>Estimate</strong>
                    <span>Made from this pricing as soon as you add a line. Every proposal goes out with one.</span>
                  </div>
                )}
              </div>
              {pricingBlock ? blockEditor(pricingBlock) : (
                <div className={pb.emptyPanel}>
                  <p>This proposal has no pricing page yet.</p>
                  <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => { addBlock('pricing'); setTab('pricing'); }}>Add a pricing page</button>
                </div>
              )}
            </div>
          )}

          {tab === 'pages' && (
            selected ? (
              <div className={pb.panel}>
                <button type="button" className={pb.back} onClick={() => setSelectedId(null)}>← All pages</button>
                {blockEditor(selected)}
              </div>
            ) : (
              <div className={s.railSection}>
                <div className={s.repeatHead}>
                  <span className={pb.panelHint}>Tap a page to edit it. Drag to reorder.</span>
                  <button type="button" className={`${s.btn} ${s.btnSmall}`} onClick={() => setPickerOpen((open) => !open)}>
                    + Add a page
                  </button>
                </div>
                <BlockPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={addBlock} />
                <BlockRail
                  blocks={doc.blocks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={(blocks) => edit({ blocks })}
                  onToggleVisible={(blockId) =>
                    edit((current) => ({
                      blocks: current.blocks.map((block) => (block.id === blockId ? { ...block, visible: !block.visible } : block)),
                    }))
                  }
                  onDuplicate={duplicateBlock}
                  onDelete={deleteBlock}
                />
                {doc.blocks.length === 0 && <p className={s.hint}>No pages yet. Add one to start the document.</p>}
              </div>
            )
          )}
        </div>

        <div className={s.previewPane}>
          <div className={proposalFontClass}>
            <ProposalRenderer
              blocks={doc.blocks}
              theme={{ accent: doc.accent, agencyName: doc.agencyName, headerNote: doc.headerNote }}
              mode="web"
              currency={meta.currency}
              totalCents={doc.lineItems.length ? oneTime + monthly : totalCents}
              lineItems={doc.lineItems.map((item, index) => ({
                id: item.id ?? `local-${index}`,
                proposal_id: id,
                label: item.label,
                description: item.description,
                quantity: item.quantity,
                unit_price_cents: item.unit_price_cents,
                position: item.position,
                tier: item.tier ?? null,
                is_optional: !!item.is_optional,
                phase: item.phase ?? null,
                phase_terms: item.phase_terms ?? null,
              }))}
              imageUrls={imageUrls}
              headerNote={doc.headerNote}
              depositPercent={doc.depositPercent}
              clientName={clients.find((c) => c.id === doc.clientId)?.name}
            />
          </div>
        </div>
      </div>

      {sending && (
        <div className={pb.sendBackdrop} onMouseDown={(e) => { if (e.target === e.currentTarget && !sending.busy) setSending(null); }}>
          <div className={pb.sendDialog} role="dialog" aria-modal="true" aria-labelledby="send-proposal-title">
            <h2 id="send-proposal-title" className={pb.sendTitle}>Send “{doc.title}”</h2>
            <p className={s.hint}>They get an email with a button to the proposal. Their estimate is inside it, with Save as PDF and Approve and sign at the bottom. Signing makes their invoice{doc.depositPercent > 0 && doc.depositPercent < 100 ? ` (${doc.depositPercent}% deposit first)` : ''} and wins the deal.</p>
            <label>
              <span className={s.label}>To</span>
              <input className={s.input} type="email" value={sending.email} placeholder={sending.busy ? 'Looking up their email…' : 'name@business.com'}
                onChange={(e) => setSending({ ...sending, email: e.target.value })} autoFocus />
            </label>
            <label>
              <span className={s.label}>Note (optional)</span>
              <textarea className={s.textarea} rows={3} value={sending.note} placeholder="A line from you"
                onChange={(e) => setSending({ ...sending, note: e.target.value })} />
            </label>
            <SendLater when={sending.when} onChange={(v) => setSending({ ...sending, when: v })} disabled={sending.busy} />
            <div className={pb.sendActions}>
              <button type="button" className={s.btn} onClick={() => setSending(null)} disabled={sending.busy}>Cancel</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={sendProposal}
                disabled={sending.busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sending.email.trim())}>
                {sending.busy ? (sending.when ? 'Scheduling…' : 'Sending…') : sending.when ? 'Schedule' : 'Send proposal'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </BuilderProvider>
  );
}

const ESTIMATE_STATUS: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', invoiced: 'Invoiced' };

const STATUS: Record<ProposalStatus, { cls: string; label: string }> = {
  draft: { cls: b.stDraft, label: 'Draft' },
  sent: { cls: b.stSent, label: 'Sent' },
  viewed: { cls: s.stViewed, label: 'Opened' },
  signed: { cls: b.stAccepted, label: 'Signed' },
  declined: { cls: b.stDeclined, label: 'Declined' },
  expired: { cls: b.stInvoiced, label: 'Expired' },
};

/**
 * Shown once a client has approved, with the next step: invoicing. Editing
 * stays available on purpose — the signature row holds its own frozen copy
 * of the blocks, so changes here cannot alter what was signed.
 */
function SignedBanner({
  signature,
  currency,
  proposalId,
  depositPercent,
  phasedEstimateId,
}: {
  /** Phases (migration 062): approved phase by phase — make an estimate from them, not an invoice. */
  phasedEstimateId?: string | null;
  signature: SignatureRow;
  currency: string;
  proposalId: string;
  depositPercent: number;
}) {
  const split = depositPercent > 0 && depositPercent < 100;
  return (
    <div className={`${pb.banner} ${pb.bannerSigned}`}>
      <strong>Signed by {signature.signer_name}</strong>
      <p>
        {new Date(signature.signed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        {' · '}{formatMoneyCents(signature.total_cents, currency)}
        {signature.ip_address ? ` · ${signature.ip_address}` : ''}
      </p>
      <div className={pb.bannerActions}>
        {phasedEstimateId !== undefined ? (
          phasedEstimateId ? (
            <Link href={`/admin/invoices?estimate=${phasedEstimateId}`} className={`${s.btn} ${s.btnSmall} ${s.btnPrimary}`}>
              Make an estimate from the approved phases
            </Link>
          ) : null
        ) : (
          <Link href={`/admin/invoices?proposal=${proposalId}&part=full`} className={`${s.btn} ${s.btnSmall} ${s.btnPrimary}`}>
            {split ? `Make the invoice (${depositPercent}% deposit first)` : 'Make the invoice'}
          </Link>
        )}
      </div>
      <p className={pb.bannerSmall}>
        Editing changes the live document only. What was signed is frozen on the signature record.
        {signature.content_hash ? ` Fingerprint ${signature.content_hash.slice(0, 16)}…` : ''}
      </p>
    </div>
  );
}

/**
 * Shown when a client has said no. The reason is the useful part — publishing
 * again reopens the proposal on the same link and clears this.
 */
function DeclinedBanner({ reason, declinedAt }: { reason: string | null; declinedAt: string | null }) {
  return (
    <div className={`${pb.banner} ${pb.bannerDeclined}`}>
      <strong>
        Declined
        {declinedAt ? ` ${new Date(declinedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
      </strong>
      {reason && <p className={pb.reason}>“{reason}”</p>}
      <p className={pb.bannerSmall}>Revise it and publish again to reopen it on the same link.</p>
    </div>
  );
}

/**
 * The button both publishes and copies, so it has to say which one it is
 * about to do. A declined proposal in particular reopens to the client when
 * this is pressed.
 */
function publishLabel(status: ProposalStatus): string {
  if (status === 'draft') return 'Send';
  if (status === 'signed') return 'Email it again';
  return 'Send again';
}
