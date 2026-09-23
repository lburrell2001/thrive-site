'use client';

import { useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import s from './crm.module.css';
import { apiSend } from '../proposals/adminApi';
import { CRM_STAGES, STAGE_LABEL, type CrmContact, type CrmStage } from '@/types/crm';
import { parseDollars } from './shared';

export function NewContactDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<CrmStage>('lead');
  const [value, setValue] = useState('');
  const [source, setSource] = useState('referral');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value_cents = parseDollars(value);
    if (value_cents === undefined) { setError('Enter the value as a number, e.g. 2500'); return; }
    setSaving(true); setError('');
    try {
      const created = await apiSend<CrmContact>('/api/crm/contacts', 'POST', {
        name, company, email, phone, stage, value_cents, source: source.trim() || 'manual',
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contact');
      setSaving(false);
    }
  }

  return (
    <>
      <div className={s.backdrop} onClick={onClose} />
      <form className={s.modal} role="dialog" aria-modal="true" aria-labelledby="new-contact-title" onSubmit={submit}>
        <h2 id="new-contact-title" className={s.modalTitle}>New contact</h2>
        <div className={s.formGrid}>
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
          <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add contact'}
          </button>
        </div>
      </form>
    </>
  );
}
