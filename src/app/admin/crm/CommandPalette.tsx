'use client';

// ⌘K: find anyone by name, company, email or tag, or jump to a page or an
// action. Arrow keys move, Enter opens, Escape closes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import w from './workspace.module.css';
import { LIFECYCLE_LABEL, avatarColor, initials, lifecycleOf } from './shared';
import type { CrmContactRow } from '@/types/crm';

const ACTIONS = [
  { label: 'Home', hint: 'Replies, follow-ups, inquiries, money waiting', href: '/admin' },
  { label: 'Pipeline', hint: 'The deal board', href: '/admin/crm/pipeline' },
  { label: 'New deal', hint: 'Open a deal with someone', href: '/admin/crm/pipeline?new=1' },
  { label: 'Prospects', hint: 'People to reach out to', href: '/admin/crm/prospects' },
  { label: 'Add prospects', hint: 'One, or paste a list', href: '/admin/crm/prospects?add=1' },
  { label: 'Contacts', hint: 'Everyone', href: '/admin/crm/contacts' },
  { label: 'Proposals', hint: 'Build, send and track', href: '/admin/crm/proposals' },
  { label: 'New proposal', hint: 'Start from the Thrive layout or a template', href: '/admin/crm/proposals/new' },
  { label: 'Estimates & invoices', hint: 'Type a list, get a PDF or a portal invoice', href: '/admin/invoices' },
  { label: 'Price list', hint: 'Services, add-ons and fees for estimates', href: '/admin/price-list' },
  { label: 'Clients', hint: 'Portal logins, projects, files', href: '/admin/clients' },
  { label: 'Questionnaires', hint: 'Onboarding questionnaires and responses', href: '/admin/questionnaires' },
  { label: 'Portal welcome', hint: 'Preview what new clients see first', href: '/admin/welcome-preview' },
  { label: 'Emails', hint: 'Newsletters, outreach, templates', href: '/admin/crm/emails' },
  { label: 'Campaigns', hint: 'Print and email, and what came of them', href: '/admin/crm/campaigns' },
  { label: 'Log a print campaign', hint: 'Postcard, flyer, mailer…', href: '/admin/crm/campaigns?new=1' },
  { label: 'Calls', hint: 'Logged and booked calls', href: '/admin/crm/calls' },
  { label: 'Analytics', hint: 'Traffic, sources, visitors', href: '/admin/analytics' },
  { label: 'Journal', hint: 'Articles', href: '/admin/journal' },
  { label: 'Portfolio', hint: 'Projects and case studies', href: '/admin/portfolio' },
  { label: 'Reviews', hint: 'Approve client reviews', href: '/admin/reviews' },
  { label: 'Settings', hint: 'Email, Outlook, booking hours, security', href: '/admin/settings' },
];

export function CommandPalette({ contacts, onClose, onOpenContact }: {
  contacts: CrmContactRow[];
  onClose: () => void;
  onOpenContact: (id: string) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const query = q.trim().toLowerCase();
  const people = useMemo(() => (query
    ? contacts.filter((c) => [c.name, c.company, c.job_title, c.email, c.phone, ...c.tags].some((v) => v?.toLowerCase().includes(query)))
    : [...contacts].sort((a, b) => b.last_touch_at.localeCompare(a.last_touch_at))
  ).slice(0, 8), [contacts, query]);
  const actions = useMemo(() => ACTIONS.filter((a) => !query || a.label.toLowerCase().includes(query)), [query]);

  const items = [
    ...people.map((c) => ({ key: c.id, run: () => onOpenContact(c.id) })),
    ...actions.map((a) => ({ key: a.href, run: () => { onClose(); router.push(a.href); } })),
  ];
  const current = Math.min(at, Math.max(items.length - 1, 0));

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[current]?.run(); }
  }

  return (
    <>
      <div className={w.paletteBack} onClick={onClose} />
      <div className={w.palette} role="dialog" aria-modal="true" aria-label="Search the CRM" onKeyDown={onKey}>
        <input
          ref={input}
          className={w.paletteInput}
          value={q}
          onChange={(e) => { setQ(e.target.value); setAt(0); }}
          placeholder="Search people, or type a page…"
          aria-label="Search"
        />
        <ul className={w.paletteList} role="listbox">
          {people.length > 0 && <li className={w.paletteGroup}>{query ? 'People' : 'Recent'}</li>}
          {people.map((c, idx) => {
            const stage = lifecycleOf(c);
            return (
              <li key={c.id} role="option" aria-selected={idx === current}>
                <button type="button" className={`${w.paletteItem} ${idx === current ? w.paletteActive : ''}`} onMouseEnter={() => setAt(idx)} onClick={() => onOpenContact(c.id)}>
                  <span className={w.avatar} style={{ background: avatarColor(c.id), width: 28, height: 28, fontSize: 11 }}>{initials(c.name, c.email)}</span>
                  <span className={w.itemMain}>
                    <span className={w.itemTitle} style={{ display: 'block' }}>{c.name || c.email}</span>
                    <span className={w.itemSub} style={{ display: 'block' }}>{[c.company, c.email].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={`${w.pill} ${w[`pill${LIFECYCLE_LABEL[stage]}` as 'pillLead']}`}>{LIFECYCLE_LABEL[stage]}</span>
                </button>
              </li>
            );
          })}
          {actions.length > 0 && <li className={w.paletteGroup}>Go to</li>}
          {actions.map((a, k) => {
            const idx = people.length + k;
            return (
              <li key={a.href} role="option" aria-selected={idx === current}>
                <button type="button" className={`${w.paletteItem} ${idx === current ? w.paletteActive : ''}`} onMouseEnter={() => setAt(idx)} onClick={() => { onClose(); router.push(a.href); }}>
                  <span style={{ fontWeight: 600 }}>{a.label}</span>
                  <span className={w.muted} style={{ fontSize: 12.5 }}>{a.hint}</span>
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className={w.empty}>No matches.</li>}
        </ul>
      </div>
    </>
  );
}
