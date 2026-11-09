// Lauren's Microsoft 365 mailbox, through Microsoft Graph (migration 040).
//
// She connects it once from Settings → Email: a Microsoft sign-in with
// delegated permissions (Mail.Read, Mail.Send, their .Shared versions,
// Calendars.Read, offline_access, User.Read), so the app reaches her own
// mailbox and calendar plus any mailbox she has Full Access to (hello@), and
// nothing else. The refresh
// token is stored encrypted; every use refreshes an access token.
//
// Needs an app registration in her Microsoft Entra tenant:
// MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET.

import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret, vaultKeyReady } from './credentialCrypto';

export class OutlookError extends Error {}

const MAIL_SCOPES = 'offline_access User.Read Mail.Read Mail.Send Mail.Read.Shared Mail.Send.Shared';
// Added 2026-11 (migration 043). Sign-ins from before it don't hold it.
export const CALENDAR_SCOPE = 'Calendars.Read';
const SCOPES = `${MAIL_SCOPES} ${CALENDAR_SCOPE}`;

/** Microsoft returns Graph scopes as bare names or full URLs; keep bare names. */
function normalizeScopes(scope: string | undefined): string | null {
  if (!scope) return null;
  const names = scope.split(/\s+/).filter(Boolean).map((s) => s.replace(/^https:\/\/graph\.microsoft\.com\//i, ''));
  return names.length ? [...new Set(names)].join(' ') : null;
}

/** Ask a refresh for exactly what the sign-in was granted — asking for more fails. */
function refreshScopes(granted: string | null | undefined): string {
  if (!granted) return MAIL_SCOPES;
  const wanted = new Set(SCOPES.split(' '));
  const have = granted.split(' ').filter((s) => wanted.has(s));
  return [...new Set(['offline_access', ...have])].join(' ');
}

export const hasCalendarScope = (granted: string | null | undefined) =>
  Boolean(granted?.split(' ').some((s) => s.toLowerCase() === CALENDAR_SCOPE.toLowerCase()));
const GRAPH = 'https://graph.microsoft.com/v1.0';
// History pulled in on first connect, so timelines aren't empty.
const BACKFILL_DAYS = 14;

function config() {
  const tenant = process.env.MS_TENANT_ID?.trim();
  const clientId = process.env.MS_CLIENT_ID?.trim();
  const secret = process.env.MS_CLIENT_SECRET?.trim();
  if (!tenant || !clientId || !secret) return null;
  return { tenant, clientId, secret };
}

export const outlookConfigured = () => Boolean(config()) && vaultKeyReady();

const redirectUri = (site: string) => `${site}/api/outlook/callback`;

// ------------------------------------------------------------ sign-in

function stateKey() {
  const k = process.env.MS_CLIENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new OutlookError('No key to sign the Outlook sign-in');
  return k;
}

const stateSig = (body: string) => createHmac('sha256', stateKey()).update(`outlook-state:${body}`).digest('base64url');

/** A short-lived, signed state so the callback only accepts sign-ins started from admin. */
function signState(): string {
  const body = `${Date.now()}.${randomBytes(12).toString('base64url')}`;
  return `${body}.${stateSig(body)}`;
}

function stateValid(state: string): boolean {
  const i = state.lastIndexOf('.');
  if (i < 0) return false;
  const body = state.slice(0, i);
  const given = Buffer.from(state.slice(i + 1));
  const expected = Buffer.from(stateSig(body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Date.now() - Number(body.split('.')[0]) < 15 * 60_000;
}

export function authorizeUrl(site: string): string {
  const c = config();
  if (!c) throw new OutlookError('Set MS_TENANT_ID, MS_CLIENT_ID and MS_CLIENT_SECRET in Vercel first.');
  if (!vaultKeyReady()) throw new OutlookError('PORTAL_CREDENTIALS_KEY must be set to store the connection.');
  const q = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(site),
    response_mode: 'query',
    scope: SCOPES,
    state: signState(),
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize?${q}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; error?: string; error_description?: string };

async function tokenRequest(params: Record<string, string>, scope = SCOPES): Promise<TokenResponse> {
  const c = config();
  if (!c) throw new OutlookError('Outlook is not configured');
  const res = await fetch(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.secret, scope, ...params }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    throw new OutlookError(body.error_description?.split('\r\n')[0] || body.error || `Microsoft sign-in failed (${res.status})`);
  }
  return body;
}

/** The callback: swap the code for tokens and store the connection. */
export async function completeSignIn(db: SupabaseClient, code: string, state: string, site: string): Promise<string> {
  if (!stateValid(state)) throw new OutlookError('That sign-in link expired. Start again from Settings → Email.');
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(site) });
  if (!tokens.refresh_token) throw new OutlookError('Microsoft did not return a refresh token (offline_access).');

  const me = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
  }).then((r) => r.json() as Promise<{ mail?: string; userPrincipalName?: string }>);
  const account = (me.mail || me.userPrincipalName || '').toLowerCase();

  const { data: existing } = await db.from('mail_connection').select('account_email, cursors, shared_mailboxes, send_from').eq('id', 1).maybeSingle();
  // Reconnecting the same account carries on where the sync left off.
  const same = existing?.account_email === account;
  const { error } = await db.from('mail_connection').upsert({
    id: 1,
    provider: 'outlook',
    account_email: account,
    refresh_token: encryptSecret(tokens.refresh_token),
    connected_at: new Date().toISOString(),
    cursors: same ? existing.cursors : {},
    shared_mailboxes: same ? existing.shared_mailboxes : [],
    send_from: same ? existing.send_from : null,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (!error) {
    // Separate so a sign-in still works before migration 043.
    await db.from('mail_connection').update({ granted_scopes: normalizeScopes(tokens.scope) ?? SCOPES }).eq('id', 1);
  }
  if (error) throw new OutlookError(/mail_connection/.test(error.message) ? 'Run migration 040 in Supabase first.' : error.message);
  cached = { token: tokens.access_token, expires: Date.now() + (tokens.expires_in - 120) * 1000 };
  return account;
}

// ------------------------------------------------------------ tokens

let cached: { token: string; expires: number } | null = null;

export type Folder = 'inbox' | 'sentitems';

export type Connection = {
  account_email: string;
  connected_at: string;
  shared_mailboxes: string[];
  send_from: string | null;
  cursors: Record<string, Partial<Record<Folder, string>>>;
  last_sync_at: string | null;
  last_error: string | null;
  /** Migration 043; undefined before it. */
  granted_scopes?: string | null;
  calendar_synced_at?: string | null;
};

const CONNECTION_COLUMNS = 'account_email, connected_at, shared_mailboxes, send_from, cursors, last_sync_at, last_error';

/** History pulled in the first time a mailbox is read, so timelines aren't empty. */
export const backfillFrom = () => new Date(Date.now() - BACKFILL_DAYS * 86_400_000).toISOString();

/** Every mailbox the CRM reads: the signed-in account first. */
export const mailboxesOf = (c: Connection) => [c.account_email, ...c.shared_mailboxes.filter((m) => m !== c.account_email)];

/** Graph's base path for a mailbox: /me for the signed-in account. */
export function mailboxPath(c: Pick<Connection, 'account_email'>, mailbox: string): string {
  return mailbox.toLowerCase() === c.account_email.toLowerCase() ? '/me' : `/users/${encodeURIComponent(mailbox)}`;
}

export async function loadConnection(db: SupabaseClient): Promise<Connection | null> {
  const full = await db.from('mail_connection').select(`${CONNECTION_COLUMNS}, granted_scopes, calendar_synced_at`).eq('id', 1).maybeSingle();
  if (!full.error) return (full.data as Connection | null) ?? null;
  // Before migration 043.
  const { data } = await db.from('mail_connection').select(CONNECTION_COLUMNS).eq('id', 1).maybeSingle();
  return (data as Connection | null) ?? null;
}

/** Whether CRM email should go out through Outlook: connected and working. */
export async function outlookReady(db: SupabaseClient): Promise<boolean> {
  if (!outlookConfigured()) return false;
  const c = await loadConnection(db);
  return Boolean(c && !c.last_error?.startsWith('Reconnect'));
}

async function accessToken(db: SupabaseClient): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;
  let row = await db.from('mail_connection').select('refresh_token, granted_scopes').eq('id', 1).maybeSingle();
  // Before migration 043.
  if (row.error) row = await db.from('mail_connection').select('refresh_token').eq('id', 1).maybeSingle() as typeof row;
  const data = row.data as { refresh_token: string; granted_scopes?: string | null } | null;
  if (!data) throw new OutlookError('Outlook is not connected');
  try {
    const tokens = await tokenRequest(
      { grant_type: 'refresh_token', refresh_token: decryptSecret(data.refresh_token) },
      refreshScopes(data.granted_scopes),
    );
    cached = { token: tokens.access_token, expires: Date.now() + (tokens.expires_in - 120) * 1000 };
    // Microsoft rotates refresh tokens; keep the newest.
    if (tokens.refresh_token) {
      await db.from('mail_connection').update({ refresh_token: encryptSecret(tokens.refresh_token), updated_at: new Date().toISOString() }).eq('id', 1);
    }
    return tokens.access_token;
  } catch (e) {
    const message = `Reconnect Outlook: ${e instanceof Error ? e.message : 'sign-in expired'}`;
    await db.from('mail_connection').update({ last_error: message, updated_at: new Date().toISOString() }).eq('id', 1);
    throw new OutlookError(message);
  }
}

