// Asset requests (migration 075): every read and write. Lauren makes a request
// from the Client tab (emailed + texted to the client); the client fills it in
// at /portal/assets — uploads straight to the private client-documents bucket
// with a signed upload URL (no 4.5 MB Vercel limit), links, notes, "I don't
// have this" — and sends it, which tells Lauren. Tables have RLS on and no
// policies: only these server functions read them.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DOC_BUCKET } from './clientDocs';
import { deliver, portalContact } from './clientNotify';
import { tellLauren } from './agencyNotify';
import { SITE_URL } from './seo';
import {
  MAX_FILES_PER_ITEM, assetFileProblem, cleanLink, itemAnswered, missingItems, progressOf,
  type AssetFile, type AssetItem, type AssetRequest, type AssetStatus,
} from './assetRequests';

export class AssetError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const LINK_SECONDS = 60 * 60;
const REQ_COLS = 'id, client_id, project_id, title, note, due_date, status, submitted_at, received_at, created_at';
const ITEM_COLS = 'id, request_id, position, label, hint, required, files, link, client_note, unavailable';

type ReqRow = Omit<AssetRequest, 'items' | 'project_name'>;
type ItemRow = Omit<AssetItem, 'files'> & { request_id: string; files: unknown };

function missingTable(e: { message?: string; code?: string } | null) {
  return Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /asset_request/.test(e.message ?? '') && /exist|schema cache/.test(e.message ?? '')));
}

const filesOf = (v: unknown): AssetFile[] => (Array.isArray(v) ? v.filter((f): f is AssetFile => !!f && typeof f === 'object' && typeof (f as AssetFile).path === 'string') : []);

