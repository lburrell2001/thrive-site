'use client';

// The welcome a new client sees on first sign-in: one step at a time, like
// setting up a new phone. Welcome → your details → text updates → the portal
// at a glance → your questionnaires (if any) → all set. Saves to their own
// portal_clients row (the same columns Settings can change) and marks the
// welcome done on their auth user_metadata (src/lib/portalWelcome.ts), so it
// shows once. "Skip setup" finishes it straight away.
//
// With `preview` (admin → /admin/welcome-preview) it runs on the given data,
// saves nothing, and "Skip setup" / the last step start over instead.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabasePortal } from '@/lib/supabasePortal';
import { portalApi } from '@/lib/portalApi';
import { formatPhone, normalizePhone } from '@/lib/phone';
import SmsOptInLabel from '../../../components/SmsOptInLabel';
import s from './welcome.module.css';

type StepId = 'welcome' | 'profile' | 'texts' | 'tour' | 'questionnaires' | 'done';
type Assigned = { id: string; title: string; status: string; answered: number; total: number };
export type WelcomePreview = { name: string; company: string; projects: string[]; questionnaires: Assigned[] };

const PETALS = [
  { r: -78, c: '#e50586' }, { r: -40, c: '#0cf574' }, { r: 0, c: '#9409ce' }, { r: 40, c: '#3943b7' }, { r: 78, c: '#fd6100' },
];

