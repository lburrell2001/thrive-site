// Times for scheduled emails. Pure, so the browser's picker and the server
// agree on what's allowed. Vercel Cron sends what's due every five minutes
// (vercel.json), so an email goes out up to five minutes after its time.

export const CRON_MINUTES = 5;
const MAX_DAYS = 365;

/** Why this time can't be used, or null if it can. */
export function scheduleProblem(at: Date, now = new Date()): string | null {
  if (Number.isNaN(at.getTime())) return 'Choose a date and time';
  if (at.getTime() < now.getTime() + 60_000) return 'Pick a time in the future — or send it now';
  if (at.getTime() > now.getTime() + MAX_DAYS * 86_400_000) return 'Pick a time within the next year';
  return null;
}

/** "Tue, Oct 7, 9:00 AM" in the viewer's time zone. */
export function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** A Date as the value of an <input type="datetime-local"> (local time). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Tomorrow at 9am local — a good default for "send later". */
export function defaultSendTime(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d);
}
