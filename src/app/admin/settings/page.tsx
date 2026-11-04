'use client';

// Settings: everything that's set once, in one place. Email (mailing
// address, replies, Outlook, Google Voice), Booking (the /book page's hours
// and days off) and Security (admin accounts and the live security checks).

import { useState } from 'react';
import w from '../crm/workspace.module.css';
import { EmailSettings } from './EmailSettings';
import { BookingSettingsPanel } from './BookingSettingsPanel';
import { SecuritySettings } from './SecuritySettings';

const TABS = [
  { id: 'email', label: 'Email' },
  { id: 'booking', label: 'Booking' },
  { id: 'security', label: 'Security' },
] as const;

type Tab = (typeof TABS)[number]['id'];

function tabFromUrl(): Tab {
  const t = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tab');
  return TABS.some((x) => x.id === t) ? (t as Tab) : 'email';
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>(tabFromUrl);

  function choose(t: Tab) {
    setTab(t);
    window.history.replaceState(null, '', `/admin/settings?tab=${t}`);
  }

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Settings</h1>
          <p className={w.sub}>Set once and forget: how email reaches people, when they can book a call, and who can sign in.</p>
        </div>
      </div>

      <div className={w.tabs} role="tablist" aria-label="Settings">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`${w.tab} ${tab === t.id ? w.tabOn : ''}`} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        {tab === 'email' && <EmailSettings />}
        {tab === 'booking' && <BookingSettingsPanel />}
        {tab === 'security' && <SecuritySettings />}
      </div>
    </div>
  );
}
