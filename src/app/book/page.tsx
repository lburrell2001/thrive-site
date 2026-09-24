'use client';

// Book a call: pick a day, pick a time (shown in the visitor's own time
// zone), then a short form. Times come from /api/booking and are checked
// again when the booking is made.

import { useEffect, useMemo, useState } from 'react';
import PublicLayout from '../components/PublicLayout';
import { readAttribution } from '../components/SiteTracker';
import { SERVICE_SEO } from '@/lib/serviceSeo';
import s from './book.module.css';

interface Availability {
  enabled: boolean;
  title: string;
  duration_minutes: number;
  timezone: string;
  meeting_note: string;
  days: { date: string; slots: string[] }[];
}

interface Booked { visitorTime: string; where: string }

const visitorTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
};

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
  };
}

function timeLabel(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}

export default function BookPage() {
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loadError, setLoadError] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', service_slug: '', notes: '', website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);
  const tz = useMemo(visitorTz, []);

  async function load() {
    try {
      const res = await fetch('/api/booking', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Booking is unavailable');
      setAvail(body.data);
      setDate((d) => d ?? body.data.days[0]?.date ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Booking is unavailable');
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/booking', { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Booking is unavailable');
        return body.data as Availability;
      })
      .then((data) => { if (!cancelled) { setAvail(data); setDate(data.days[0]?.date ?? null); } })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Booking is unavailable'); });
    return () => { cancelled = true; };
  }, []);

  const day = avail?.days.find((d) => d.date === date);
  // Only say "Dallas time" when the visitor is somewhere else.
  const sameZone = !avail || !tz || new Date().toLocaleString('en-US', { timeZone: tz }) === new Date().toLocaleString('en-US', { timeZone: avail.timezone });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setSending(true); setError('');
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          service_slug: form.service_slug || null,
          starts_at: slot,
          visitor_tz: tz,
          attribution: readAttribution(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong — please try again.');
        if (res.status === 409) { setSlot(null); void load(); }
      } else {
        setBooked(body.data);
      }
    } catch {
      setError('Network error — please try again.');
    }
    setSending(false);
  }

  return (
    <PublicLayout>
      <div className={s.page}>
        <div className={s.head}>
          <p className={s.eyebrow}>Book a call</p>
          <h1 className={s.title}>LET&apos;S TALK IT<br />THROUGH</h1>
          <p className={s.lede}>
            {avail ? `A ${avail.duration_minutes}-minute call` : 'A short call'} to talk about what you need, answer questions, and see if we&apos;re a fit. No cost, no pressure.
          </p>
        </div>

        {booked ? (
          <div className={s.panel} role="status">
            <p className={s.doneTitle}>YOU&apos;RE BOOKED!</p>
            <p className={s.lede}><strong>{booked.visitorTime}</strong></p>
            <p className={s.lede}>{booked.where}</p>
            <p className={s.lede}>A confirmation with a calendar invite is on its way to {form.email}. See you then!</p>
          </div>
        ) : loadError ? (
          <div className={s.panel}><p className={s.lede}>{loadError} You can always reach us through the <a href="/contact">contact form</a>.</p></div>
        ) : !avail ? (
          <div className={s.panel}><p className={s.lede}>Loading times…</p></div>
        ) : !avail.enabled || avail.days.length === 0 ? (
          <div className={s.panel}>
            <p className={s.lede}>
              {avail.enabled ? 'Every time is booked for the next few weeks.' : 'Calls are not open for booking right now.'} Send a note through the{' '}
              <a href="/contact">contact form</a> and we&apos;ll find a time.
            </p>
          </div>
        ) : (
          <div className={s.layout}>
            <section className={s.panel} aria-labelledby="pick-time">
              <h2 id="pick-time" className={s.step}>1. PICK A TIME</h2>
              <div className={s.days} role="listbox" aria-label="Day">
                {avail.days.map((d) => {
                  const l = dayLabel(d.date);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="option"
                      aria-selected={d.date === date}
                      className={`${s.day} ${d.date === date ? s.dayOn : ''}`}
                      onClick={() => { setDate(d.date); setSlot(null); }}
                    >
                      <span className={s.dayWeek}>{l.weekday}</span>
                      <span className={s.dayNum}>{l.day}</span>
                      <span className={s.dayMonth}>{l.month}</span>
                    </button>
                  );
                })}
              </div>
              {day && (
                <>
                  <p className={s.dayHeading}>{dayLabel(day.date).long}</p>
                  <div className={s.slots} role="listbox" aria-label="Time">
                    {day.slots.map((iso) => (
                      <button
                        key={iso}
                        type="button"
                        role="option"
                        aria-selected={iso === slot}
                        className={`${s.slot} ${iso === slot ? s.slotOn : ''}`}
                        onClick={() => setSlot(iso)}
                      >
                        {timeLabel(iso, tz)}
                        {!sameZone && <span className={s.slotAlt}>{timeLabel(iso, avail.timezone)} Dallas</span>}
                      </button>
                    ))}
                  </div>
                  {!sameZone && <p className={s.tzNote}>Times are shown in your time zone ({tz}).</p>}
                </>
              )}
            </section>

            <section className={s.panel} aria-labelledby="your-details">
              <h2 id="your-details" className={s.step}>2. YOUR DETAILS</h2>
              {slot ? (
                <form onSubmit={submit} className={s.form}>
                  <p className={s.chosen}>{dayLabel(date!).long} at {timeLabel(slot, tz)}</p>
                  <label className={s.field}><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} autoComplete="name" /></label>
                  <label className={s.field}><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" /></label>
                  <div className={s.row}>
                    <label className={s.field}><span>Company (optional)</span><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} maxLength={160} autoComplete="organization" /></label>
                    <label className={s.field}><span>Phone (optional)</span><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} autoComplete="tel" /></label>
                  </div>
                  <label className={s.field}>
                    <span>What&apos;s it about?</span>
                    <select value={form.service_slug} onChange={(e) => setForm({ ...form, service_slug: e.target.value })}>
                      <option value="">Not sure yet</option>
                      {Object.values(SERVICE_SEO).map((svc) => <option key={svc.slug} value={svc.slug}>{svc.name}</option>)}
                    </select>
                  </label>
                  <label className={s.field}><span>Anything to share before the call? (optional)</span><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></label>
                  {/* Honeypot for bots; hidden from people and screen readers. */}
                  <input className={s.hp} tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                  {error && <p className={s.error} role="alert">{error}</p>}
                  <button type="submit" className={s.submit} disabled={sending}>{sending ? 'BOOKING…' : 'BOOK THE CALL →'}</button>
                  <p className={s.tzNote}>{avail.meeting_note}</p>
                </form>
              ) : (
                <p className={s.lede}>Choose a time on the left first.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
