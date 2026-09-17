// Phone number helpers shared by the portal settings page, the admin UI and
// the SMS sender. No server-only import: the browser normalises a number
// before saving it, and the server normalises again before texting it.

/**
 * Normalise a phone number to E.164 (+15551234567), or null if it cannot be.
 * A bare 10-digit number is assumed to be US/Canada, since that is where
 * clients are; anything international must be entered with its + prefix.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** +15551234567 → (555) 123-4567; other countries are shown as stored. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}
