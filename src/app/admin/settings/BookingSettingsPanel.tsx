'use client';

// Settings → Booking: the /book page's hours, call length, notice and days
// off. The calls people book are on the Calls page (crm/calls).

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { useCrm } from '../crm/CrmContext';
import type { BookingSettings, HoursWindow, Weekday } from '@/lib/bookingTime';

interface BookingRow {
  id: string;
  starts_at: string;
  status: 'confirmed' | 'cancelled';
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  service_slug: string | null;
  notes: string | null;
  crm_contact_id: string | null;
  crm_deal_id: string | null;
  cancelled_by: string | null;
}

interface Blackout { id: string; starts_on: string; ends_on: string; note: string | null }

interface CallsData { settings: BookingSettings; blackouts: Blackout[]; bookings: BookingRow[]; calendars?: { mailbox: string; writable: boolean }[] }

const DAY_NAME: Record<Weekday, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function BookingSettingsPanel() {
  const [data, setData] = useState<CallsData | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify: show } = useCrm();

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
    return <p className={p.empty}>{failed || 'Loading…'}</p>;
  }

  const dirty = JSON.stringify(settings) !== JSON.stringify(data.settings);
  const set = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) => setSettings((s) => (s ? { ...s, [key]: value } : s));
  const setDay = (day: Weekday, windows: HoursWindow[]) => set('weekly_hours', { ...settings.weekly_hours, [day]: windows });

  async function save(patch: Partial<BookingSettings> = {}) {
    setSaving(true);
    try {
      const { enabled, title, duration_minutes, buffer_minutes, min_notice_hours, max_days_ahead, weekly_hours, meeting_link, meeting_note, calendar_mailbox } = { ...settings!, ...patch };
      await apiSend('/api/bookings', 'PATCH', {
        enabled, title, duration_minutes, buffer_minutes, min_notice_hours, max_days_ahead, weekly_hours, meeting_link: meeting_link ?? '', meeting_note,
        // Only once migration 054 has added the column (the key is missing before it).
        ...(calendar_mailbox !== undefined ? { calendar_mailbox: calendar_mailbox ?? '' } : {}),
      });
      show('Saved.');
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not save', 'error');
    }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', margin: '0 0 16px' }}>
          <p className={p.pageSub} style={{ margin: 0 }}>
            People book at <a href="/book" target="_blank" rel="noreferrer">/book</a>. Each booking lands in the CRM as an inquiry with a follow-up task, and both of you get a calendar invite. Booked calls are on the Calls page. Times that are busy on your Outlook calendar aren&apos;t offered (once it&apos;s connected with calendar access in the Email tab); entries marked Free or Working elsewhere leave the time open.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={settings.enabled} onChange={(e) => save({ enabled: e.target.checked })} disabled={saving} style={{ width: 18, height: 18, accentColor: 'var(--a-accent)' }} />
            {settings.enabled ? 'Booking is open' : 'Booking is closed'}
          </label>
        </div>

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
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', maxWidth: 420 }}>
              <span className={p.label}>Add booked calls to this Outlook calendar</span>
              {settings.calendar_mailbox === undefined ? (
                <span className={p.rowMeta} style={{ display: 'block', margin: 0 }}>Run migration 054 in Supabase to put bookings on your Outlook calendar.</span>
              ) : (
                <select className={p.select} value={settings.calendar_mailbox ?? ''} onChange={(e) => set('calendar_mailbox', e.target.value || null)}>
                  <option value="">Don’t add them</option>
                  {[...new Set([...(data.calendars ?? []).map((c) => c.mailbox), ...(settings.calendar_mailbox ? [settings.calendar_mailbox] : [])])].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </label>
            {(() => {
              const chosen = settings.calendar_mailbox;
              if (!chosen) return null;
              const cal = (data.calendars ?? []).find((c) => c.mailbox.toLowerCase() === chosen.toLowerCase());
              const why = !data.calendars?.length ? 'Outlook isn’t connected. Connect it in the Email tab.'
                : !cal ? `${chosen} isn’t one of your connected mailboxes. Add it under Email → Add mailbox.`
                : !cal.writable ? 'Outlook needs permission to add events: in the Email tab, choose Reconnect and accept the calendar access.'
                : null;
              return (
                <p className={p.rowMeta} style={{ margin: '6px 0 0', color: why ? '#e50586' : undefined }}>
                  {why ?? 'Each booking appears there as a busy event with their details and the meeting link; cancelling the booking removes it.'}
                </p>
              );
            })()}
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => save()} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </section>

        <Blackouts items={data.blackouts} onChange={load} notify={show} />

      </div>
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
      <p className={p.rowMeta}>No calls can be booked on these days. Busy times and all-day out-of-office events on your Outlook calendar are already blocked; use this for anything that isn&apos;t on it.</p>
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

