'use client';

// The portal's help corner: a "?" button always in the bottom-right with tips
// for the page they're on, "Tour this page", "Tour the whole portal",
// "Something isn't working" (a message to Lauren, filed as a portal request)
// and an email link; and the tours themselves (portalTours.ts): the main one
// walks the sidebar, each page has its own short one.
//
// Each page's tour is offered once, the first time they open that page
// (user_metadata.portal_tours_seen lists the pages).
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
import { MAIN_TOUR, PAGE_GUIDES, findTarget, type TourStep } from './portalTours';

const PINK = '#e50586';
const INK = '#141414';

async function markTourSeen() {
  try { await supabasePortal.auth.updateUser({ data: { portal_tour_seen: new Date().toISOString() } }); } catch { /* try again next time */ }
}

/** Pages whose own tour they've been offered. */
async function markPageSeen(path: string) {
  try {
    const { data } = await supabasePortal.auth.getSession();
    const seen = ((data.session?.user.user_metadata as Record<string, unknown> | undefined)?.portal_tours_seen as string[] | undefined) ?? [];
    if (!seen.includes(path)) await supabasePortal.auth.updateUser({ data: { portal_tours_seen: [...seen, path] } });
  } catch { /* asked again next time */ }
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
  // Which tour is running: the whole portal, or the page they're on.
  const [steps, setSteps] = useState<TourStep[]>(MAIN_TOUR);
  // This page's own tour, offered once.
  // The page the offer is for; it lapses when they move to another page.
  const [askPath, setAskPath] = useState<string | null>(null);
  const pageAsk = askPath === pathname;
  const guide = PAGE_GUIDES[pathname] ?? null;
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

  // The first time on a page with its own tour (once the big one has been offered).
  useEffect(() => {
    if (!enabled || !guide) return;
    let cancelled = false;
    supabasePortal.auth.getSession().then(({ data }) => {
      const meta = (data.session?.user.user_metadata ?? {}) as Record<string, unknown>;
      const seenPages = (meta.portal_tours_seen as string[] | undefined) ?? [];
      if (!cancelled && data.session && meta.portal_tour_seen && !seenPages.includes(pathname)) setTimeout(() => { if (!cancelled) setAskPath(pathname); }, 900);
    });
    return () => { cancelled = true; };
  }, [enabled, guide, pathname]);

  const startPage = useCallback(() => {
    if (!guide) return;
    setMenu(false); setAskPath(null);
    void markPageSeen(pathname);
    void portalTrack('action', { label: `Took the ${guide.name} tour` });
    setSteps(guide.tour);
    setStep(0);
  }, [guide, pathname]);

  const start = useCallback(() => {
    setMenu(false); setAsking(false); setAskPath(null);
    void markTourSeen();
    // Asked here once already: this page's own tour isn't offered on top of it.
    if (PAGE_GUIDES[pathname]) void markPageSeen(pathname);
    void portalTrack('action', { label: 'Took the portal tour' });
    setSteps(MAIN_TOUR);
    setStep(0);
  }, [pathname]);

  const finish = useCallback(() => {
    setStep(null); setRect(null);
    openNav(false);
  }, [openNav]);

  // Where the highlighted thing is; on phones the sidebar opens for the nav steps.
  const current = step === null ? null : steps[step];
  useLayoutEffect(() => {
    if (!current) return;
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    if (!desktop) openNav(!!current.nav);
    const measure = () => {
      const el = findTarget(current.target);
      const r = el?.getBoundingClientRect();
      // Off screen: bring it into view, then measure again.
      if (el && r && (r.top < 0 || r.bottom > window.innerHeight) && !current.nav) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      }
      const r2 = el?.getBoundingClientRect();
      setRect(r2 && r2.width > 0 && r2.right > 0 && r2.left < window.innerWidth ? r2 : null);
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
      if (e.key === 'ArrowRight') setStep((s) => (s !== null && s < steps.length - 1 ? s + 1 : s));
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
            {guide && (
              <div style={{ margin: '4px 4px 6px', padding: '10px 12px', borderRadius: 14, background: '#f5f5f5' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700 }}>Tips for {guide.name}</p>
                <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 4, fontSize: 12.5, lineHeight: 1.4, color: '#404040' }}>
                  {guide.tips.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            )}
            <p style={{ margin: '6px 10px 4px', fontSize: 13, color: '#6b6b6b' }}>How can we help?</p>
            {[
              ...(guide ? [[`Tour ${guide.name}`, startPage]] : []),
              [guide ? 'Tour the whole portal' : 'Take the tour', start],
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

      {/* This page's tour, offered the first time they're on it */}
      {pageAsk && !asking && step === null && guide && (
        <div role="dialog" aria-labelledby="page-tour-ask" style={{ position: 'fixed', right: 18, bottom: 84, zIndex: 61, width: 'min(300px, calc(100vw - 36px))', background: '#fff', color: INK, border: '1px solid #e6e6e6', borderRadius: 20, padding: 16, boxShadow: '0 18px 50px rgba(0,0,0,0.18)' }}>
          <h2 id="page-tour-ask" style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.065em' }}>First time on {guide.name}?</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#404040' }}>A 30-second tour of what’s here.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={startPage} style={{ flex: 1, border: 0, borderRadius: 999, padding: '9px 12px', background: PINK, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Show me</button>
            <button type="button" onClick={() => { setAskPath(null); void markPageSeen(pathname); }} style={{ border: '1.5px solid #d4d4d4', borderRadius: 999, padding: '9px 12px', background: '#fff', color: INK, fontWeight: 600, cursor: 'pointer' }}>No thanks</button>
          </div>
        </div>
      )}

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
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b6b6b' }}>{step! + 1} of {steps.length}</p>
            <h2 id="tour-title" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, letterSpacing: '-0.065em' }}>{current.title}</h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: '#404040' }}>{current.body}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={finish} style={{ border: 0, background: 'none', padding: 0, fontSize: 13, color: '#6b6b6b', textDecoration: 'underline', cursor: 'pointer', marginRight: 'auto' }}>
                {step === steps.length - 1 ? 'Close' : 'Skip the tour'}
              </button>
              {step! > 0 && <button type="button" onClick={() => setStep(step! - 1)} style={{ border: `1.5px solid ${INK}`, borderRadius: 999, padding: '8px 14px', background: '#fff', color: INK, fontWeight: 600, cursor: 'pointer' }}>Back</button>}
              <button type="button" autoFocus onClick={() => (step === steps.length - 1 ? finish() : setStep(step! + 1))}
                style={{ border: 0, borderRadius: 999, padding: '9px 16px', background: PINK, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {step === 0 && steps === MAIN_TOUR ? 'Start' : step === steps.length - 1 ? 'Done' : 'Next'}
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
