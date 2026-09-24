// Open slots for "Book a call", from weekly hours in Lauren's time zone.
//
// Pure functions with no database access, so the time zone arithmetic
// (daylight saving included) can be tested on its own. Every instant is a
// UTC ISO string; "local" dates and times are in settings.timezone.

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface HoursWindow { start: string; end: string }

export interface BookingSettings {
  enabled: boolean;
  title: string;
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  timezone: string;
  weekly_hours: Partial<Record<Weekday, HoursWindow[]>>;
  meeting_link: string | null;
  meeting_note: string;
}

export interface Blackout { starts_on: string; ends_on: string }
export interface Busy { starts_at: string; ends_at: string }

/** Milliseconds the zone is ahead of UTC at a given instant. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** "2026-11-01" + "10:00" in America/Chicago → the UTC instant (ms). */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetAt(guess, timeZone);
  // Across a DST change the offset at the answer can differ from the guess.
  const second = guess - offsetAt(first, timeZone);
  return second;
}

/** The local calendar date (YYYY-MM-DD) of an instant. */
export function localDate(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

export interface DaySlots {
  /** Local date in the studio's time zone. */
  date: string;
  /** UTC ISO start times. */
  slots: string[];
}

export function openSlots(
  settings: BookingSettings,
  blackouts: Blackout[],
  busy: Busy[],
  now = Date.now(),
): DaySlots[] {
  if (!settings.enabled) return [];
  const tz = settings.timezone;
  const duration = settings.duration_minutes * 60_000;
  const buffer = settings.buffer_minutes * 60_000;
  const step = duration + buffer;
  const earliest = now + settings.min_notice_hours * 3_600_000;
  // Existing calls block their own time plus the buffer on either side.
  const blocked = busy.map((b) => [Date.parse(b.starts_at) - buffer, Date.parse(b.ends_at) + buffer] as const);

  const days: DaySlots[] = [];
  const today = localDate(now, tz);
  for (let i = 0; i <= settings.max_days_ahead; i++) {
    const date = addDays(today, i);
    if (blackouts.some((b) => date >= b.starts_on && date <= b.ends_on)) continue;

    const slots: string[] = [];
    for (const window of settings.weekly_hours[weekdayOf(date)] ?? []) {
      const end = zonedToUtc(date, window.end, tz);
      for (let t = zonedToUtc(date, window.start, tz); t + duration <= end; t += step) {
        if (t < earliest) continue;
        if (blocked.some(([a, b]) => t < b && t + duration > a)) continue;
        slots.push(new Date(t).toISOString());
      }
    }
    if (slots.length) days.push({ date, slots });
  }
  return days;
}

/** "Tuesday, October 7 at 10:30 AM CDT" in a given zone. */
export function describeTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${day} at ${time}`;
}
