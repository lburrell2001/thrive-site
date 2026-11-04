'use client';

// Analytics: Traffic (the first-party report: sources, pages, search,
// what turned into inquiries and clients) and Visitors (who's browsing,
// by browser, last 30 days). Visitors used to be its own CRM page.

import { useState } from 'react';
import w from '../crm/workspace.module.css';
import { TrafficReport } from './TrafficReport';
import { VisitorsReport } from './VisitorsReport';

type Tab = 'traffic' | 'visitors';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'visitors' ? 'visitors' : 'traffic');

  function choose(t: Tab) {
    setTab(t);
    window.history.replaceState(null, '', t === 'traffic' ? '/admin/analytics' : '/admin/analytics?tab=visitors');
  }

  const tabs = (
    <div className={w.tabs} role="tablist" aria-label="Analytics" style={{ marginBottom: 18 }}>
      {(['traffic', 'visitors'] as const).map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${w.tab} ${tab === t ? w.tabOn : ''}`} onClick={() => choose(t)}>
          {t === 'traffic' ? 'Traffic' : 'Visitors'}
        </button>
      ))}
    </div>
  );

  return tab === 'traffic' ? <TrafficReport tabs={tabs} /> : <VisitorsReport tabs={tabs} />;
}
