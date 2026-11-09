'use client';

// The welcome a new client sees on first sign-in: one step at a time, like
// setting up a new phone. Welcome → your details → text updates → the portal
// at a glance → each open questionnaire (an intro, then its sections one
// screen at a time, answers saved as they type, submitted at the end) → all
// set. Only the site's own logo, logo mark and line icons (ThriveIcons).
// Saves profile fields to their portal_clients row, answers through
// /api/portal/questionnaires/[id], and marks the welcome done on their auth
// user_metadata (src/lib/portalWelcome.ts). "Skip setup" finishes at once.
//
// With `preview` (admin → /admin/welcome-preview) it runs on the given data,
// saves nothing, and "Skip setup" / the last step start over instead.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabasePortal } from '@/lib/supabasePortal';
import { portalApi, PortalApiError } from '@/lib/portalApi';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { isAnswered, isMulti, missingRequired, type AnswerValue, type Question, type Questionnaire } from '@/lib/questionnaires';
import { ThriveIcon, type ThriveIconName } from '@/app/_site/ThriveIcons';
import SmsOptInLabel from '../../../components/SmsOptInLabel';
import s from './welcome.module.css';

/** An open questionnaire: its visible sections and any answers so far. */
export type WelcomeQuestionnaire = { id: string; title: string; questionnaire: Questionnaire; answers: Record<string, AnswerValue> };
export type WelcomePreview = { name: string; company: string; projects: string[]; questionnaires: WelcomeQuestionnaire[] };

type Step =
  | { kind: 'welcome' | 'profile' | 'texts' | 'tour' | 'done' }
  | { kind: 'intro'; qi: number }
  | { kind: 'section'; qi: number; si: number };

const TEXT_DELAY = 800;