function Icon({ name }: { name: 'user' | 'chat' | 'grid' | 'list' | 'folder' | 'lock' | 'card' }) {
  const paths: Record<string, string> = {
    user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M9 4h6v3H9zM7 5.5H5.5A1.5 1.5 0 0 0 4 7v12.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H17M8 12l2 2 4-4M8 17h8',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
    lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3M12 15v2',
    card: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM2 10h20M6 15h4',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={paths[name]} /></svg>;
}

/** One petal of the Thrive mark (same shape as the logo). */
function Petal({ r, c, i }: { r: number; c: string; i: number }) {
  return (
    <svg className={s.petal} viewBox="166 90 26 39" style={{ ['--r' as string]: `${r}deg`, animationDelay: `${0.15 + i * 0.07}s`, color: c, background: 'none', width: 40, height: 62, marginLeft: -20 }} aria-hidden>
      <path d="M187.37,123.58c-1.25,2.95-1.92,4.13-5.13,4.13h-3.86c-3.21,0-3.83-1.27-5.15-4.19-4.09-9.09-5.84-17.08-5.42-27.26.13-3.2,1.41-4.62,4.62-4.62h14.47c3.21,0,4.47,1.41,4.62,4.62.47,9.86-.42,18.54-4.16,27.32Z" fill="currentColor" />
    </svg>
  );
}

export default function WelcomeFlow({ preview: previewProp }: { preview?: WelcomePreview }) {
  // Read once: the admin preview remounts (key) to start over with new data.
  const [preview] = useState(previewProp);
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Assigned[]>([]);
  const [step, setStep] = useState(0);
  const [back, setBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (preview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preview data arrives as props
      setFullName(preview.name); setCompany(preview.company); setPhone(''); setSmsOptIn(false);
      setProjects(preview.projects); setQuestionnaires(preview.questionnaires); setStep(0); setReady(true);
      return;
    }
    (async () => {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) { router.replace('/portal/login'); return; }
      setUserId(user.id);
      const [{ data: me }, { data: proj }, qs] = await Promise.all([
        supabasePortal.from('portal_clients').select('full_name, company_name, phone, sms_opt_in').eq('id', user.id).maybeSingle(),
        supabasePortal.from('portal_projects').select('name, archived').eq('client_id', user.id),
        portalApi<{ assignments: Assigned[] }>('/api/portal/questionnaires').catch(() => ({ assignments: [] })),
      ]);
      // The profile starts as the email's first part; don't prefill that as a name.
      const emailName = user.email?.split('@')[0] ?? '';
      setFullName(me?.full_name && me.full_name !== emailName ? me.full_name : '');
      setCompany(me?.company_name ?? '');
      setPhone(formatPhone(me?.phone));
      setSmsOptIn(Boolean(me?.sms_opt_in));
      setProjects((proj ?? []).filter((p: { archived?: boolean }) => !p.archived).map((p: { name: string }) => p.name));
      setQuestionnaires(qs.assignments.filter((a) => a.status !== 'submitted'));
      setReady(true);
    })();
  }, [router, preview]);

  const steps: StepId[] = ['welcome', 'profile', 'texts', 'tour', ...(questionnaires.length ? ['questionnaires' as const] : []), 'done'];
  const id = steps[Math.min(step, steps.length - 1)];
  const firstName = fullName.trim().split(/\s+/)[0] || '';

  async function finish() {
    if (preview) return;
    await supabasePortal.auth.updateUser({ data: { portal_welcome_done: new Date().toISOString(), portal_welcome: null } });
  }

  function go(to: number) {
    setError('');
    setBack(to < step);
    setStep(to);
    if (steps[to] === 'done') finish();
  }

  async function saveProfile() {
    if (!fullName.trim()) { setError('Add your name so we know what to call you.'); return; }
    if (preview) { go(step + 1); return; }
    setBusy(true);
    const name = fullName.trim();
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const { error: e } = await supabasePortal.from('portal_clients')
      .update({ full_name: name, company_name: company.trim(), initials }).eq('id', userId);
    setBusy(false);
    if (e) { setError('That didn’t save. Try again.'); return; }
    go(step + 1);
  }

  async function saveTexts() {
    const normalized = normalizePhone(phone);
    if (phone.trim() && !normalized) { setError('Enter a mobile number like (555) 123-4567.'); return; }
    if (preview) { go(step + 1); return; }
    setBusy(true);
    const { error: e } = await supabasePortal.from('portal_clients')
      .update({ phone: normalized, sms_opt_in: Boolean(normalized) && smsOptIn }).eq('id', userId);
    setBusy(false);
    if (e) { setError('That didn’t save. Try again.'); return; }
    go(step + 1);
  }

  async function skipAll() {
    if (preview) { go(0); return; }
    await finish();
    router.replace('/portal/dashboard');
  }

  if (!ready) return <div className={`${s.screen} ${preview ? s.screenPreview : ''}`}><div className={`${s.card} ${s.dark}`} /></div>;

  const tone = id === 'welcome' ? s.dark : id === 'done' ? s.green : '';
  const showTop = id !== 'welcome';

  return (
    <div className={`${s.screen} ${preview ? s.screenPreview : ''}`}>
      <main className={`${s.card} ${tone}`} aria-live="polite">
        {showTop && (
          <div className={s.top}>
            {id !== 'done' ? <button type="button" className={s.back} onClick={() => go(step - 1)}>← Back</button> : <span />}
            <div className={s.progress} aria-label={`Step ${step} of ${steps.length - 1}`}>
              {steps.slice(1).map((st, i) => <span key={st} className={`${s.seg} ${i + 1 === step ? s.segOn : i + 1 < step ? s.segDone : ''}`} />)}
            </div>
            {id !== 'done' ? <button type="button" className={s.skip} onClick={skipAll}>Skip setup</button> : <span />}
          </div>
        )}

        <div key={id} className={`${s.body} ${back ? s.bodyBack : ''} ${id === 'welcome' || id === 'done' ? s.center : ''}`}>
          {id === 'welcome' && (
            <>
              <div className={s.petals} aria-hidden>
                {PETALS.map((p, i) => <Petal key={p.c} {...p} i={i} />)}
                <span className={s.square} />
              </div>
              <h1 className={s.title}>Welcome to Thrive{firstName ? <>, <em>{firstName}</em></> : ''}.</h1>
              <p className={s.lead}>This is your client portal: your project, files, questionnaires and invoices in one place. Let’s get you set up. It takes about two minutes.</p>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnLight}`} onClick={() => go(1)} autoFocus>Get Started</button>
              </div>
            </>
          )}

          {id === 'profile' && (
            <>
              <span className={`${s.icon} ${s.bMagenta}`}><Icon name="user" /></span>
              <h1 className={s.title}>First, Who Are We Talking To?</h1>
              <p className={s.lead}>This is how your name and business show up on proposals, invoices and messages from us.</p>
              <div className={s.content}>
                <label className={s.field}>Your name
                  <input className={s.input} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Jordan Smith" autoFocus />
                </label>
                <label className={s.field}>Business name
                  <input className={s.input} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" placeholder="Smith & Co." />
                </label>
                {error && <p className={s.error} role="alert">{error}</p>}
              </div>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnDark}`} disabled={busy} onClick={saveProfile}>{busy ? 'Saving…' : 'Continue'}</button>
              </div>
            </>
          )}

          {id === 'texts' && (
            <>
              <span className={`${s.icon} ${s.bBlue}`}><Icon name="chat" /></span>
              <h1 className={s.title}>Want Updates by Text?</h1>
              <p className={s.lead}>We’ll text you when there’s something to look at — a proposal, an invoice, new files. Never marketing. You can change this any time in Settings.</p>
              <div className={s.content}>
                <label className={s.field}>Mobile number
                  <input className={s.input} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                </label>
                <label className={`${s.consent} ${phone.trim() ? '' : s.consentOff}`}>
                  <input type="checkbox" checked={smsOptIn && Boolean(phone.trim())} disabled={!phone.trim()} onChange={(e) => setSmsOptIn(e.target.checked)} />
                  <span><SmsOptInLabel newTab linkStyle={{ color: 'inherit', textDecoration: 'underline' }} /></span>
                </label>
                {error && <p className={s.error} role="alert">{error}</p>}
              </div>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnDark}`} disabled={busy} onClick={saveTexts}>{busy ? 'Saving…' : 'Continue'}</button>
                <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => go(step + 1)}>Not now</button>
              </div>
            </>
          )}

          {id === 'tour' && (
            <>
              <span className={`${s.icon} ${s.bPurple}`}><Icon name="grid" /></span>
              <h1 className={s.title}>Your Portal, at a Glance</h1>
              <p className={s.lead}>{projects.length ? `Everything for ${projects.length === 1 ? projects[0] : 'your projects'} lives here.` : 'Everything for your project lives here.'} It’s in the menu any time.</p>
              <div className={`${s.content} ${s.tiles}`}>
                <div className={`${s.tile} ${s.bMagenta}`}><Icon name="list" /><div><p className={s.tileName}>Onboarding</p><p className={s.tileText}>Questionnaires and first steps</p></div></div>
                <div className={`${s.tile} ${s.bBlue}`}><Icon name="folder" /><div><p className={s.tileName}>My Projects</p><p className={s.tileText}>Progress, files and milestones</p></div></div>
                <div className={`${s.tile} ${s.bOrange}`}><Icon name="lock" /><div><p className={s.tileName}>Secure Vault</p><p className={s.tileText}>Share logins safely, never by text</p></div></div>
                <div className={`${s.tile} ${s.bGreen}`}><Icon name="card" /><div><p className={s.tileName}>Billing</p><p className={s.tileText}>Invoices and online payments</p></div></div>
              </div>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(step + 1)}>Continue</button>
              </div>
            </>
          )}

          {id === 'questionnaires' && (
            <>
              <span className={`${s.icon} ${s.bOrange}`}><Icon name="list" /></span>
              <h1 className={s.title}>Tell Us About Your Business</h1>
              <p className={s.lead}>{questionnaires.length === 1 ? 'We have one short questionnaire for you.' : `We have ${questionnaires.length} short questionnaires for you.`} Your answers save as you type, so you can do a little at a time.</p>
              <div className={`${s.content} ${s.qList}`}>
                {questionnaires.map((q, i) => (
                  <div key={q.id} className={s.qItem}>
                    <span className={s.qNum}>{i + 1}</span>
                    <div><p className={s.qName}>{q.title}</p><p className={s.qMeta}>{q.total} questions{q.answered ? ` · ${q.answered} answered` : ''}</p></div>
                  </div>
                ))}
              </div>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(step + 1)}>Continue</button>
              </div>
            </>
          )}

          {id === 'done' && (
            <>
              <svg className={s.check} viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="60" /><path d="M36 62l16 16 32-34" /></svg>
              <h1 className={s.title}>You’re All Set{firstName ? `, ${firstName}` : ''}.</h1>
              <p className={s.lead}>{questionnaires.length ? 'The best next step is your first questionnaire. It helps us hit the ground running.' : 'We’ll be in touch with next steps. Your dashboard has everything in the meantime.'}</p>
              {preview ? (
                <div className={s.actions}>
                  {questionnaires.length > 0 && <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(0)}>Start {questionnaires[0].title}</button>}
                  <button type="button" className={`${s.btn} ${questionnaires.length ? s.btnGhost : s.btnDark}`} onClick={() => go(0)}>Go to my dashboard</button>
                </div>
              ) : (
                <div className={s.actions}>
                  {questionnaires.length > 0 && (
                    <Link href={`/portal/onboarding/${questionnaires[0].id}`} className={`${s.btn} ${s.btnDark}`}>Start {questionnaires[0].title}</Link>
                  )}
                  <Link href="/portal/dashboard" className={`${s.btn} ${questionnaires.length ? s.btnGhost : s.btnDark}`}>Go to my dashboard</Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
