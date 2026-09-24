// Google Search Console: what people searched before they found the site.
//
// Uses a Google Cloud service account that has been added as a user on the
// Search Console property. No SDK: the service account signs a JWT, trades
// it for an access token, and calls the Search Analytics REST endpoint.
//
// Env (all optional — without them the panel shows setup steps):
//   GSC_SERVICE_ACCOUNT_JSON  the service account's JSON key, pasted whole
//   GSC_SITE_URL              the property, e.g. sc-domain:thrivecreativestudios.org
//                             or https://thrivecreativestudios.org/

import 'server-only';
import { createSign } from 'node:crypto';
import type { SearchRow, SearchSection, SearchTotals } from '@/types/searchConsole';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Search Console data is final about two days after the fact. */
const LAG_DAYS = 2;

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function credentials(): { account: ServiceAccount; site: string } | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE_URL;
  if (!raw || !site) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    // Keys pasted into env vars often arrive with literal "\n".
    return {
      account: { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') },
      site,
    };
  } catch {
    return null;
  }
}

export function searchConsoleConfigured() {
  return credentials() !== null;
}

let cachedToken: { token: string; expires: number } | null = null;

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google sign-in failed: ${body.error_description ?? res.status}`);
  }
  cachedToken = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

interface ApiRow { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }

async function query(site: string, token: string, body: object): Promise<ApiRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );
  const json = (await res.json().catch(() => ({}))) as { rows?: ApiRow[]; error?: { message?: string } };
  if (!res.ok) {
    const message = json.error?.message ?? `Search Console returned ${res.status}`;
    // The most common setup mistake, said plainly.
    if (res.status === 403) {
      throw new Error(`${message} — add the service account's email as a user on the Search Console property.`);
    }
    throw new Error(message);
  }
  return json.rows ?? [];
}

function isoDay(offset: number) {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

function totalsOf(rows: ApiRow[]): SearchTotals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  // Position averaged by impressions, the way Search Console reports it.
  const position = impressions ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions : 0;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
}

function toRow(r: ApiRow, key: string): SearchRow {
  return { key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
}

export async function searchReport(days: number): Promise<SearchSection> {
  const creds = credentials();
  if (!creds) return { status: 'not_configured' };

  try {
    const token = await accessToken(creds.account);
    const to = isoDay(LAG_DAYS);
    const from = isoDay(LAG_DAYS + days - 1);
    const prevTo = isoDay(LAG_DAYS + days);
    const prevFrom = isoDay(LAG_DAYS + days * 2 - 1);
    const range = { startDate: from, endDate: to };

    const [daily, previousDaily, queries, pages] = await Promise.all([
      query(creds.site, token, { ...range, dimensions: ['date'], rowLimit: 500 }),
      query(creds.site, token, { startDate: prevFrom, endDate: prevTo, dimensions: ['date'], rowLimit: 500 }),
      query(creds.site, token, { ...range, dimensions: ['query'], rowLimit: 100 }),
      query(creds.site, token, { ...range, dimensions: ['page'], rowLimit: 50 }),
    ]);

    return {
      status: 'ok',
      from,
      to,
      totals: totalsOf(daily),
      previous: totalsOf(previousDaily),
      daily: daily.map((r) => ({ date: r.keys?.[0] ?? '', clicks: r.clicks, impressions: r.impressions })),
      queries: queries.map((r) => toRow(r, r.keys?.[0] ?? '')),
      pages: pages.map((r) => {
        const url = r.keys?.[0] ?? '';
        let path = url;
        try { path = new URL(url).pathname; } catch { /* keep the raw key */ }
        return toRow(r, path);
      }),
    };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Search Console could not be reached' };
  }
}
