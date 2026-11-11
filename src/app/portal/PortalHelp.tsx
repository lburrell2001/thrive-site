'use client';

// The portal's help corner: a "?" button always in the bottom-right with
// "Take the tour", "Something isn't working" (a message to Lauren, filed as a
// portal request) and an email link; and the tour itself — a short walk
// through the sidebar that highlights each part of the portal.
//
// Every client is asked once whether they'd like the tour (the first time
// they're in the portal after it arrived, or after the welcome for a brand
// new client). Taking it or saying "Not now" stamps
// user_metadata.portal_tour_seen, so they're never asked again; the ? button
// can always start it.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabasePortal } from '@/lib/supabasePortal';
import { portalApi } from '@/lib/portalApi';
import { portalTrack } from '@/lib/portalTrack';

type Step = { target: string | null; title: string; body: string; nav?: boolean };
const STEPS: Step[] = [
  { target: null, title: 'Welcome to your portal', body: 'A one-minute look around, so you know where everything lives. You can leave any time.' },
  { target: '/portal/dashboard', nav: true, title: 'Dashboard', body: 'What’s happening right now: your projects, invoices due, milestones coming up and what we’ve been working on.' },
  { target: '/portal/onboarding', nav: true, title: 'Onboarding', body: 'Questionnaires and first steps for your project. Your answers save as you go, so you can come back to them.' },
  { target: '/portal/progress', nav: true, title: 'My Projects', body: 'Each project’s progress, files, milestones and requests. Completion reports land here when a project wraps up.' },
  { target: '/portal/proposals', nav: true, title: 'Proposals', body: 'Read your proposals and sign them here. Signing sets up your invoice straight away.' },
  { target: '/portal/vault', nav: true, title: 'Secure Vault', body: 'Share website, hosting or social logins safely, instead of texting or emailing passwords.' },
  { target: '/portal/invoices', nav: true, title: 'Billing', body: 'Your invoices: accept or decline them, download PDFs and pay by card.' },
  { target: '/portal/settings', nav: true, title: 'Settings', body: 'Your name, business and phone, and whether you’d like text updates.' },
  { target: 'help', title: 'Help is always here', body: 'Tap ? any time to take this tour again or tell us if something isn’t working. It comes straight to Lauren.' },
];

const PINK = '#e50586';
const INK = '#141414';

async function markTourSeen() {
  try { await supabasePortal.auth.updateUser({ data: { portal_tour_seen: new Date().toISOString() } }); } catch { /* try again next time */ }
}

