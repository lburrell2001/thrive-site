'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import s from '../proposals.module.css';
import { apiGet, apiSend, formatDate } from '../adminApi';
import { Toast, useToast } from '../Toast';
import { BLOCK_LABELS, type BlockType } from '@/types/proposal';

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  block_count: number;
  block_types: string[];
}

interface ProposalRow {
  id: string;
  title: string;
  proposal_date: string;
}

export default function TemplateLibraryPage() {
  const { toast, show } = useToast();
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scrub, setScrub] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, p] = await Promise.all([
          apiGet<TemplateRow[]>('/api/proposal-templates'),
          apiGet<ProposalRow[]>('/api/proposals').catch(() => [] as ProposalRow[]),
        ]);
        if (cancelled) return;
        setTemplates(t);
        setProposals(p ?? []);

        // Arriving from a builder's "Save as template" preselects that
        // proposal and suggests its title as the name.
        const from = new URLSearchParams(window.location.search).get('from');
        const source = (p ?? []).find((row) => row.id === from);
        if (source) {
          setSourceId(source.id);
          setName((current) => current || source.title);
        }
      } catch (error) {
        if (cancelled) return;
        show(error instanceof Error ? error.message : 'Could not load templates', 'error');
        setTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, show]);

  async function save() {
    if (!name.trim() || !sourceId) return;
    setSaving(true);
    try {
      await apiSend('/api/proposal-templates', 'POST', {
        name: name.trim(),
        description: description.trim() || null,
        fromProposalId: sourceId,
        scrubClientDetails: scrub,
        isDefault: makeDefault,
      });
      show('Template saved.');
      setName('');
      setDescription('');
      setSourceId('');
      setMakeDefault(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not save the template', 'error');
    }
    setSaving(false);
  }

  async function rename(template: TemplateRow) {
    const next = window.prompt('Rename this template', template.name);
    if (next === null || !next.trim() || next === template.name) return;
    setBusyId(template.id);
    try {
      await apiSend(`/api/proposal-templates/${template.id}`, 'PATCH', { name: next.trim() });
      show('Renamed.');
      setReloadKey((key) => key + 1);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not rename', 'error');
    }
    setBusyId(null);
  }

  async function makeTheDefault(template: TemplateRow) {
    setBusyId(template.id);
    try {
      await apiSend(`/api/proposal-templates/${template.id}`, 'PATCH', { isDefault: true });
      show(`"${template.name}" is now the default.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not set the default', 'error');
    }
    setBusyId(null);
  }

  async function remove(template: TemplateRow) {
    if (
      !window.confirm(
        `Delete "${template.name}"? Proposals already made from it keep their content.`,
      )
    ) {
      return;
    }
    setBusyId(template.id);
    try {
      await apiSend(`/api/proposal-templates/${template.id}`, 'DELETE');
      show('Deleted.');
      setReloadKey((key) => key + 1);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
    setBusyId(null);
  }

  return (
    <div className={s.screen}>
      <div className={s.wrap}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.pageTitle}>Templates</h1>
            <p className={s.pageSub}>
              Save the shape of a proposal you like, then start new ones from it. The default is
              pre-selected on the new proposal screen.
            </p>
          </div>
          <Link href="/admin/proposals" className={s.btn}>
            Back to proposals
          </Link>
        </div>

        <div className={s.card} style={{ marginBottom: 20 }}>
          <h2 className={s.cardTitle}>Save a proposal as a template</h2>
          <p className={s.pageSub} style={{ marginBottom: 14 }}>
            Copies the blocks and their wording. Nothing about the original proposal changes.
          </p>

          <div className={s.field}>
            <label className={s.label} htmlFor="template-source">
              Proposal to copy
            </label>
            <select
              id="template-source"
              className={s.select}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Choose a proposal…</option>
              {proposals.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {proposal.title} · {formatDate(proposal.proposal_date)}
                </option>
              ))}
            </select>
          </div>

          <div className={s.inlineRow}>
            <div className={s.field}>
              <label className={s.label} htmlFor="template-name">
                Template name
              </label>
              <input
                id="template-name"
                className={s.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Event marketing retainer"
              />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="template-description">
                Description
              </label>
              <input
                id="template-description"
                className={s.input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown on the new proposal screen"
              />
            </div>
          </div>

          <label className={s.toggleRow} htmlFor="template-scrub">
            <input
              id="template-scrub"
              type="checkbox"
              checked={scrub}
              onChange={(e) => setScrub(e.target.checked)}
            />
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
                Clear the client details
              </span>
              <span className={s.hint}>
                Blanks the cover subtitle, tagline, date, prepared-for and stats, and resets the
                client approval line. Scope, phases, pricing and the rest of your wording are kept.
              </span>
            </span>
          </label>

          <label className={s.toggleRow} htmlFor="template-default">
            <input
              id="template-default"
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
            />
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
                Make this the default
              </span>
              <span className={s.hint}>Pre-selected whenever you start a new proposal.</span>
            </span>
          </label>

          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={saving || !name.trim() || !sourceId}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>

        <div className={s.list}>
          {templates === null && <p className={s.empty}>Loading…</p>}
          {templates !== null && templates.length === 0 && (
            <p className={s.empty}>
              No templates yet. Save one above and it will appear on the new proposal screen.
            </p>
          )}

          {(templates ?? []).map((template) => (
            <div key={template.id} className={s.row} style={{ gridTemplateColumns: '1fr auto' }}>
              <div style={{ minWidth: 0 }}>
                <span className={s.rowTitle} style={{ cursor: 'default' }}>
                  {template.name}
                </span>
                {template.is_default && (
                  <span
                    className={`${s.badge} ${s.badgeSigned}`}
                    style={{ marginLeft: 8, textTransform: 'none' }}
                  >
                    Default
                  </span>
                )}
                <p className={s.rowMeta}>
                  {template.description ? `${template.description} · ` : ''}
                  {template.block_count} block{template.block_count === 1 ? '' : 's'} ·{' '}
                  {summariseTypes(template.block_types)}
                </p>
              </div>

              <div className={s.rowActions}>
                <Link
                  href={`/admin/proposals/new?template=${template.id}`}
                  className={`${s.btn} ${s.btnSmall}`}
                >
                  Use
                </Link>
                {!template.is_default && (
                  <button
                    type="button"
                    className={`${s.btn} ${s.btnSmall}`}
                    disabled={busyId === template.id}
                    onClick={() => makeTheDefault(template)}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  className={`${s.btn} ${s.btnSmall}`}
                  disabled={busyId === template.id}
                  onClick={() => rename(template)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnSmall} ${s.btnDanger}`}
                  disabled={busyId === template.id}
                  onClick={() => remove(template)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

/** "Cover, narrative, feature list + 10 more" — enough to tell two apart. */
function summariseTypes(types: string[]): string {
  const labels = types.map(
    (type) => BLOCK_LABELS[type as BlockType] ?? type.replace(/_/g, ' '),
  );
  const shown = labels.slice(0, 3).join(', ');
  const rest = labels.length - 3;
  return rest > 0 ? `${shown} + ${rest} more` : shown || 'empty';
}
