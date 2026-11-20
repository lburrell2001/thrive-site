// Drafts and locked final files (migration 073). A file is locked for the
// client when it's a draft, or a final copy tied to an invoice that isn't paid
// in full yet. Locked files never get a link to the original: the client sees
// only the watermarked preview (src/lib/watermark.ts), streamed by
// /api/portal/files/[id]/preview into a canvas.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DOC_BUCKET, docPath, signDocs } from './clientDocs';
import { canPreview, watermarkedPreview } from './watermark';
import { notifyPortalClient } from './clientNotify';
import { SITE_URL } from './seo';

export type FileStage = 'draft' | 'final';

export type FileRow = {
  id: string; client_id: string; name: string; project_name: string; file_url: string; created_at: string;
  stage?: FileStage | null; unlock_invoice_id?: string | null; preview_path?: string | null;
  /** The client's like / dislike (074). */
  reaction?: 'like' | 'dislike' | null;
};

export type FileComment = { id: string; file_id: string; author: 'client' | 'admin'; body: string; created_at: string };

/** Comments on a client's files, oldest first (074); none before it's run. */
export async function fileComments(db: SupabaseClient, clientId: string): Promise<FileComment[]> {
  const { data, error } = await db.from('portal_file_comments').select('id, file_id, author, body, created_at').eq('client_id', clientId).order('created_at', { ascending: true });
  return error ? [] : (data ?? []) as FileComment[];
}

type InvoiceBit = { id: string; invoice_number: string; status: string };

/** Why the client can't download it yet, or null when they can. */
export function lockOf(file: FileRow, invoice: InvoiceBit | undefined): 'draft' | 'unpaid' | null {
  if (file.stage === 'draft') return 'draft';
  if (file.unlock_invoice_id && invoice && invoice.status !== 'paid') return 'unpaid';
  return null;
}

/** Reads files with 073's columns, or without them before it's run. */
export async function selectFiles(db: SupabaseClient, clientId: string): Promise<FileRow[]> {
  const q = (cols: string) => db.from('portal_files').select(cols).eq('client_id', clientId).order('created_at', { ascending: false });
  let res = await q('id, client_id, name, project_name, file_url, created_at, stage, unlock_invoice_id, preview_path, reaction');
  if (res.error) res = await q('id, client_id, name, project_name, file_url, created_at, stage, unlock_invoice_id, preview_path');
  if (res.error) res = await q('id, client_id, name, project_name, file_url, created_at');
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as FileRow[];
}

async function invoicesFor(db: SupabaseClient, files: FileRow[]): Promise<Map<string, InvoiceBit>> {
  const ids = [...new Set(files.map((f) => f.unlock_invoice_id).filter(Boolean))] as string[];
  if (!ids.length) return new Map();
  const { data } = await db.from('portal_invoices').select('id, invoice_number, status').in('id', ids);
  return new Map(((data ?? []) as InvoiceBit[]).map((i) => [i.id, i]));
}

/**
 * What the client's portal gets: unlocked files with a signed link, locked ones
 * with no link at all — just whether a preview exists and what unlocks them.
 */
export async function filesForClient(db: SupabaseClient, clientId: string) {
  const [files, comments] = await Promise.all([selectFiles(db, clientId), fileComments(db, clientId)]);
  const invoices = await invoicesFor(db, files);
  const open = files.filter((f) => !lockOf(f, invoices.get(f.unlock_invoice_id ?? '')));
  const signed = new Map((await signDocs(db, open, ['file_url'])).map((f) => [f.id, f.file_url]));
  return files.map((f) => {
    const inv = invoices.get(f.unlock_invoice_id ?? '');
    const lock = lockOf(f, inv);
    return {
      id: f.id, name: f.name, project_name: f.project_name, created_at: f.created_at,
      stage: (f.stage ?? 'final') as FileStage,
      locked: lock,
      file_url: lock ? null : signed.get(f.id) ?? null,
      has_preview: Boolean(f.preview_path),
      unlock_invoice: inv ? { id: inv.id, invoice_number: inv.invoice_number } : null,
      reaction: f.reaction ?? null,
      comments: comments.filter((c) => c.file_id === f.id).map(({ id, author, body, created_at }) => ({ id, author, body, created_at })),
    };
  });
}

/** The name the watermark carries: their business, else their name. */
async function watermarkName(db: SupabaseClient, clientId: string): Promise<string> {
  const { data } = await db.from('portal_clients').select('full_name, company_name').eq('id', clientId).maybeSingle();
  const c = data as { full_name: string | null; company_name: string | null } | null;
  return [c?.full_name, c?.company_name].filter(Boolean).join(' · ');
}

/**
 * Makes (or remakes) a file's watermarked preview from its original. Only
 * images can be previewed; anything else stays locked with no preview.
 */
export async function makeFilePreview(db: SupabaseClient, fileId: string): Promise<{ ok: true; preview: boolean } | { ok: false; error: string }> {
  const { data: row, error } = await db.from('portal_files').select('id, client_id, name, file_url, stage, preview_path').eq('id', fileId).single();
  if (error || !row) return { ok: false, error: error?.message ?? 'File not found' };
  const path = docPath(row.file_url);
  if (!path || !canPreview(row.name)) return { ok: true, preview: false };

  const dl = await db.storage.from(DOC_BUCKET).download(path);
  if (dl.error || !dl.data) return { ok: false, error: 'Could not read the original to make its preview' };
  let jpeg: Buffer;
  try {
    jpeg = await watermarkedPreview(Buffer.from(await dl.data.arrayBuffer()), row.name, row.stage === 'draft' ? 'DRAFT' : 'PREVIEW', await watermarkName(db, row.client_id));
  } catch (e) {
    console.error('[draft files] preview failed', fileId, e);
    return { ok: false, error: 'Could not make a preview of that image' };
  }
  const previewPath = `client-files/${row.client_id}/previews/${row.id}.jpg`;
  const up = await db.storage.from(DOC_BUCKET).upload(previewPath, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (up.error) return { ok: false, error: up.error.message };
  await db.from('portal_files').update({ preview_path: previewPath }).eq('id', fileId);
  return { ok: true, preview: true };
}

/**
 * After an invoice is paid in full: tell the client which final files it
 * unlocked (once — called from the receipt, which is sent once per payment).
 */
export async function notifyUnlockedFiles(db: SupabaseClient, invoiceId: string): Promise<void> {
  const { data } = await db.from('portal_files').select('name, client_id, stage').eq('unlock_invoice_id', invoiceId).eq('stage', 'final');
  const files = (data ?? []) as { name: string; client_id: string }[];
  if (!files.length) return;
  const names = files.map((f) => f.name);
  await notifyPortalClient(db, files[0].client_id, {
    subject: names.length === 1 ? 'Your final file is ready to download' : 'Your final files are ready to download',
    headline: names.length === 1 ? 'Your final file is unlocked' : 'Your final files are unlocked',
    detail: `Thank you for your payment. You can now download ${names.length === 1 ? 'it' : 'them'} from your portal: ${names.join(', ')}.`,
    ctaUrl: `${SITE_URL}/portal/files`,
    ctaLabel: 'Download your files',
    sms: `your final files are unlocked — download them in your portal.`,
  });
}