export async function graph<T>(db: SupabaseClient, path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const token = await accessToken(db);
  const res = await fetch(path.startsWith('http') ? path : `${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    cache: 'no-store',
  });
  if (res.status === 202 || res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    if (res.status === 401) cached = null;
    throw new OutlookError(`Outlook: ${body.error?.message ?? `request failed (${res.status})`}`);
  }
  return body;
}

// ------------------------------------------------------------ sending

/**
 * Send from the chosen mailbox (Settings → Email; the signed-in account by
 * default). It lands in that mailbox's Sent Items and replies come back to it.
 * Another mailbox needs "Send as" for Lauren in Exchange.
 */
export type MailAttachment = { filename: string; content: string /* base64 */; contentType: string };

export async function sendFromOutlook(db: SupabaseClient, mail: { to: string; subject: string; html: string; attachments?: MailAttachment[] }) {
  const conn = await loadConnection(db);
  if (!conn) throw new OutlookError('Outlook is not connected');
  const base = mailboxPath(conn, conn.send_from ?? conn.account_email);
  await graph(db, `${base}/sendMail`, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject: mail.subject,
        body: { contentType: 'HTML', content: mail.html },
        toRecipients: [{ emailAddress: { address: mail.to } }],
        ...(mail.attachments?.length ? {
          attachments: mail.attachments.map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.contentType, contentBytes: a.content,
          })),
        } : {}),
      },
      saveToSentItems: true,
    }),
  });
}

// ------------------------------------------------------------ mailboxes

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Read another mailbox too, after checking Lauren really has access to it. */
export async function addSharedMailbox(db: SupabaseClient, email: string) {
  const mailbox = email.trim().toLowerCase();
  if (!EMAIL.test(mailbox)) throw new OutlookError('Enter a full email address');
  const conn = await loadConnection(db);
  if (!conn) throw new OutlookError('Connect Outlook first');
  if (mailboxesOf(conn).includes(mailbox)) return;
  try {
    await graph(db, `${mailboxPath(conn, mailbox)}/mailFolders/inbox?$select=id`);
  } catch (e) {
    throw new OutlookError(`Can't open ${mailbox}. In Exchange admin, give ${conn.account_email} Full Access to it, wait a few minutes, then try again. (${e instanceof Error ? e.message : ''})`);
  }
  await db.from('mail_connection').update({ shared_mailboxes: [...conn.shared_mailboxes, mailbox], updated_at: new Date().toISOString() }).eq('id', 1);
}

export async function removeSharedMailbox(db: SupabaseClient, email: string) {
  const conn = await loadConnection(db);
  if (!conn) return;
  const mailbox = email.trim().toLowerCase();
  await db.from('mail_connection').update({
    shared_mailboxes: conn.shared_mailboxes.filter((m) => m !== mailbox),
    send_from: conn.send_from === mailbox ? null : conn.send_from,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
}

export async function setSendFrom(db: SupabaseClient, email: string) {
  const conn = await loadConnection(db);
  if (!conn) throw new OutlookError('Connect Outlook first');
  const mailbox = email.trim().toLowerCase();
  if (!mailboxesOf(conn).includes(mailbox)) throw new OutlookError('Add that mailbox first');
  await db.from('mail_connection').update({
    send_from: mailbox === conn.account_email ? null : mailbox,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
}

export async function disconnectOutlook(db: SupabaseClient) {
  cached = null;
  await db.from('mail_connection').delete().eq('id', 1);
}
