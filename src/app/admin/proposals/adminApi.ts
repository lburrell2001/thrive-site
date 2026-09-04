'use client';

/** Thin wrapper over the proposal API routes, carrying the admin passcode. */

function passcode(): string {
  return typeof window !== 'undefined' ? sessionStorage.getItem('admin_passcode') ?? '' : '';
}

export class ApiError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok || body.error) throw new ApiError(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return handle<T>(await fetch(path, { headers: { 'X-Admin-Passcode': passcode() } }));
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method,
      headers: { 'X-Admin-Passcode': passcode(), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return handle<T>(
    await fetch(path, {
      method: 'POST',
      headers: { 'X-Admin-Passcode': passcode() },
      body: form,
    }),
  );
}

export function formatMoneyCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