export default function PortalHelp({ openNav, enabled = true }: {
  /** Opens the sidebar on phones while the tour points at it. */
  openNav: (open: boolean) => void;
  /** False on screens where the corner shouldn't show (the welcome). */
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [support, setSupport] = useState<{ topic: 'broken' | 'question' | 'billing' | 'other'; message: string; busy: boolean; error: string; sent: boolean } | null>(null);

  // Ask once: everyone who hasn't been asked yet, the next time they're in.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabasePortal.auth.getSession().then(({ data }) => {
      const seen = (data.session?.user.user_metadata as Record<string, unknown> | undefined)?.portal_tour_seen;
      if (!cancelled && data.session && !seen) setAsking(true);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  const start = useCallback(() => {
    setMenu(false); setAsking(false);
    void markTourSeen();
    void portalTrack('action', { label: 'Took the portal tour' });
    setStep(0);
  }, []);

  const finish = useCallback(() => {
    setStep(null); setRect(null);
    openNav(false);
  }, [openNav]);

  // Where the highlighted thing is; on phones the sidebar opens for the nav steps.
  const current = step === null ? null : STEPS[step];
  useLayoutEffect(() => {
    if (!current) return;
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    if (!desktop) openNav(!!current.nav);
    const measure = () => {
      const el = current.target ? document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`) : null;
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.right > 0 && r.left < window.innerWidth ? r : null);
    };
    // The sidebar slides in on phones; measure again once it has.
    measure();
    const t = setTimeout(measure, 260);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [current, openNav]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setStep((s) => (s !== null && s < STEPS.length - 1 ? s + 1 : s));
      if (e.key === 'ArrowLeft') setStep((s) => (s ? s - 1 : s));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, finish]);

  async function sendSupport() {
    if (!support) return;
    setSupport({ ...support, busy: true, error: '' });
    try {
      await portalApi('/api/portal/support', { body: { topic: support.topic, message: support.message, page: pathname } });
      setSupport({ ...support, busy: false, sent: true });
    } catch (e) {
      setSupport({ ...support, busy: false, error: e instanceof Error ? e.message : 'That didn’t send. Email hello@thrivecreativestudios.org instead.' });
    }
  }

  if (!enabled) return null;

  // The card sits beside the highlight (right of the sidebar), or centred.
  const cardStyle: React.CSSProperties = rect && rect.right + 360 < window.innerWidth
    ? { left: rect.right + 18, top: Math.max(16, Math.min(rect.top - 12, window.innerHeight - 260)) }
    : rect && rect.top > window.innerHeight / 2
      ? { left: '50%', transform: 'translateX(-50%)', bottom: window.innerHeight - rect.top + 18 }
      : rect
        ? { left: '50%', transform: 'translateX(-50%)', top: Math.min(rect.bottom + 18, window.innerHeight - 260) }
        : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <>
      {/* The ? corner */}
      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {menu && (
          <div role="menu" style={{ width: 260, background: '#fff', borderRadius: 18, boxShadow: '0 18px 50px rgba(0,0,0,0.18)', border: '1px solid #e6e6e6', padding: 8, display: 'grid', gap: 2 }}>
            <p style={{ margin: '6px 10px 4px', fontSize: 13, color: '#6b6b6b' }}>How can we help?</p>
            {[
              ['Take the tour', start],
              ['Something isn’t working', () => { setMenu(false); setSupport({ topic: 'broken', message: '', busy: false, error: '', sent: false }); }],
              ['Ask a question', () => { setMenu(false); setSupport({ topic: 'question', message: '', busy: false, error: '', sent: false }); }],
            ].map(([label, fn]) => (
              <button key={label as string} type="button" role="menuitem" onClick={fn as () => void}
                style={{ textAlign: 'left', border: 0, background: 'none', padding: '10px 12px', borderRadius: 12, fontSize: 14, fontWeight: 600, color: INK, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                {label as string}
              </button>
            ))}
            <a href="mailto:hello@thrivecreativestudios.org" style={{ padding: '10px 12px', fontSize: 13, color: '#6b6b6b' }}>Or email hello@thrivecreativestudios.org</a>
          </div>
        )}
        <button type="button" data-tour="help" aria-label="Help" aria-expanded={menu} onClick={() => setMenu((m) => !m)}
          style={{ width: 52, height: 52, borderRadius: 999, border: 0, background: menu ? PINK : INK, color: '#fff', fontSize: 24, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.22)' }}>
          {menu ? '×' : '?'}
        </button>
      </div>

      {/* Asked once */}
      {asking && step === null && (
        <div role="dialog" aria-labelledby="tour-ask" style={{ position: 'fixed', right: 18, bottom: 84, zIndex: 61, width: 'min(320px, calc(100vw - 36px))', background: INK, color: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 18px 50px rgba(0,0,0,0.25)' }}>
          <h2 id="tour-ask" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.065em' }}>Take a quick tour?</h2>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: '#d4d4d4' }}>A one-minute look at where everything lives in your portal.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={start} style={{ flex: 1, border: 0, borderRadius: 999, padding: '10px 14px', background: PINK, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Show me around</button>
            <button type="button" onClick={() => { setAsking(false); void markTourSeen(); }} style={{ border: '1.5px solid #6b6b6b', borderRadius: 999, padding: '10px 14px', background: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Not now</button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#8a8a8a' }}>It’s always under ? in the corner.</p>
        </div>
      )}

      {/* The tour */}
      {current && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70 }} aria-live="polite">
          {rect
            ? <div style={{ position: 'fixed', left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 18, boxShadow: '0 0 0 9999px rgba(10,10,10,0.62)', outline: `3px solid ${PINK}`, transition: 'all .25s ease', pointerEvents: 'none' }} />
            : <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.62)' }} />}
          <div role="dialog" aria-modal="true" aria-labelledby="tour-title"
            style={{ position: 'fixed', ...cardStyle, width: 'min(340px, calc(100vw - 32px))', background: '#fff', color: INK, borderRadius: 20, padding: 20, boxShadow: '0 18px 50px rgba(0,0,0,0.25)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b6b6b' }}>{step! + 1} of {STEPS.length}</p>
            <h2 id="tour-title" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.065em' }}>{current.title}</h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: '#404040' }}>{current.body}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={finish} style={{ border: 0, background: 'none', padding: 0, fontSize: 13, color: '#6b6b6b', textDecoration: 'underline', cursor: 'pointer', marginRight: 'auto' }}>
                {step === STEPS.length - 1 ? 'Close' : 'Skip the tour'}
              </button>
              {step! > 0 && <button type="button" onClick={() => setStep(step! - 1)} style={{ border: `1.5px solid ${INK}`, borderRadius: 999, padding: '8px 14px', background: '#fff', color: INK, fontWeight: 600, cursor: 'pointer' }}>Back</button>}
              <button type="button" autoFocus onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step! + 1))}
                style={{ border: 0, borderRadius: 999, padding: '9px 16px', background: PINK, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {step === 0 ? 'Start' : step === STEPS.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Something isn't working / a question */}
      {support && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget && !support.busy) setSupport(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(10,10,10,0.55)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="support-title" style={{ width: 'min(440px, 100%)', background: '#fff', borderRadius: 22, padding: 22, display: 'grid', gap: 12 }}>
            {support.sent ? (<>
              <h2 id="support-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.065em' }}>Thanks, it’s on its way</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#404040' }}>Lauren has your message and will get back to you soon. It’s also in your requests, so you can see where it stands.</p>
              <button type="button" onClick={() => setSupport(null)} style={{ justifySelf: 'end', border: 0, borderRadius: 999, padding: '10px 18px', background: INK, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </>) : (<>
              <h2 id="support-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.065em' }}>How can we help?</h2>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                What’s it about?
                <select value={support.topic} onChange={(e) => setSupport({ ...support, topic: e.target.value as typeof support.topic })}
                  style={{ fontSize: 16, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #d4d4d4', background: '#fff', color: INK }}>
                  <option value="broken">Something isn’t working</option>
                  <option value="question">A question about my project</option>
                  <option value="billing">A billing question</option>
                  <option value="other">Something else</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                Tell us what’s going on
                <textarea rows={5} value={support.message} autoFocus onChange={(e) => setSupport({ ...support, message: e.target.value })}
                  placeholder={support.topic === 'broken' ? 'What were you trying to do, and what happened?' : 'Your question'}
                  style={{ fontSize: 16, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #d4d4d4', resize: 'vertical', color: INK }} />
              </label>
              <p style={{ margin: 0, fontSize: 12, color: '#6b6b6b' }}>We’ll include the page you’re on and your browser, so we can find the problem faster.</p>
              {support.error && <p role="alert" style={{ margin: 0, fontSize: 13, color: PINK }}>{support.error}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setSupport(null)} disabled={support.busy} style={{ border: `1.5px solid ${INK}`, borderRadius: 999, padding: '10px 16px', background: '#fff', color: INK, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={sendSupport} disabled={support.busy || !support.message.trim()}
                  style={{ border: 0, borderRadius: 999, padding: '10px 18px', background: PINK, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: support.busy || !support.message.trim() ? 0.5 : 1 }}>
                  {support.busy ? 'Sending…' : 'Send to Lauren'}
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
