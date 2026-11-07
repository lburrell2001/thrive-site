'use client';

// For a meeting from the Outlook calendar: link it to a contact when the sync
// couldn't tell who it's with, or fix a guess made from the title
// (PATCH /api/crm/calendar/[id]).

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiSend } from '../proposals/adminApi';
import { useCrm } from './CrmContext';

export function MeetingLink({ eventId, contactId, matchedBy, onDone }: {
  eventId: string;
  contactId: string | null;
  matchedBy: 'email' | 'name' | 'manual' | null | undefined;
  onDone: () => void;
}) {
  const { contacts, notify } = useCrm();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listId = `meeting-contacts-${eventId}`;

  async function save(id: string | null) {
    setBusy(true);
    try {
      await apiSend(`/api/crm/calendar/${eventId}`, 'PATCH', { contact_id: id });
      notify(id ? 'Meeting linked.' : 'Meeting unlinked.');
      setOpen(false); setText('');
      onDone();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save', 'error');
    }
    setBusy(false);
  }

  function pick() {
    const q = text.trim().toLowerCase();
    const match = (contacts ?? []).find((c) => `${c.name}${c.company ? ` · ${c.company}` : ''}`.toLowerCase() === q)
      ?? (contacts ?? []).filter((c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase() === q);
    const one = Array.isArray(match) ? (match.length === 1 ? match[0] : null) : match;
    if (!one) { notify(Array.isArray(match) && match.length > 1 ? 'More than one contact matches — pick from the list.' : 'No contact by that name.', 'error'); return; }
    void save(one.id);
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (open) {
    return (
      <form style={{ display: 'flex', gap: 6 }} onClick={stop} onKeyDown={stop} onSubmit={(e) => { e.preventDefault(); pick(); }}>
        <input className={p.input} style={{ width: 180, padding: '4px 8px', fontSize: 12.5 }} list={listId} autoFocus value={text}
          onChange={(e) => setText(e.target.value)} placeholder="Contact name" aria-label="Contact for this meeting" />
        <datalist id={listId}>
          {(contacts ?? []).map((c) => <option key={c.id} value={`${c.name}${c.company ? ` · ${c.company}` : ''}`} />)}
        </datalist>
        <button type="submit" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={busy || !text.trim()}>Link</button>
        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setOpen(false)}>✕</button>
      </form>
    );
  }

  return (
    <span style={{ display: 'flex', gap: 6 }} onClick={stop} onKeyDown={stop}>
      {!contactId && (
        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setOpen(true)}>Link contact</button>
      )}
      {contactId && matchedBy !== 'email' && (
        <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy}
          title={matchedBy === 'name' ? 'Matched from a name in the title' : 'Linked by hand'}
          onClick={() => setOpen(true)}>Change</button>
      )}
      {contactId && matchedBy !== 'email' && (
        <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy} onClick={() => save(null)}>Not them</button>
      )}
    </span>
  );
}
