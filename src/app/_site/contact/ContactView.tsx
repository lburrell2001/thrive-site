'use client';

// The redesigned contact page: the ask beside a small mosaic of real work, the
// project form (services as colour pills instead of a dropdown), the ways to
// reach Thrive as brand colour cards, and the three questions people ask first.
//
// The form sends exactly what the live page sends to /api/contact (field
// names the route reads, page URL, referrer, first-touch attribution, the
// Opinly id) and reports the same Google Ads conversion.

import Link from 'next/link';
import { useState } from 'react';
import type { WorkPhoto } from '@/lib/workPhotos';
import { readAttribution } from '../../components/SiteTracker';
import { opinlyAnonId, opinlyIdentify } from '../../components/OpinlyPixel';
import { rd } from '../links';
import { useReveal } from '../useReveal';
import s from '../redesign.module.css';
import c from './contact.module.css';

// Values are what projects/inquiries store ("Digital Design" = the web service here).
const SERVICES = [
  { value: 'Brand Design', label: 'Brand & Graphic Design', tone: s.bBlue },
  { value: 'Digital Design', label: 'Web Design & Development', tone: s.bMagenta },
  { value: 'Social Media', label: 'Social Media', tone: s.bMint },
  { value: 'Photography', label: 'Photography', tone: s.bPurple },
];

const WAYS = [
  { label: 'Email', value: 'hello@thrivecreativestudios.org', href: 'mailto:hello@thrivecreativestudios.org', tone: s.bMagenta },
  { label: 'Phone', value: '(806) 414-5241', href: 'tel:+18064145241', tone: s.bOrange },
  { label: 'Instagram', value: '@thrivecreativestudio_', href: 'https://www.instagram.com/thrivecreativestudio_/', tone: s.bBlue },
  { label: 'Location', value: 'Dallas, TX', tone: s.bMint },
];

const FAQ = [
  { q: 'How long does a project take?', a: 'Brand identities take 4–6 weeks. Websites depend on the scope — your proposal includes a timeline before anything starts. Social retainers are monthly.' },
  { q: 'Do you work with startups?', a: 'Yes! We love working with brands at every stage — from day one to established businesses leveling up.' },
  { q: 'How do I get started?', a: 'Fill out the form or email us directly. We’ll schedule a discovery call to see if we’re a great fit.' },
];

// Three real photos (web, social, UX) for the mosaic beside the ask.
const ERROR = 'Something went wrong. Please try again, or email hello@thrivecreativestudios.org.';

export default function ContactView({ titles, photos }: { titles: Record<string, string>; photos: WorkPhoto[] }) {
  const root = useReveal<HTMLDivElement>();
  const [form, setForm] = useState({ name: '', company: '', email: '', service: '', description: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          projectType: form.service,
          message: form.description,
          pageUrl: window.location.href,
          referrer: document.referrer,
          attribution: readAttribution(),
          opinlyAnonId: opinlyAnonId(),
        }),
      });
      if (res.ok) {
        setSent(true);
        opinlyIdentify(form.email);
        // Google Ads conversion, as the live contact page reports it.
        const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
        gtag?.('event', 'conversion', { send_to: 'AW-18142291257/UtwfCIi36agcELnK9cpD' });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || ERROR);
      }
    } catch {
      setError('Network error. Please try again, or email hello@thrivecreativestudios.org.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={root}>
      {/* ── The ask, beside a small mosaic of real work ── */}
      <section className={c.hero}>
        <div className={c.heroText}>
          <h1 className={`${s.display} ${c.title}`}>Ready to<br />Thrive?</h1>
          <p className={`${s.leadText} ${c.lede}`}>Whether you’re building from scratch or leveling up — let’s make something unforgettable together.</p>
        </div>
        <div className={c.mosaic}>
          {photos.map((p, i) => (
            <Link key={p.href} href={rd(p.href)} className={`${c.tile} ${s.rise}`} style={{ '--d': `${i * 80}ms` } as React.CSSProperties}>
              <img src={p.src} alt={p.alt} loading="eager" style={p.position ? { objectPosition: p.position } : undefined} />
              <span className={c.tileTag}>{titles[p.href] ?? p.caption}</span>
            </Link>
          ))}
          <span className={c.sticker} aria-hidden>Replies within 24–48 hours</span>
        </div>
      </section>

      <section className={c.body}>
        <div className={c.formCard}>
          {sent ? (
            <div className={`${c.success} ${s.bMint}`} role="status">
              <h2 className={c.successHead}>You’re in!</h2>
              <p>Thanks for reaching out. We’ll be in touch within 24–48 hours to schedule a discovery call.</p>
              <Link href={rd('/portfolio')} className={`${s.pill} ${s.pillBig}`}>See our work while you wait</Link>
            </div>
          ) : (
            <form onSubmit={submit} className={c.form}>
              <h2 className={c.formHead}>Start a project</h2>
              <p className={c.alt}>Rather talk it through? <Link href="/book" className={c.altLink}>Book a free intro call →</Link></p>
              <div className={c.row}>
                <label className={c.field}>
                  <span>Name</span>
                  <input name="name" required autoComplete="name" value={form.name} onChange={set('name')} placeholder="Your name" />
                </label>
                <label className={c.field}>
                  <span>Company</span>
                  <input name="company" autoComplete="organization" value={form.company} onChange={set('company')} placeholder="Business name (optional)" />
                </label>
              </div>
              <label className={c.field}>
                <span>Email</span>
                <input name="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@business.com" />
              </label>
              <fieldset className={c.services}>
                <legend>What do you need?</legend>
                <div className={c.chips}>
                  {SERVICES.map((sv) => (
                    <button key={sv.value} type="button" aria-pressed={form.service === sv.value}
                      className={`${s.pill} ${c.chip} ${form.service === sv.value ? sv.tone : c.chipOff}`}
                      onClick={() => setForm((f) => ({ ...f, service: f.service === sv.value ? '' : sv.value }))}>
                      {sv.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className={c.field}>
                <span>Tell us about it</span>
                <textarea name="description" required rows={5} value={form.description} onChange={set('description')} placeholder="What you’re building, what’s not working, and when you’d like to launch." />
              </label>
              {error && <p className={c.error} role="alert">{error}</p>}
              <button type="submit" className={`${s.pill} ${s.pillBig} ${c.submit}`} disabled={sending}>{sending ? 'Sending…' : 'Send it'}</button>
            </form>
          )}
        </div>

        <aside className={c.side}>
          {WAYS.map((w, i) => {
            const inner = <><span className={c.wayLabel}>{w.label}</span><span className={c.wayValue}>{w.value}</span></>;
            return w.href ? (
              <a key={w.label} href={w.href} className={`${c.way} ${w.tone} ${s.rise}`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}
                {...(w.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}>{inner}</a>
            ) : (
              <div key={w.label} className={`${c.way} ${w.tone} ${s.rise}`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>{inner}</div>
            );
          })}
        </aside>
      </section>

      <section className={c.faqWrap}>
        <h2 className={`${s.display} ${c.faqTitle} ${s.rise}`}>Good to know</h2>
        <div className={c.faqs}>
          {FAQ.map((f) => (
            <details key={f.q} className={c.faq}>
              <summary>{f.q}<span className={c.faqIcon} aria-hidden /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
