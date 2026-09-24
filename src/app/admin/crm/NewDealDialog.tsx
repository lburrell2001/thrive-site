'use client';

// A new piece of work: with someone already in the CRM, or with a new
// contact created at the same time.

import { useEffect, useMemo, useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiSend } from '../proposals/adminApi';
import { CRM_STAGES, STAGE_LABEL, type CrmContact, type CrmContactRow, type CrmDeal, type CrmStage } from '@/types/crm';
import { parseDollars } from './shared';

export function NewDealDialog({ contacts, presetContactId, onClose, onCreated }: {
  contacts: CrmContactRow[];
  /** Start with this contact chosen, e.g. "New deal" from their drawer. */
  presetContactId?: string;
  onClose: () => void;
  onCreated: (contactId: string, dealId: string | null) => void;
}) {
  const [mode, setMode] = useState<'existing' | 'new'>(presetContactId || contacts.length ? 'existing' : 'new');
  const [contactId, setContactId] = useState(presetContactId ?? '');
  const [filter, setFilter] = useState('');

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('referral');

  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<CrmStage>('lead');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return contacts
      .filter((c) => !q || [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [contacts, filter]);

  const preset = contacts.find((c) => c.id === presetContactId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value_cents = parseDollars(value);
    if (value_cents === undefined) { setError('Enter the value as a number, e.g. 2500'); return; }
    if (mode === 'existing' && !contactId) { setError('Choose who the deal is with'); return; }
    setSaving(true); setError('');
    const deal = { title: title.trim(), stage, value_cents };
    try {
      if (mode === 'existing') {
        const created = await apiSend<CrmDeal>('/api/crm/deals', 'POST', { contact_id: contactId, ...deal });
        onCreated(contactId, created.id);
      } else {
        const created = await apiSend<{ contact: CrmContact; deal_id: string | null }>('/api/crm/contacts', 'POST', {
          name, company, email, phone, source: source.trim() || 'manual', deal,
        });
        onCreated(created.contact.id, created.deal_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add deal');
      setSaving(false);
    }
  }

  return (
    <>
      <div className={s.backdrop} onClick={onClose} style={{ zIndex: 60 }} />
      <form className={s.modal} style={{ zIndex: 61 }} role="dialog" aria-modal="true" aria-labelledby="new-deal-title" onSubmit={submit}>
        <h2 id="new-deal-title" className={s.modalTitle}>
          New deal{preset ? ` with ${preset.name || preset.email}` : ''}
        </h2>

        {!preset && (
          <div className={p.filters} role="tablist" aria-label="Who is it with?">
            <button type="button" role="tab" aria-selected={mode === 'existing'} className={`${p.filterChip} ${mode === 'existing' ? p.filterChipOn : ''}`} onClick={() => setMode('existing')} disabled={!contacts.length}>
              Existing contact
            </button>
            <button type="button" role="tab" aria-selected={mode === 'new'} className={`${p.filterChip} ${mode === 'new' ? p.filterChipOn : ''}`} onClick={() => setMode('new')}>
              New contact
            </button>
          </div>
        )}

        <div className={s.formGrid}>
          {!preset && mode === 'existing' && (
            <>
              <label className={s.full}>
                <span className={s.miniLabel}>Find contact</span>
                <input className={p.input} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name, company or email" autoFocus />
              </label>
              <label className={s.full}>
                <span className={s.miniLabel}>Contact</span>
                <select className={p.select} value={contactId} onChange={(e) => setContactId(e.target.value)} required size={Math.min(6, Math.max(2, matches.length))}>
                  {matches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.name || c.email, c.company].filter(Boolean).join(' · ')}{c.open_deals ? ` (${c.open_deals} open)` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {!preset && mode === 'new' && (
            <>
              <label className={s.full}>
                <span className={s.miniLabel}>Name</span>
                <input className={p.input} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </label>
              <label>
                <span className={s.miniLabel}>Company</span>
                <input className={p.input} value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label>
                <span className={s.miniLabel}>Source</span>
                <input className={p.input} value={source} onChange={(e) => setSource(e.target.value)} placeholder="referral, event, instagram…" />
              </label>
              <label>
                <span className={s.miniLabel}>Email</span>
                <input className={p.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                <span className={s.miniLabel}>Phone</span>
                <input className={p.input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </>
          )}

          <label className={s.full}>
            <span className={s.miniLabel}>What is the work?</span>
            <input className={p.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brand refresh, new website, monthly social…" required autoFocus={Boolean(preset)} />
          </label>
          <label>
            <span className={s.miniLabel}>Stage</span>
            <select className={p.select} value={stage} onChange={(e) => setStage(e.target.value as CrmStage)}>
              {CRM_STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}
            </select>
          </label>
          <label>
            <span className={s.miniLabel}>Estimated value ($)</span>
            <input className={p.input} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          </label>
        </div>

        {error && <p className={s.error}>{error}</p>}
        <div className={s.modalActions}>
          <button type="button" className={p.btn} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={saving || !title.trim() || (mode === 'new' && !preset && !name.trim())}>
            {saving ? 'Adding…' : 'Add deal'}
          </button>
        </div>
      </form>
    </>
  );
}
