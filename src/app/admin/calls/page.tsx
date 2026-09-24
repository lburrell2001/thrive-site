'use client';

// Calls: the booking page's settings (hours, length, notice), days off,
// and the calls people have booked.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { Toast, useToast } from '../proposals/Toast';
import { describeTime, type BookingSettings, type HoursWindow, type Weekday } from '@/lib/bookingTime';
import { SERVICE_SEO, type ServiceSlug } from '@/lib/serviceSeo';

interface BookingRow {
  id: string;
  starts_at: string;
  status: 'confirmed' | 'cancelled';
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  service_slug: ServiceSlug | null;
  notes: string | null;
  crm_contact_id: string | null;
  crm_deal_id: string | null;
  cancelled_by: string | null;
}

interface Blackout { id: string; starts_on: string; ends_on: string; note: string | null }

interface CallsData { settings: BookingSettings; blackouts: Blackout[]; bookings: BookingRow[] }

const DAY_NAME: Record<Weekday, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function CallsAdmin() {
  const [data, setData] = useState<CallsData | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  // When the page opened, for splitting upcoming from past.
  const [now] = useState(() => Date.now());
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const d = await apiGet<CallsData>('/api/bookings');
      setData(d);
      setSettings(d.settings);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not load calls');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGet<CallsData>('/api/bookings')
      .then((d) => { if (!cancelled) { setData(d); setSettings(d.settings); } })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error ? e.message : 'Could not load calls'); });
    return () => { cancelled = true; };
  }, []);

  if (!data || !settings) {
    return <div className={p.screen}><div className={p.wrap}><p className={p.empty}>{failed || 'Loading…'}</p></div></div>;
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(data.settings);
  const set = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) => setSettings((s) => (s ? { ...s, [key]: value } : s));
  const setDay = (day: Weekday, windows: HoursWindow[]) => set('weekly_hours', { ...settings.weekly_hours, [day]: windows });

  async function save(patch: Partial<BookingSettings> = {}) {
    setSaving(true);
    try {
      const { enabled, title, duration_minutes, buffer_minutes, min_notice_hours, max_days_ahead, weekly_hours, meeting_link, meeting_note } = { ...settings!, ...patch };
      await apiSend('/api/bookings', 'PATCH', { enabled, title, duration_minutes, buffer_minutes, min_notice_hours, max_days_ahead, weekly_hours, meeting_link: meeting_link ?? '', meeting_note });
      show('Saved.');
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
    }
    setSaving(false);
  }

  async function cancel(b: BookingRow) {
    if (!window.confirm(`Cancel the call with ${b.name}? They'll get an email asking them to pick another time.`)) return;
    try {
      await apiSend(`/api/bookings/${b.id}/cancel`, 'POST');
      show('Cancelled and emailed.');
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not cancel', 'error');
    }
  }

  const upcoming = data.bookings.filter((b) => b.status === 'confirmed' && Date.parse(b.starts_at) >= now - 30 * 60_000);
  const past = data.bookings.filter((b) => !upcoming.includes(b)).reverse();

  return (
    <div className={p.screen}>
      <div className={p.wrap}>
        <div className={p.pageHead}>
          <div>
            <h1 className={p.pageTitle}>Calls</h1>
            <p className={p.pageSub}>
              People book at <a href="/book" target="_blank" rel="noreferrer">/book</a>. Each booking lands in the CRM as an inquiry with a follow-up task, and both of you get a calendar invite.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => save({ enabled: e.target.checked })} disabled={saving} style={{ width: 18, height: 18, accentColor: '#e40586' }} />
            {settings.enabled ? 'Booking is open' : 'Booking is closed'}
          </label>
        </div>

        <section className={p.card} style={{ marginBottom: 16 }}>
          <h2 className={p.cardTitle}>Upcoming calls</h2>
          {upcoming.length === 0 ? <p className={p.rowMeta}>No calls booked.</p> : (
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
              {upcoming.map((b) => (
                <li key={b.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0eeec' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <strong style={{ fontSize: 14 }}>{describeTime(b.starts_at, settings.timezone)}</strong>
                    <p className={p.rowMeta}>
                      {[b.name, b.company, b.email, b.phone, b.service_slug && SERVICE_SEO[b.service_slug]?.name].filter(Boolean).join(' · ')}
                    </p>
                    {b.notes && <p className={p.rowMeta} style={{ color: '#333' }}>“{b.notes}”</p>}
                  </div>
                  {b.crm_contact_id && <Link href={`/admin/crm?contact=${b.crm_contact_id}${b.crm_deal_id ? `&deal=${b.crm_deal_id}` : ''}`} className={`${p.btn} ${p.btnSmall}`}>CRM</Link>}
                  <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => cancel(b)}>Cancel</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={p.card} style={{ marginBottom: 16 }}>
          <h2 className={p.cardTitle}>Weekly hours <span className={p.rowMeta} style={{ display: 'inline' }}>({settings.timezone})</span></h2>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {ORDER.map((day) => {
              const windows = settings.weekly_hours[day] ?? [];
              return (
                <div key={day} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 96, fontSize: 13, fontWeight: 600 }}>{DAY_NAME[day]}</span>
                  {windows.length === 0 && <span className={p.rowMeta} style={{ margin: 0 }}>Unavailable</span>}
                  {windows.map((w, i) => (
                    <span key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <input type="time" className={p.input} style={{ width: 118 }} value={w.start} aria-label={`${DAY_NAME[day]} start`} onChange={(e) => setDay(day, windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                      –
                      <input type="time" className={p.input} style={{ width: 118 }} value={w.end} aria-label={`${DAY_NAME[day]} end`} onChange={(e) => setDay(day, windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                      <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-label={`Remove ${DAY_NAME[day]} hours`} onClick={() => setDay(day, windows.filter((_, j) => j !== i))}>×</button>
                    </span>
                  ))}
                  <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setDay(day, [...windows, { start: '10:00', end: '16:00' }])}>+ Add hours</button>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 18 }}>
            <label><span className={p.label}>Call name</span><input className={p.input} value={settings.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label><span className={p.label}>Length (minutes)</span><input type="number" min={10} max={120} className={p.input} value={settings.duration_minutes} onChange={(e) => set('duration_minutes', Number(e.target.value))} /></label>
            <label><span className={p.label}>Gap after each call</span><input type="number" min={0} max={120} className={p.input} value={settings.buffer_minutes} onChange={(e) => set('buffer_minutes', Number(e.target.value))} /></label>
            <label><span className={p.label}>Minimum notice (hours)</span><input type="number" min={0} max={336} className={p.input} value={settings.min_notice_hours} onChange={(e) => set('min_notice_hours', Number(e.target.value))} /></label>
            <label><span className={p.label}>Book up to (days ahead)</span><input type="number" min={1} max={90} className={p.input} value={settings.max_days_ahead} onChange={(e) => set('max_days_ahead', Number(e.target.value))} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
            <label><span className={p.label}>Meeting link (Zoom, Google Meet…)</span><input className={p.input} value={settings.meeting_link ?? ''} onChange={(e) => set('meeting_link', e.target.value || null)} placeholder="https://meet.google.com/abc-defg-hij" /></label>
            <label><span className={p.label}>Note shown to visitors</span><input className={p.input} value={settings.meeting_note} onChange={(e) => set('meeting_note', e.target.value)} /></label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => save()} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </section>

        <Blackouts items={data.blackouts} onChange={load} notify={show} />

        {past.length > 0 && (
          <section className={p.card}>
            <h2 className={p.cardTitle}>Past and cancelled (last 30 days)</h2>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
              {past.map((b) => (
                <li key={b.id} className={p.rowMeta} style={{ padding: '6px 0' }}>
                  {describeTime(b.starts_at, settings.timezone)} · {b.name}
                  {b.status === 'cancelled' ? ` · cancelled by ${b.cancelled_by === 'admin' ? 'you' : 'them'}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function Blackouts({ items, onChange, notify }: { items: Blackout[]; onChange: () => Promise<void>; notify: (m: string, tone?: 'ok' | 'error') => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend('/api/bookings/blackouts', 'POST', { starts_on: from, ends_on: to || from, note });
      setFrom(''); setTo(''); setNote('');
      notify('Blocked off.');
      await onChange();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save', 'error');
    }
  }

  async function remove(id: string) {
    try {
      await apiSend(`/api/bookings/blackouts/${id}`, 'DELETE');
      await onChange();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove', 'error');
    }
  }

  return (
    <section className={p.card} style={{ marginBottom: 16 }}>
      <h2 className={p.cardTitle}>Days off</h2>
      <p className={p.rowMeta}>No calls can be booked on these days. Bookings don&apos;t check your calendar, so block anything that isn&apos;t in your weekly hours.</p>
      {items.map((b) => (
        <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
          <span style={{ flex: 1 }}>{b.starts_on === b.ends_on ? b.starts_on : `${b.starts_on} → ${b.ends_on}`}{b.note ? ` · ${b.note}` : ''}</span>
          <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => remove(b.id)}>Remove</button>
        </div>
      ))}
      <form onSubmit={add} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'end' }}>
        <label><span className={p.label}>From</span><input type="date" className={p.input} value={from} onChange={(e) => setFrom(e.target.value)} required /></label>
        <label><span className={p.label}>To</span><input type="date" className={p.input} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <label style={{ flex: '1 1 200px' }}><span className={p.label}>Note</span><input className={p.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vacation, shoot day…" /></label>
        <button type="submit" className={p.btn} disabled={!from}>Block off</button>
      </form>
    </section>
  );
}

