'use client';

// "Log a print campaign": name, piece, date, cost, and where its QR code
// lands. Used on Campaigns and from a selection on the Prospects page.

import { useState } from 'react';
import p from '../../proposals/proposals.module.css';
import w from '../workspace.module.css';
import { apiSend } from '../../proposals/adminApi';
import { parseDollars } from '../shared';
import { PIECE_LABEL } from './shared';

const DESTINATIONS = [
  { path: '/', label: 'Homepage' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/services', label: 'Services' },
  { path: '/book', label: 'Book a call' },
  { path: '/contact', label: 'Contact form' },
];

export function NewPrintCampaign({ onClose, onCreated, notify, contactIds = [] }: {
  onClose: () => void;
  onCreated: (id: string) => void;
  notify: (m: string, t?: 'ok' | 'error') => void;
  /** Add these people straight away (from the Prospects page). */
  contactIds?: string[];
}) {
  const [name, setName] = useState('');
  const [piece, setPiece] = useState('postcard');
  const [sentOn, setSentOn] = useState(new Date().toLocaleDateString('en-CA'));
  const [cost, setCost] = useState('');
  const [destination, setDestination] = useState('/');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseDollars(cost);
    if (cents === undefined) { setError('Cost: numbers only'); return; }
    setBusy(true); setError('');
    try {
      const created = await apiSend<{ id: string }>('/api/campaigns', 'POST', { name, piece, sent_on: sentOn || null, cost_cents: cents, destination });
      if (contactIds.length) await apiSend(`/api/campaigns/${created.id}/recipients`, 'POST', { contact_ids: contactIds });
      notify('Campaign created.');
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create');
      setBusy(false);
    }
  }

  return (
    <>
      <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => !busy && onClose()} />
      <form className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="new-print-title" onSubmit={submit}>
        <h2 id="new-print-title" className={w.dialogTitle}>Log a print campaign</h2>
        <p className={w.muted} style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
          You’ll get a QR code and short link for this piece. Put it on the design — every scan, and any inquiry that follows, is counted here.
          {contactIds.length ? ` The ${contactIds.length} people you selected will be added.` : ''}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ gridColumn: '1 / -1' }}><span className={p.label}>Name</span><input className={p.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall postcard — restaurants" required autoFocus /></label>
          <label><span className={p.label}>Piece</span>
            <select className={p.select} value={piece} onChange={(e) => setPiece(e.target.value)}>
              {['postcard', 'flyer', 'letter', 'door_hanger', 'brochure', 'leave_behind', 'other'].map((x) => <option key={x} value={x}>{PIECE_LABEL[x]}</option>)}
            </select>
          </label>
          <label><span className={p.label}>Sent (or going out)</span><input className={p.input} type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} /></label>
          <label><span className={p.label}>Total cost ($)</span><input className={p.input} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Printing + postage" /></label>
          <label><span className={p.label}>QR code opens</span>
            <select className={p.select} value={destination} onChange={(e) => setDestination(e.target.value)}>
              {DESTINATIONS.map((d) => <option key={d.path} value={d.path}>{d.label}</option>)}
            </select>
          </label>
        </div>
        {error && <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" className={p.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={`${p.btn} ${p.btnPrimary}`} disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </>
  );
}
