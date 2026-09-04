'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import s from '../proposals.module.css';
import { apiGet, apiSend, formatDate } from '../adminApi';
import { Toast, useToast } from '../Toast';

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
}

interface ProposalRow {
  id: string;
  title: string;
  proposal_date: string;
  proposal_clients: { name: string; company: string | null } | null;
}

type StartFrom = { kind: 'blank' } | { kind: 'template'; id: string } | { kind: 'copy'; id: string };

export default function NewProposalPage() {
  const router = useRouter();
  const { toast, show } = useToast();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [startFrom, setStartFrom] = useState<StartFrom>({ kind: 'blank' });
  const [creating, setCreating] = useState(false);

  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [addingClient, setAddingClient] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, c, p] = await Promise.allSettled([
        apiGet<TemplateRow[]>('/api/proposal-templates'),
        apiGet<ClientRow[]>('/api/proposal-clients'),
        apiGet<ProposalRow[]>('/api/proposals'),
      ]);
      if (t.status === 'fulfilled') setTemplates(t.value ?? []);
      if (c.status === 'fulfilled') setClients(c.value ?? []);
      if (p.status === 'fulfilled') setProposals(p.value ?? []);
      // An explicit ?template=<id> beats the default, which beats blank.
      const requested = new URLSearchParams(window.location.search).get('template');
      const available = t.status === 'fulfilled' ? t.value ?? [] : [];
      const chosen =
        available.find((row) => row.id === requested) ?? available.find((row) => row.is_default);
      if (chosen) setStartFrom({ kind: 'template', id: chosen.id });
    })();
  }, []);

  async function addClient() {
    if (!newClientName.trim()) return;
    setAddingClient(true);
    try {
      const created = await apiSend<ClientRow>('/api/proposal-clients', 'POST', {
        name: newClientName.trim(),
        company: newClientCompany.trim() || null,
        email: newClientEmail.trim() || null,
      });
      setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(created.id);
      setNewClientName('');
      setNewClientCompany('');
      setNewClientEmail('');
      show('Client added.');
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not add client', 'error');
    }
    setAddingClient(false);
  }

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const created = await apiSend<{ id: string }>('/api/proposals', 'POST', {
        title: title.trim(),
        clientId: clientId || null,
        templateId: startFrom.kind === 'template' ? startFrom.id : null,
        fromProposalId: startFrom.kind === 'copy' ? startFrom.id : null,
      });
      router.push(`/admin/proposals/${created.id}/edit`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not create proposal', 'error');
      setCreating(false);
    }
  }

  return (
    <div className={s.screen}>
      <div className={s.wrap} style={{ maxWidth: 720 }}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.pageTitle}>New proposal</h1>
            <p className={s.pageSub}>Name it, choose a client, and pick what to start from.</p>
          </div>
          <Link href="/admin/proposals" className={s.btn}>
            Cancel
          </Link>
        </div>

        <div className={s.card} style={{ marginBottom: 16 }}>
          <div className={s.field}>
            <label className={s.label} htmlFor="proposal-title">
              Proposal name
            </label>
            <input
              id="proposal-title"
              className={s.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dallas Derby Day — Event Marketing"
              autoFocus
            />
            <p className={s.hint}>
              The client sees this in their browser tab. The link is generated from it.
            </p>
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor="proposal-client">
              Client
            </label>
            <select
              id="proposal-client"
              className={s.select}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">No client yet</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company ? `${client.name} · ${client.company}` : client.name}
                </option>
              ))}
            </select>
          </div>

          <details>
            <summary
              style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#e40586' }}
            >
              Add a new client
            </summary>
            <div style={{ marginTop: 12 }}>
              <div className={s.inlineRow}>
                <div className={s.field}>
                  <label className={s.label}>Name</label>
                  <input
                    className={s.input}
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                </div>
                <div className={s.field}>
                  <label className={s.label}>Company</label>
                  <input
                    className={s.input}
                    value={newClientCompany}
                    onChange={(e) => setNewClientCompany(e.target.value)}
                  />
                </div>
              </div>
              <div className={s.field}>
                <label className={s.label}>Email</label>
                <input
                  className={s.input}
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={s.btn}
                disabled={addingClient || !newClientName.trim()}
                onClick={addClient}
              >
                {addingClient ? 'Adding…' : 'Add client'}
              </button>
            </div>
          </details>
        </div>

        <div className={s.card} style={{ marginBottom: 16 }}>
          <h2 className={s.cardTitle}>Start from</h2>
          <p className={s.pageSub} style={{ marginBottom: 12 }}>
            Copying a proposal you have already sent is usually the fastest route.
          </p>

          <div className={s.pickerGrid}>
            <StartOption
              selected={startFrom.kind === 'blank'}
              name="Blank proposal"
              description="An empty document. You add every block yourself."
              onSelect={() => setStartFrom({ kind: 'blank' })}
            />

            {templates.map((template) => (
              <StartOption
                key={template.id}
                selected={startFrom.kind === 'template' && startFrom.id === template.id}
                name={`${template.name}${template.is_default ? ' · default' : ''}`}
                description={template.description ?? 'Saved template'}
                onSelect={() => setStartFrom({ kind: 'template', id: template.id })}
              />
            ))}

            {proposals.map((proposal) => (
              <StartOption
                key={proposal.id}
                selected={startFrom.kind === 'copy' && startFrom.id === proposal.id}
                name={`Copy of ${proposal.title}`}
                description={`${
                  proposal.proposal_clients?.company ??
                  proposal.proposal_clients?.name ??
                  'No client'
                } · ${formatDate(proposal.proposal_date)}`}
                onSelect={() => setStartFrom({ kind: 'copy', id: proposal.id })}
              />
            ))}
          </div>

          {templates.length === 0 && (
            <p className={s.hint} style={{ marginTop: 10 }}>
              No saved templates yet — saving a proposal as a template arrives with the template
              library. Copying an existing proposal does the same job in the meantime.
            </p>
          )}
        </div>

        <button
          type="button"
          className={`${s.btn} ${s.btnPrimary}`}
          disabled={creating || !title.trim()}
          onClick={create}
        >
          {creating ? 'Creating…' : 'Create and edit'}
        </button>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

function StartOption({
  selected,
  name,
  description,
  onSelect,
}: {
  selected: boolean;
  name: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={s.pickerItem}
      onClick={onSelect}
      aria-pressed={selected}
      style={selected ? { borderColor: '#e40586', boxShadow: 'inset 0 0 0 1px #e40586' } : undefined}
    >
      <div className={s.pickerName}>{name}</div>
      <p className={s.pickerDesc}>{description}</p>
    </button>
  );
}