/** Requests with their items and project names; file links signed for an hour. */
async function hydrate(db: SupabaseClient, reqs: ReqRow[]): Promise<AssetRequest[]> {
  if (!reqs.length) return [];
  const ids = reqs.map((r) => r.id);
  const projectIds = [...new Set(reqs.map((r) => r.project_id).filter((x): x is string => !!x))];
  const [{ data: items, error }, { data: projects }] = await Promise.all([
    db.from('asset_request_items').select(ITEM_COLS).in('request_id', ids).order('position'),
    projectIds.length ? db.from('portal_projects').select('id, name').in('id', projectIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  if (error) throw new AssetError(error.message, 500);
  const rows = (items ?? []) as ItemRow[];

  const paths = rows.flatMap((i) => filesOf(i.files).map((f) => f.path));
  const signed = new Map<string, string>();
  for (let k = 0; k < paths.length; k += 100) {
    const { data } = await db.storage.from(DOC_BUCKET).createSignedUrls(paths.slice(k, k + 100), LINK_SECONDS);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }

  const names = new Map((projects ?? []).map((p) => [p.id, p.name]));
  return reqs.map((r) => ({
    ...r,
    project_name: r.project_id ? names.get(r.project_id) ?? null : null,
    items: rows.filter((i) => i.request_id === r.id).map((i) => ({
      id: i.id, position: i.position, label: i.label, hint: i.hint, required: i.required,
      link: i.link, client_note: i.client_note, unavailable: i.unavailable,
      files: filesOf(i.files).map((f) => ({ ...f, url: signed.get(f.path) ?? null })),
    })),
  }));
}

// ───────────────────────────────────────────────────────────── admin

export async function clientAssetRequests(db: SupabaseClient, clientId: string): Promise<AssetRequest[]> {
  const { data, error } = await db.from('asset_requests').select(REQ_COLS).eq('client_id', clientId).order('created_at', { ascending: false });
  if (error) throw new AssetError(missingTable(error) ? 'Run migration 075 to turn on asset requests.' : error.message, 500);
  return hydrate(db, (data ?? []) as ReqRow[]);
}

/** Everything not yet received, for Home: sent ones to check first. */
export async function waitingAssetRequests(db: SupabaseClient) {
  const { data, error } = await db.from('asset_requests').select(REQ_COLS).neq('status', 'received').order('created_at', { ascending: false }).limit(100);
  if (error) {
    if (missingTable(error)) return [];
    throw new AssetError(error.message, 500);
  }
  const reqs = (data ?? []) as ReqRow[];
  if (!reqs.length) return [];
  const ids = reqs.map((r) => r.id);
  const clientIds = [...new Set(reqs.map((r) => r.client_id))];
  const [{ data: items }, { data: clients }] = await Promise.all([
    db.from('asset_request_items').select('request_id, files, link, client_note, unavailable').in('request_id', ids),
    db.from('portal_clients').select('id, full_name, company_name').in('id', clientIds),
  ]);
  const who = new Map((clients ?? []).map((c) => [c.id, c]));
  return reqs.map((r) => {
    const mine = (items ?? []).filter((i) => i.request_id === r.id).map((i) => ({ ...i, files: filesOf(i.files) }));
    return {
      id: r.id, client_id: r.client_id, title: r.title, status: r.status, due_date: r.due_date, created_at: r.created_at, submitted_at: r.submitted_at,
      client_name: who.get(r.client_id)?.full_name ?? null, company_name: who.get(r.client_id)?.company_name ?? null,
      done: mine.filter(itemAnswered).length, total: mine.length,
    };
  }).sort((a, b) => Number(b.status === 'submitted') - Number(a.status === 'submitted'));
}

export interface NewItem { label: string; hint?: string | null; required?: boolean }

const cleanItems = (items: NewItem[], start = 0) => items
  .map((i) => ({ label: i.label.trim().slice(0, 160), hint: i.hint?.trim().slice(0, 500) || null, required: i.required ?? true }))
  .filter((i) => i.label)
  .map((i, k) => ({ ...i, position: start + k }));

export async function createAssetRequest(db: SupabaseClient, input: {
  clientId: string; projectId: string | null; title: string; note: string | null; dueDate: string | null; items: NewItem[]; notify: boolean;
}) {
  const items = cleanItems(input.items);
  if (!items.length) throw new AssetError('Add at least one thing you need.');
  const { data: client } = await db.from('portal_clients').select('id').eq('id', input.clientId).maybeSingle();
  if (!client) throw new AssetError('Client not found', 404);
  if (input.projectId) {
    const { data: pr } = await db.from('portal_projects').select('id').eq('id', input.projectId).eq('client_id', input.clientId).maybeSingle();
    if (!pr) throw new AssetError('That project isn’t theirs');
  }
  const { data: req, error } = await db.from('asset_requests').insert({
    client_id: input.clientId, project_id: input.projectId, title: input.title.trim(),
    note: input.note?.trim() || null, due_date: input.dueDate || null,
  }).select(REQ_COLS).single();
  if (error || !req) throw new AssetError(missingTable(error) ? 'Run migration 075 to turn on asset requests.' : error?.message ?? 'Could not save', 500);
  const { error: itemErr } = await db.from('asset_request_items').insert(items.map((i) => ({ ...i, request_id: req.id })));
  if (itemErr) {
    await db.from('asset_requests').delete().eq('id', req.id);
    throw new AssetError(itemErr.message, 500);
  }
  const projectName = input.projectId ? (await db.from('portal_projects').select('name').eq('id', input.projectId).maybeSingle()).data?.name ?? null : null;
  await db.from('portal_activity').insert({
    client_id: input.clientId, text: `Files requested: ${req.title}`, dot_color: '#fd6100', ...(projectName ? { project_name: projectName } : {}),
  }).then(() => undefined, () => undefined);

  const notified = input.notify ? await notifyRequested(db, req as ReqRow, items.map((i) => i.label)) : null;
  return { id: req.id as string, notified };
}

function dueLabel(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

async function notifyRequested(db: SupabaseClient, req: ReqRow, labels: string[]): Promise<string> {
  const contact = await portalContact(db, req.client_id);
  if (!contact) return 'Not sent: client not found';
  const due = dueLabel(req.due_date);
  const report = await deliver(db, contact, {
    subject: `A few things I need from you: ${req.title}`,
    eyebrow: 'Files I need',
    headline: `To keep your project moving, could you send me ${labels.length === 1 ? 'this' : `these ${labels.length} things`}${due ? ` by ${due}` : ''}?`,
    detail: [
      ...labels.map((l) => `• ${l}`),
      '',
      'Upload them in your client portal from your phone or computer. If something’s too big, paste a Google Drive or Dropbox link, and if you don’t have something, just tell me.',
    ].join('\n'),
    note: req.note,
    ctaUrl: `${SITE_URL}/portal/assets?r=${req.id}`,
    ctaLabel: 'Send the files',
    sms: `I need a few files from you for ${req.title}${due ? ` by ${due}` : ''}. Upload them in your client portal:`,
  }, { email: true, sms: true });
  const parts = [report.email.status === 'sent' ? `emailed ${report.email.to}` : null, report.sms.status === 'sent' ? 'texted' : null].filter(Boolean);
  return parts.length ? `Client ${parts.join(' and ')}` : `Not sent${report.email.error ? `: ${report.email.error}` : ''}`;
}

async function getRequest(db: SupabaseClient, id: string): Promise<ReqRow> {
  const { data, error } = await db.from('asset_requests').select(REQ_COLS).eq('id', id).maybeSingle();
  if (error) throw new AssetError(error.message, 500);
  if (!data) throw new AssetError('Request not found', 404);
  return data as ReqRow;
}

export type AdminAction =
  | { action: 'received' }
  | { action: 'reopen'; note?: string | null; notify?: boolean }
  | { action: 'edit'; title?: string; note?: string | null; dueDate?: string | null; projectId?: string | null }
  | { action: 'add_items'; items: NewItem[]; notify?: boolean }
  | { action: 'remove_item'; itemId: string };

export async function updateAssetRequest(db: SupabaseClient, id: string, body: AdminAction) {
  const req = await getRequest(db, id);
  const now = new Date().toISOString();
  switch (body.action) {
    case 'received': {
      await must(db.from('asset_requests').update({ status: 'received', received_at: now, updated_at: now }).eq('id', id));
      return { notified: null };
    }
    case 'reopen': {
      await must(db.from('asset_requests').update({ status: 'open', received_at: null, updated_at: now, ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}) }).eq('id', id));
      if (!body.notify) return { notified: null };
      const fresh = await getRequest(db, id);
      const { data: items } = await db.from('asset_request_items').select('label').eq('request_id', id).order('position');
      return { notified: await notifyRequested(db, fresh, (items ?? []).map((i) => i.label)) };
    }
    case 'edit': {
      const patch: Record<string, unknown> = { updated_at: now };
      if (body.title !== undefined) { if (!body.title.trim()) throw new AssetError('Give it a name'); patch.title = body.title.trim().slice(0, 160); }
      if (body.note !== undefined) patch.note = body.note?.trim() || null;
      if (body.dueDate !== undefined) patch.due_date = body.dueDate || null;
      if (body.projectId !== undefined) {
        if (body.projectId) {
          const { data: pr } = await db.from('portal_projects').select('id').eq('id', body.projectId).eq('client_id', req.client_id).maybeSingle();
          if (!pr) throw new AssetError('That project isn’t theirs');
        }
        patch.project_id = body.projectId;
      }
      await must(db.from('asset_requests').update(patch).eq('id', id));
      return { notified: null };
    }
    case 'add_items': {
      const { data: last } = await db.from('asset_request_items').select('position').eq('request_id', id).order('position', { ascending: false }).limit(1);
      const items = cleanItems(body.items, (last?.[0]?.position ?? -1) + 1);
      if (!items.length) throw new AssetError('Add at least one thing you need.');
      await must(db.from('asset_request_items').insert(items.map((i) => ({ ...i, request_id: id }))));
      // Something new to send: it's waiting on them again.
      await must(db.from('asset_requests').update({ status: 'open', received_at: null, updated_at: now }).eq('id', id));
      if (!body.notify) return { notified: null };
      return { notified: await notifyRequested(db, { ...req, status: 'open' }, items.map((i) => i.label)) };
    }
    case 'remove_item': {
      const { data: item } = await db.from('asset_request_items').select('id, files').eq('id', body.itemId).eq('request_id', id).maybeSingle();
      if (!item) throw new AssetError('Not found', 404);
      const paths = filesOf(item.files).map((f) => f.path);
      await must(db.from('asset_request_items').delete().eq('id', item.id));
      if (paths.length) await db.storage.from(DOC_BUCKET).remove(paths);
      return { notified: null };
    }
  }
}

/** Removes the request and every file the client uploaded to it. */
export async function deleteAssetRequest(db: SupabaseClient, id: string) {
  await getRequest(db, id);
  const { data: items } = await db.from('asset_request_items').select('files').eq('request_id', id);
  const paths = (items ?? []).flatMap((i) => filesOf(i.files).map((f) => f.path));
  await must(db.from('asset_requests').delete().eq('id', id));
  for (let k = 0; k < paths.length; k += 100) await db.storage.from(DOC_BUCKET).remove(paths.slice(k, k + 100));
}

async function must(q: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await q;
  if (error) throw new AssetError(error.message, 500);
}

// ───────────────────────────────────────────────────────────── client

/** The client's own requests (newest first), with links to what they've sent. */
export async function myAssetRequests(db: SupabaseClient, clientId: string) {
  const { data, error } = await db.from('asset_requests').select(REQ_COLS).eq('client_id', clientId).order('created_at', { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new AssetError(error.message, 500);
  }
  return hydrate(db, (data ?? []) as ReqRow[]);
}

async function ownItem(db: SupabaseClient, requestId: string, itemId: string, clientId: string) {
  const req = await getRequest(db, requestId).catch(() => null);
  if (!req || req.client_id !== clientId) throw new AssetError('Not found', 404);
  if (req.status === 'received') throw new AssetError('This request is closed. Need to send something else? Use the ? button and I’ll reopen it.', 409);
  const { data: item } = await db.from('asset_request_items').select(ITEM_COLS).eq('id', itemId).eq('request_id', requestId).maybeSingle();
  if (!item) throw new AssetError('Not found', 404);
  return { req, item: { ...(item as ItemRow), files: filesOf((item as ItemRow).files) } };
}

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-90) || 'file';
const folderOf = (req: ReqRow, itemId: string) => `assets/${req.client_id}/${req.id}/${itemId}/`;

export async function signAssetUpload(db: SupabaseClient, clientId: string, requestId: string, itemId: string, file: { name: string; size: number; type: string }) {
  const { req, item } = await ownItem(db, requestId, itemId, clientId);
  const problem = assetFileProblem(file);
  if (problem) throw new AssetError(problem);
  if (item.files.length >= MAX_FILES_PER_ITEM) throw new AssetError(`Up to ${MAX_FILES_PER_ITEM} files each. Zip the rest or paste a link.`);
  const path = `${folderOf(req, item.id)}${Date.now()}-${safeName(file.name)}`;
  const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new AssetError(error?.message ?? 'Could not start the upload', 500);
  return { path: data.path, token: data.token, bucket: DOC_BUCKET };
}

export async function attachAssetFile(db: SupabaseClient, clientId: string, requestId: string, itemId: string, file: { path: string; name: string; size: number; type: string }) {
  const { req, item } = await ownItem(db, requestId, itemId, clientId);
  const prefix = folderOf(req, item.id);
  if (!file.path.startsWith(prefix) || file.path.includes('..')) throw new AssetError('That upload doesn’t belong here');
  const name = file.path.slice(prefix.length);
  const { data: found } = await db.storage.from(DOC_BUCKET).list(prefix.slice(0, -1), { search: name });
  if (!found?.some((f) => f.name === name)) throw new AssetError('The upload didn’t finish. Try again.');
  const files = [...item.files.filter((f) => f.path !== file.path), {
    path: file.path, name: file.name.slice(0, 200), size: file.size, type: file.type.slice(0, 200), uploaded_at: new Date().toISOString(),
  }];
  await must(db.from('asset_request_items').update({ files, unavailable: false, updated_at: new Date().toISOString() }).eq('id', item.id));
}

export async function removeAssetFile(db: SupabaseClient, clientId: string, requestId: string, itemId: string, path: string) {
  const { item } = await ownItem(db, requestId, itemId, clientId);
  if (!item.files.some((f) => f.path === path)) return;
  await db.storage.from(DOC_BUCKET).remove([path]);
  await must(db.from('asset_request_items').update({ files: item.files.filter((f) => f.path !== path), updated_at: new Date().toISOString() }).eq('id', item.id));
}

export async function saveAssetItem(db: SupabaseClient, clientId: string, requestId: string, itemId: string, patch: { link?: string | null; client_note?: string | null; unavailable?: boolean }) {
  const { item } = await ownItem(db, requestId, itemId, clientId);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.link !== undefined) {
    const link = cleanLink(patch.link);
    if (patch.link?.trim() && !link) throw new AssetError('That link doesn’t look right. Copy the share link and paste it here.');
    update.link = link;
  }
  if (patch.client_note !== undefined) update.client_note = patch.client_note?.trim().slice(0, 2000) || null;
  if (patch.unavailable !== undefined) update.unavailable = patch.unavailable;
  await must(db.from('asset_request_items').update(update).eq('id', item.id));
}

/** "That's everything": marks it sent and tells Lauren what came in. */
export async function submitAssetRequest(db: SupabaseClient, clientId: string, requestId: string) {
  const req = await getRequest(db, requestId).catch(() => null);
  if (!req || req.client_id !== clientId) throw new AssetError('Not found', 404);
  if (req.status === 'received') throw new AssetError('This request is already closed.', 409);
  const [full] = await hydrate(db, [req]);
  const missing = missingItems(full.items);
  if (missing.length) return { ok: false as const, missing: missing.map((i) => i.id) };
  const again = req.status === 'submitted';
  const now = new Date().toISOString();
  await must(db.from('asset_requests').update({ status: 'submitted' as AssetStatus, submitted_at: now, updated_at: now }).eq('id', req.id));

  const { data: client } = await db.from('portal_clients').select('full_name, company_name').eq('id', clientId).maybeSingle();
  const name = client?.company_name || client?.full_name || 'A client';
  const p = progressOf(full.items);
  const lines = full.items.map((i) => {
    const what = [
      i.files.length ? `${i.files.length} file${i.files.length === 1 ? '' : 's'}` : null,
      i.link ? `link: ${i.link}` : null,
      i.unavailable ? 'doesn’t have it' : null,
      i.client_note ? `“${i.client_note}”` : null,
    ].filter(Boolean).join(' · ');
    return `• ${i.label}: ${what || 'nothing yet'}`;
  });
  await db.from('portal_activity').insert({
    client_id: clientId, text: `Files sent: ${req.title}`, dot_color: '#0cf574', ...(full.project_name ? { project_name: full.project_name } : {}),
  }).then(() => undefined, () => undefined);
  await tellLauren(
    `${name} ${again ? 'sent more files for' : 'sent the files for'} ${req.title}`,
    `${client?.full_name || name}${client?.company_name ? ` (${client.company_name})` : ''} ${again ? 'updated' : 'sent'} “${req.title}” in their portal (${p.done} of ${p.total} answered).\n\n${lines.join('\n')}\n\nOpen it on their Client tab: ${SITE_URL}/admin/clients?client=${clientId}`,
    `${name} ${again ? 'sent more files for' : 'sent the files for'} ${req.title} (${p.done} of ${p.total}). ${SITE_URL}/admin/clients?client=${clientId}`,
  );
  return { ok: true as const };
}