function Badge({ icon, tone }: { icon: ThriveIconName; tone: string }) {
  return <span className={`${s.icon} ${tone}`}><ThriveIcon name={icon} /></span>;
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
  const [qs, setQs] = useState<WelcomeQuestionnaire[]>([]);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [back, setBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [ready, setReady] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, { aid: string; qid: string; value: AnswerValue }>());

  useEffect(() => {
    if (preview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preview data arrives as props
      setFullName(preview.name); setCompany(preview.company); setProjects(preview.projects); setQs(preview.questionnaires); setReady(true);
      return;
    }
    (async () => {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) { router.replace('/portal/login'); return; }
      setUserId(user.id);
      const [{ data: me }, { data: proj }, list] = await Promise.all([
        supabasePortal.from('portal_clients').select('full_name, company_name, phone, sms_opt_in').eq('id', user.id).maybeSingle(),
        supabasePortal.from('portal_projects').select('name, archived').eq('client_id', user.id),
        portalApi<{ assignments: { id: string; status: string }[] }>('/api/portal/questionnaires').catch(() => ({ assignments: [] })),
      ]);
      const open = list.assignments.filter((a) => a.status !== 'submitted');
      const details = await Promise.all(open.map((a) =>
        portalApi<{ assignment: { title: string }; questionnaire: Questionnaire; answers: Record<string, AnswerValue> }>(`/api/portal/questionnaires/${a.id}`)
          .then((d) => ({ id: a.id, title: d.assignment.title, questionnaire: d.questionnaire, answers: d.answers }))
          .catch(() => null)));
      const emailName = user.email?.split('@')[0] ?? '';
      setFullName(me?.full_name && me.full_name !== emailName ? me.full_name : '');
      setCompany(me?.company_name ?? '');
      setPhone(formatPhone(me?.phone));
      setSmsOptIn(Boolean(me?.sms_opt_in));
      setProjects((proj ?? []).filter((p: { archived?: boolean }) => !p.archived).map((p: { name: string }) => p.name));
      setQs(details.filter((d): d is WelcomeQuestionnaire => Boolean(d)).filter((d) => d.questionnaire.sections.length > 0));
      setReady(true);
    })();
  }, [router, preview]);

  // ---- answers: saved as they type (text after a pause, choices at once)
  const send = useCallback(async (aid: string, qid: string, value: AnswerValue) => {
    if (preview) return;
    try {
      await portalApi(`/api/portal/questionnaires/${aid}`, { body: { action: 'answer', questionId: qid, value } });
      if (pending.current.size === 0) setSaveNote('Saved');
    } catch (e) {
      setSaveNote(e instanceof Error ? e.message : 'Not saved');
    }
  }, [preview]);

  const flush = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    const all = [...pending.current.values()];
    pending.current.clear();
    return Promise.all(all.map((p) => send(p.aid, p.qid, p.value)));
  }, [send]);

  useEffect(() => () => { flush(); }, [flush]);

  function answer(qi: number, q: Question, value: AnswerValue, typed: boolean) {
    const aid = qs[qi].id;
    setQs((cur) => cur.map((x, i) => (i === qi ? { ...x, answers: { ...x.answers, [q.id]: value } } : x)));
    if (isAnswered(value)) { setMissing((m) => m.filter((x) => x !== q.id)); setError(''); }
    const key = `${aid}:${q.id}`;
    const prev = timers.current.get(key);
    if (prev) clearTimeout(prev);
    if (preview) return;
    if (!typed) { pending.current.delete(key); send(aid, q.id, value); return; }
    setSaveNote('Saving…');
    pending.current.set(key, { aid, qid: q.id, value });
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      const p = pending.current.get(key);
      pending.current.delete(key);
      if (p) send(p.aid, p.qid, p.value);
    }, TEXT_DELAY));
  }

  // ---- the steps
  const steps: Step[] = [
    { kind: 'welcome' }, { kind: 'profile' }, { kind: 'texts' }, { kind: 'tour' },
    ...qs.flatMap((q, qi): Step[] => [{ kind: 'intro', qi }, ...q.questionnaire.sections.map((_, si): Step => ({ kind: 'section', qi, si }))]),
    { kind: 'done' },
  ];
  const cur = steps[Math.min(step, steps.length - 1)];
  const firstName = fullName.trim().split(/\s+/)[0] || '';
  const pct = Math.round((step / (steps.length - 1)) * 100);
  const openLeft = qs.filter((q) => !submitted.includes(q.id));

  async function finish() {
    if (preview) return;
    await supabasePortal.auth.updateUser({ data: { portal_welcome_done: new Date().toISOString(), portal_welcome: null } });
  }

  function go(to: number) {
    flush();
    setError('');
    setBack(to < step);
    setStep(to);
    if (steps[to]?.kind === 'done') finish();
  }

  /** The step after this questionnaire's last section (its "do this later"). */
  const afterQuestionnaire = (qi: number) => steps.findIndex((st, i) => i > step && (st.kind === 'done' || (st.kind === 'intro' && st.qi > qi)));

  async function saveProfile() {
    if (!fullName.trim()) { setError('Add your name so we know what to call you.'); return; }
    if (preview) { go(step + 1); return; }
    setBusy(true);
    const name = fullName.trim();
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const { error: e } = await supabasePortal.from('portal_clients').update({ full_name: name, company_name: company.trim(), initials }).eq('id', userId);
    setBusy(false);
    if (e) { setError('That didn’t save. Try again.'); return; }
    go(step + 1);
  }

  async function saveTexts() {
    const normalized = normalizePhone(phone);
    if (phone.trim() && !normalized) { setError('Enter a mobile number like (555) 123-4567.'); return; }
    if (preview) { go(step + 1); return; }
    setBusy(true);
    const { error: e } = await supabasePortal.from('portal_clients').update({ phone: normalized, sms_opt_in: Boolean(normalized) && smsOptIn }).eq('id', userId);
    setBusy(false);
    if (e) { setError('That didn’t save. Try again.'); return; }
    go(step + 1);
  }

  /** Last section of a questionnaire: check required answers, submit, move on. */
  async function submitQuestionnaire(qi: number) {
    const q = qs[qi];
    const left = missingRequired(q.questionnaire.sections, [], q.answers);
    if (left.length) {
      setMissing(left);
      const si = q.questionnaire.sections.findIndex((sec) => sec.questions.some((x) => left.includes(x.id)));
      setError(`${left.length} required question${left.length === 1 ? '' : 's'} still need${left.length === 1 ? 's' : ''} an answer.`);
      const target = steps.findIndex((st) => st.kind === 'section' && st.qi === qi && st.si === si);
      if (target >= 0 && target !== step) { setBack(true); setStep(target); }
      return;
    }
    setBusy(true);
    await flush();
    if (!preview) {
      try {
        await portalApi(`/api/portal/questionnaires/${q.id}`, { body: { action: 'submit' } });
      } catch (e) {
        setBusy(false);
        if (e instanceof PortalApiError && Array.isArray(e.body.missing)) setMissing(e.body.missing as string[]);
        setError(e instanceof Error ? e.message : 'Could not submit. Try again.');
        return;
      }
    }
    setBusy(false);
    setSubmitted((x) => [...x, q.id]);
    go(step + 1);
  }

  async function skipAll() {
    if (preview) { go(0); return; }
    await flush();
    await finish();
    router.replace('/portal/dashboard');
  }

  if (!ready) return <div className={`${s.screen} ${s.dark} ${preview ? s.screenPreview : ''}`} />;

  const tone = cur.kind === 'welcome' ? s.dark : '';

  return (
    <main className={`${s.screen} ${tone} ${preview ? s.screenPreview : ''}`} aria-live="polite">
        {cur.kind !== 'welcome' && (
          <>
            <div className={s.line} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
            <div className={s.top}>
              {cur.kind !== 'done' ? <button type="button" className={s.back} onClick={() => go(step - 1)}>‹ Back</button> : <span />}
              {cur.kind !== 'done' ? <button type="button" className={s.skip} onClick={skipAll}>Skip setup</button> : <span />}
            </div>
          </>
        )}

        <div key={step} className={`${s.body} ${back ? s.bodyBack : ''} ${cur.kind === 'welcome' || cur.kind === 'done' ? s.center : ''} ${cur.kind === 'welcome' ? s.wide : ''}`}>
          {cur.kind === 'welcome' && (
            <>
              <h1 className={s.hello}>
                <span className={s.helloRow}>Welcome to<img src="/new-thrive/logo-white.svg" alt="Thrive" className={s.helloLogo} /></span>
                {firstName && <span className={s.helloName}>{firstName}.</span>}
              </h1>
              <p className={s.lead}>This is your client portal: your project, files, questionnaires and invoices in one place. Let’s get you set up — it only takes a few minutes.</p>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnLight}`} onClick={() => go(1)} autoFocus>Get Started</button>
              </div>
            </>
          )}

          {cur.kind === 'profile' && (
            <>
              <Badge icon="person" tone={s.bMagenta} />
              <h1 className={s.title}>First, Who Are We Talking To?</h1>
              <p className={s.lead}>This is how your name and business show up on proposals, invoices and messages from us.</p>
              <div className={`${s.content} ${s.narrow}`}>
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

          {cur.kind === 'texts' && (
            <>
              <Badge icon="social" tone={s.bBlue} />
              <h1 className={s.title}>Want Updates by Text?</h1>
              <p className={s.lead}>We’ll text you when there’s something to look at — a proposal, an invoice, new files. Never marketing. You can change this any time in Settings.</p>
              <div className={`${s.content} ${s.narrow}`}>
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

          {cur.kind === 'tour' && (
            <>
              <Badge icon="brand" tone={s.bPurple} />
              <h1 className={s.title}>Your Portal, at a Glance</h1>
              <p className={s.lead}>{projects.length === 1 ? `Everything for ${projects[0]} lives here.` : 'Everything for your project lives here.'} It’s all in the menu any time.</p>
              <div className={`${s.content} ${s.tiles}`}>
                <div className={`${s.tile} ${s.bMagenta}`}><ThriveIcon name="edit" /><div><p className={s.tileName}>Onboarding</p><p className={s.tileText}>Questionnaires and first steps</p></div></div>
                <div className={`${s.tile} ${s.bBlue}`}><ThriveIcon name="folder" /><div><p className={s.tileName}>My Projects</p><p className={s.tileText}>Progress, files and milestones</p></div></div>
                <div className={`${s.tile} ${s.bOrange}`}><ThriveIcon name="box" /><div><p className={s.tileName}>Secure Vault</p><p className={s.tileText}>Share logins safely, never by text</p></div></div>
                <div className={`${s.tile} ${s.bGreen}`}><ThriveIcon name="card" /><div><p className={s.tileName}>Billing</p><p className={s.tileText}>Invoices and online payments</p></div></div>
              </div>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(step + 1)}>Continue</button>
              </div>
            </>
          )}

          {cur.kind === 'intro' && (() => {
            const q = qs[cur.qi];
            const total = q.questionnaire.sections.reduce((n, sec) => n + sec.questions.length, 0);
            return (
              <>
                <Badge icon="edit" tone={s.bOrange} />
                <p className={s.kicker}>Questionnaire {cur.qi + 1} of {qs.length}</p>
                <h1 className={s.title}>{q.title}</h1>
                <p className={s.lead}>{q.questionnaire.description || 'A few questions so we can get your project started on the right foot.'}</p>
                <div className={`${s.content} ${s.list}`}>
                  {q.questionnaire.sections.map((sec, i) => (
                    <div key={sec.id} className={s.listItem}>
                      <span className={s.listNum}>{i + 1}</span>
                      <div><p className={s.listName}>{sec.title}</p><p className={s.listMeta}>{sec.questions.length} question{sec.questions.length === 1 ? '' : 's'}</p></div>
                    </div>
                  ))}
                </div>
                <p className={s.note}>{total} questions in all. Answers save as you type, so you can stop and finish later from Onboarding.</p>
                <div className={s.actions}>
                  <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(step + 1)}>Start</button>
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => go(afterQuestionnaire(cur.qi))}>Do this later</button>
                </div>
              </>
            );
          })()}

          {cur.kind === 'section' && (() => {
            const q = qs[cur.qi];
            const sec = q.questionnaire.sections[cur.si];
            const last = cur.si === q.questionnaire.sections.length - 1;
            return (
              <>
                <p className={s.kicker}>{q.title} · {cur.si + 1} of {q.questionnaire.sections.length}</p>
                <h1 className={`${s.title} ${s.titleSm}`}>{sec.title}</h1>
                {sec.description && <p className={s.lead}>{sec.description}</p>}
                <div className={`${s.content} ${s.questions}`}>
                  {sec.questions.map((x) => (
                    <WelcomeQuestion key={x.id} q={x} value={q.answers[x.id] ?? null} missing={missing.includes(x.id)} onChange={(v, typed) => answer(cur.qi, x, v, typed)} />
                  ))}
                </div>
                {error && <p className={s.error} role="alert">{error}</p>}
                <div className={s.actions}>
                  {!preview && saveNote && <p className={s.saved} aria-live="polite">{saveNote}</p>}
                  {last
                    ? <button type="button" className={`${s.btn} ${s.btnDark}`} disabled={busy} onClick={() => submitQuestionnaire(cur.qi)}>{busy ? 'Submitting…' : `Submit ${q.title}`}</button>
                    : <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(step + 1)}>Next</button>}
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => go(afterQuestionnaire(cur.qi))}>Finish later</button>
                </div>
              </>
            );
          })()}

          {cur.kind === 'done' && (
            <>
              <img src="/new-thrive/logo-mark-blk.svg" alt="" className={s.mark} />
              <h1 className={s.title}>You’re All Set{firstName ? `, ${firstName}` : ''}.</h1>
              <p className={s.lead}>
                {submitted.length ? `Thanks for filling out ${submitted.length === 1 ? 'your questionnaire' : 'your questionnaires'}. ` : ''}
                {openLeft.length ? 'You can finish the rest any time from Onboarding.' : 'We’ll be in touch with next steps. Your dashboard has everything in the meantime.'}
              </p>
              <div className={s.actions}>
                {preview
                  ? <button type="button" className={`${s.btn} ${s.btnDark}`} onClick={() => go(0)}>Go to my dashboard</button>
                  : <Link href={openLeft.length ? '/portal/onboarding' : '/portal/dashboard'} className={`${s.btn} ${s.btnDark}`}>{openLeft.length ? 'Go to Onboarding' : 'Go to my dashboard'}</Link>}
              </div>
            </>
          )}
        </div>
    </main>
  );
}

/** A questionnaire question, in the welcome's look. */
function WelcomeQuestion({ q, value, missing, onChange }: {
  q: Question;
  value: AnswerValue;
  missing: boolean;
  onChange: (v: AnswerValue, typed: boolean) => void;
}) {
  const id = `wq-${q.id}`;
  const str = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? (value as string[]) : [];
  let field: React.ReactNode;
  switch (q.type) {
    case 'short_text':
      field = <input id={id} className={s.input} value={str} maxLength={1000} onChange={(e) => onChange(e.target.value, true)} />;
      break;
    case 'long_text':
      field = <textarea id={id} className={`${s.input} ${s.textarea}`} value={str} maxLength={20000} onChange={(e) => onChange(e.target.value, true)} />;
      break;
    case 'url':
      field = <input id={id} className={s.input} type="url" inputMode="url" placeholder="https://" value={str} onChange={(e) => onChange(e.target.value, true)} />;
      break;
    case 'date':
      field = <input id={id} className={s.input} type="date" value={str} onChange={(e) => onChange(e.target.value || null, false)} />;
      break;
    case 'yes_no':
      field = (
        <div className={s.choices} role="radiogroup" aria-labelledby={`${id}-l`}>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={`${s.choice} ${value === v ? s.choiceOn : ''}`} onClick={() => onChange(value === v ? null : v, false)}>{v ? 'Yes' : 'No'}</button>
          ))}
        </div>
      );
      break;
    case 'single_choice':
      field = (
        <div className={s.choices} role="radiogroup" aria-labelledby={`${id}-l`}>
          {q.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={str === o} className={`${s.choice} ${str === o ? s.choiceOn : ''}`} onClick={() => onChange(str === o ? null : o, false)}>{o}</button>
          ))}
        </div>
      );
      break;
    case 'multi_choice':
    case 'checkbox_list':
      field = (
        <div className={s.choices} role="group" aria-labelledby={`${id}-l`}>
          {q.options.map((o) => {
            const on = list.includes(o);
            return (
              <button key={o} type="button" role="checkbox" aria-checked={on} className={`${s.choice} ${on ? s.choiceOn : ''}`}
                onClick={() => { const next = on ? list.filter((x) => x !== o) : [...list, o]; onChange(next.length ? next : null, false); }}>{o}</button>
            );
          })}
        </div>
      );
      break;
    case 'file_upload':
      field = <p className={s.note}>You can upload files for this one from Onboarding in your portal.</p>;
      break;
  }
  const labelled = ['short_text', 'long_text', 'url', 'date'].includes(q.type);
  return (
    <div className={`${s.question} ${missing ? s.questionMissing : ''}`}>
      {labelled
        ? <label htmlFor={id} id={`${id}-l`} className={s.prompt}>{q.prompt}{q.is_required && <span className={s.req}> *</span>}</label>
        : <p id={`${id}-l`} className={s.prompt}>{q.prompt}{q.is_required && <span className={s.req}> *</span>}</p>}
      {q.help_text && <p className={s.help}>{q.help_text}</p>}
      {isMulti(q.type) && <p className={s.help}>Pick as many as you like.</p>}
      {field}
      {missing && <p className={s.error}>This one’s required.</p>}
    </div>
  );
}
