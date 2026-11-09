'use client';

// Preview the portal welcome a new client sees (src/app/portal/(app)/welcome),
// right here in admin. Nothing is saved. With ?client=<portal id>&name=… it
// uses that client's name and their open questionnaires; otherwise sample data.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import w from '../crm/workspace.module.css';
import { apiGet } from '../proposals/adminApi';
import WelcomeFlow, { type WelcomePreview } from '@/app/portal/(app)/welcome/WelcomeFlow';

const SAMPLE_QUESTIONNAIRES: WelcomePreview['questionnaires'] = [
  { id: 'sample-1', title: 'About You', status: 'not_started', answered: 0, total: 12 },
  { id: 'sample-2', title: 'Website Development', status: 'not_started', answered: 0, total: 17 },
];

export default function WelcomePreviewPage() {
  return <Suspense fallback={null}><Preview /></Suspense>;
}

function Preview() {
  const params = useSearchParams();
  const clientId = params.get('client');
  const [name, setName] = useState(params.get('name') ?? 'Maria Lopez');
  const [company, setCompany] = useState(params.get('company') ?? 'Lopez Bakery');
  const [withQs, setWithQs] = useState(true);
  const [real, setReal] = useState<WelcomePreview['questionnaires'] | null>(null);
  const [run, setRun] = useState(0);

  // A real client's open questionnaires.
  useEffect(() => {
    if (!clientId) return;
    apiGet<{ assignments: (WelcomePreview['questionnaires'][number])[] }>(`/api/admin/questionnaires/assignments?client=${clientId}`)
      .then((r) => setReal(r.assignments.filter((a) => a.status !== 'submitted')))
      .catch(() => setReal([]));
  }, [clientId]);

  const questionnaires = withQs ? (clientId ? real ?? [] : SAMPLE_QUESTIONNAIRES) : [];
  const preview: WelcomePreview = { name, company, projects: [], questionnaires };

  return (
    <div className={`${w.page} ${w.pageWide}`}>
      <div className={w.head}>
        <div>
          <h1 className={w.title}>Portal Welcome</h1>
          <p className={w.sub}>What a new client sees the first time they open the portal. Click through it here — nothing is saved.</p>
        </div>
        <div className={w.headActions}>
          {clientId && <Link href={`/admin/clients?client=${clientId}`} className={p.btn}>← Back to client</Link>}
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setRun((n) => n + 1)}>Start over</button>
        </div>
      </div>
      <div className={w.toolbar}>
        <input className={p.input} style={{ maxWidth: 220 }} value={name} onChange={(e) => setName(e.target.value)} aria-label="Client name" placeholder="Client name" />
        <input className={p.input} style={{ maxWidth: 220 }} value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Business name" placeholder="Business name" />
        <div className={w.chips} role="group" aria-label="Questionnaires">
          <button type="button" className={`${w.chip} ${withQs ? w.chipOn : ''}`} onClick={() => { setWithQs(true); setRun((n) => n + 1); }}>With questionnaires</button>
          <button type="button" className={`${w.chip} ${!withQs ? w.chipOn : ''}`} onClick={() => { setWithQs(false); setRun((n) => n + 1); }}>Without</button>
        </div>
        {clientId && real && <span className={w.muted} style={{ fontSize: 13 }}>{real.length ? `${real.length} open questionnaire${real.length === 1 ? '' : 's'} for this client` : 'No open questionnaires for this client'}</span>}
      </div>
      <WelcomeFlow key={`${run}-${withQs}-${real?.length ?? 0}-${name}-${company}`} preview={preview} />
    </div>
  );
}
