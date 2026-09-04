'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import s from '../../proposals.module.css';
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
}

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
  const [totalCents, setTotalCents] = useState(0);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        setImageUrls(loaded.imageUrls);
        setSignatures(loaded.signatures ?? []);
        setClients(clientRows ?? []);
        setSelectedId(loaded.blocks[0]?.id ?? null);
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
        const result = await apiSend<{ total_cents: number; status: ProposalStatus }>(
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
      const link = result.url || `${window.location.origin}${result.path}`;
      try {
        await navigator.clipboard.writeText(link);
        show('Published. Client link copied.');
      } catch {
        show('Published.');
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not publish', 'error');
    }
    setPublishing(false);
  }

  /**
   * The PDF route needs the admin passcode in a header, which a plain link
   * cannot send — so fetch the bytes and hand the browser a blob.
   */
  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/proposals/${id}/pdf`, {
        headers: { 'X-Admin-Passcode': sessionStorage.getItem('admin_passcode') ?? '' },
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
          <Link href="/admin/proposals" className={s.btn}>
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

  return (
    <BuilderProvider value={builderCtx}>
      <div className={s.builder}>
        <div className={s.pane}>
          <div className={s.builderBar}>
            <Link href="/admin/proposals" className={`${s.btn} ${s.btnSmall}`}>
              ← Proposals
            </Link>
            <span
              className={`${s.saveState} ${
                saveState === 'error'
                  ? s.saveStateError
                  : saveState === 'saved'
                    ? s.saveStateSaved
                    : ''
              }`}
              role="status"
              aria-live="polite"
            >
              {
                {
                  clean: 'Up to date',
                  pending: 'Unsaved changes',
                  saving: 'Saving…',
                  saved: 'Saved',
                  error: 'Not saved',
                }[saveState]
              }
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <Link
                href={`/admin/proposals/${id}/tune`}
                className={`${s.btn} ${s.btnSmall}`}
                title="Tune the template's proportions and lock them in"
              >
                Tune design
              </Link>
              <Link
                href={`/admin/proposals/templates?from=${id}`}
                className={`${s.btn} ${s.btnSmall}`}
                title="Save this proposal's blocks as a reusable template"
              >
                Save as template
              </Link>
              <Link
                href={`/admin/proposals/${id}/preview`}
                target="_blank"
                className={`${s.btn} ${s.btnSmall}`}
              >
                Preview
              </Link>
              <button
                type="button"
                className={`${s.btn} ${s.btnSmall}`}
                disabled={downloading}
                onClick={downloadPdf}
              >
                {downloading ? 'Building…' : 'PDF'}
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnSmall} ${s.btnPrimary}`}
                disabled={publishing}
                onClick={publish}
              >
                {publishing ? 'Publishing…' : meta.status === 'draft' ? 'Publish' : 'Copy link'}
              </button>
            </span>
          </div>

          {signatures.length > 0 && <SignedBanner signature={signatures[0]} currency={meta.currency} />}

          <div className={s.railSection}>
            <details style={{ marginBottom: 14 }}>
              <summary
                style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 10 }}
              >
                Proposal settings
              </summary>

              <div style={{ paddingTop: 10 }}>
                <TextInput
                  label="Name"
                  value={doc.title}
                  onChange={(title) => edit({ title })}
                />

                <Field label="Client">
                  {(fieldId) => (
                    <select
                      id={fieldId}
                      className={s.select}
                      value={doc.clientId}
                      onChange={(e) => edit({ clientId: e.target.value })}
                    >
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
                  <Field label="Proposal date">
                    {(fieldId) => (
                      <input
                        id={fieldId}
                        type="date"
                        className={s.input}
                        value={doc.proposalDate}
                        onChange={(e) => edit({ proposalDate: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Valid until">
                    {(fieldId) => (
                      <input
                        id={fieldId}
                        type="date"
                        className={s.input}
                        value={doc.validUntil}
                        onChange={(e) => edit({ validUntil: e.target.value })}
                      />
                    )}
                  </Field>
                </div>

                <Field
                  label="Deposit"
                  hint={`Due on approval: ${formatMoneyCents(
                    Math.round((totalCents * doc.depositPercent) / 100),
                    meta.currency,
                  )}`}
                >
                  {(fieldId) => (
                    <input
                      id={fieldId}
                      type="number"
                      min={0}
                      max={100}
                      className={s.input}
                      value={doc.depositPercent}
                      onChange={(e) =>
                        edit({
                          depositPercent: Math.min(
                            100,
                            Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                          ),
                        })
                      }
                    />
                  )}
                </Field>

                <Field label="Default accent">
                  {(fieldId) => (
                    <select
                      id={fieldId}
                      className={s.select}
                      value={doc.accent}
                      onChange={(e) => edit({ accent: e.target.value as AccentName })}
                    >
                      {(['green', 'orange', 'magenta', 'purple', 'blue'] as AccentName[]).map((accent) => (
                        <option key={accent} value={accent}>
                          {accent[0].toUpperCase() + accent.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <TextInput
                  label="Running header — left"
                  value={doc.agencyName}
                  onChange={(agencyName) => edit({ agencyName })}
                />
                <TextInput
                  label="Running header — right"
                  value={doc.headerNote}
                  onChange={(headerNote) => edit({ headerNote })}
                  hint="Appears on every page, e.g. the date."
                />
              </div>
            </details>

            <div className={s.repeatHead}>
              <span className={s.label} style={{ margin: 0 }}>
                Blocks
              </span>
              <button
                type="button"
                className={`${s.btn} ${s.btnSmall}`}
                onClick={() => setPickerOpen((open) => !open)}
              >
                Add block
              </button>
            </div>

            <BlockRail
              blocks={doc.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={(blocks) => edit({ blocks })}
              onToggleVisible={(blockId) =>
                edit((current) => ({
                  blocks: current.blocks.map((block) =>
                    block.id === blockId ? { ...block, visible: !block.visible } : block,
                  ),
                }))
              }
              onDuplicate={duplicateBlock}
              onDelete={deleteBlock}
            />

            {doc.blocks.length === 0 && (
              <p className={s.hint}>No blocks yet. Add one to start the document.</p>
            )}
          </div>

          <BlockPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onAdd={addBlock} />

          {selected && (
            <BlockEditor
              block={selected}
              currency={meta.currency}
              lineItems={doc.lineItems}
              onLineItemsChange={(lineItems) => edit({ lineItems })}
              onChange={(updated) =>
                edit((current) => ({
                  blocks: current.blocks.map((block) =>
                    block.id === updated.id ? updated : block,
                  ),
                }))
              }
            />
          )}
        </div>

        <div className={s.previewPane}>
          <div className={proposalFontClass}>
            <ProposalRenderer
              blocks={doc.blocks}
              theme={{
                accent: doc.accent,
                agencyName: doc.agencyName,
                headerNote: doc.headerNote,
              }}
              mode="web"
              currency={meta.currency}
              totalCents={totalCents}
              lineItems={doc.lineItems.map((item, index) => ({
                id: item.id ?? `local-${index}`,
                proposal_id: id,
                label: item.label,
                description: item.description,
                quantity: item.quantity,
                unit_price_cents: item.unit_price_cents,
                position: item.position,
              }))}
              imageUrls={imageUrls}
              headerNote={doc.headerNote}
            />
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </BuilderProvider>
  );
}

/**
 * Shown once a client has approved. Editing stays available on purpose — the
 * signature row holds its own frozen copy of the blocks, so changes here
 * cannot alter what was signed.
 */
function SignedBanner({
  signature,
  currency,
}: {
  signature: SignatureRow;
  currency: string;
}) {
  return (
    <div
      style={{
        margin: '12px 12px 0',
        border: '1px solid #bbf7d0',
        borderLeft: '3px solid #15803d',
        borderRadius: 8,
        background: '#f0fdf4',
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>
        Signed by {signature.signer_name}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#3f6212', lineHeight: 1.55 }}>
        {new Date(signature.signed_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}{' '}
        · {formatMoneyCents(signature.total_cents, currency)}
        {signature.ip_address ? ` · ${signature.ip_address}` : ''}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#65803d', lineHeight: 1.5 }}>
        Editing below changes the live document only. What was signed is frozen on the signature
        record and does not change.
      </p>
      {signature.content_hash && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 10,
            color: '#84a05a',
            wordBreak: 'break-all',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {signature.content_hash}
        </p>
      )}
    </div>
  );
}
