'use client';

// File Requests (migration 075): what Lauren has asked this client to send.
// Each item takes uploads (straight to private storage with a signed upload
// link, so big photos are fine), a share link, a note, or "I don't have this";
// "Send" tells her. Server: /api/portal/asset-requests.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabasePortal } from '@/lib/supabasePortal';
import { portalApi, PortalApiError } from '@/lib/portalApi';
import { portalTrack } from '@/lib/portalTrack';
import {
  ASSET_ACCEPT, assetFileProblem, fileSize, itemAnswered, missingItems, progressOf,
  type AssetItem, type AssetRequest,
} from '@/lib/assetRequests';
import s from '@/components/questionnaire/questionnaire.module.css';

const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fetchAll = () => portalApi<{ requests: AssetRequest[] }>('/api/portal/asset-requests');

export default function Page() {
  return <Suspense fallback={null}><AssetRequestsPage /></Suspense>;
}

function AssetRequestsPage() {
  const params = useSearchParams();
  const focus = params.get('r');
  const [requests, setRequests] = useState<AssetRequest[] | null>(null);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    try { setRequests((await fetchAll()).requests); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your requests'); }
  }, []);
  useEffect(() => {
    fetchAll()
      .then((r) => setRequests(r.requests))
      .catch((e) => { setRequests([]); setError(e instanceof Error ? e.message : 'Could not load your requests'); });
  }, []);

  // The email's button opens ?r=<id>: scroll to it once it's on screen.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!focus || !requests || scrolled.current) return;
    scrolled.current = true;
    setTimeout(() => document.getElementById(`req-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [focus, requests]);

  const replace = (next: AssetRequest) => setRequests((cur) => cur?.map((r) => (r.id === next.id ? next : r)) ?? cur);
  const active = requests?.filter((r) => r.status !== 'received') ?? [];
  const done = requests?.filter((r) => r.status === 'received') ?? [];
  // Opened from a link to one they've already sent: show the closed ones too.
  const doneOpen = showDone || done.some((r) => r.id === focus);

  return (
    <div className={s.wrap} style={{ background: '#ffffff' }}>
      {error && <p className={s.err}>{error}</p>}
      {requests === null && <p className={s.muted}>Loading…</p>}

      {requests && requests.length === 0 && !error && (
        <div className={`${s.card} ${s.thanks}`}>
          <h2 className={s.h2}>Nothing To Send Right Now</h2>
          <p className={s.muted} style={{ fontSize: 15, maxWidth: 420, margin: '8px auto 0' }}>
            When I need logos, photos or anything else from you, the list will be here and I’ll email you.
          </p>
        </div>
      )}

      {requests && requests.length > 0 && active.length === 0 && (
        <div className={s.card}>
          <h2 className={s.h2}>You’re All Caught Up</h2>
          <p className={s.muted}>I have everything I asked for. Thank you!</p>
        </div>
      )}

      {active.map((r) => <RequestCard key={r.id} request={r} onChange={replace} reload={load} />)}

      {done.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <button type="button" className={s.btn} style={{ justifySelf: 'start' }} onClick={() => setShowDone(!doneOpen)} aria-expanded={doneOpen}>
            {doneOpen ? 'Hide' : 'Show'} what you’ve sent before ({done.length})
          </button>
          {doneOpen && done.map((r) => <RequestCard key={r.id} request={r} onChange={replace} reload={load} />)}
        </div>
      )}

      <p className={s.muted} style={{ fontSize: 13 }}>
        Sharing a password? Use the <Link href="/portal/vault" style={{ color: '#0a0a0a', fontWeight: 700 }}>Secure Vault</Link> instead, never a file or a note.
      </p>
    </div>
  );
}

function RequestCard({ request: r, onChange, reload }: { request: AssetRequest; onChange: (r: AssetRequest) => void; reload: () => Promise<void> }) {
  const editable = r.status !== 'received';
  const [missing, setMissing] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const prog = progressOf(r.items);
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;

  const setItem = (item: AssetItem) => {
    onChange({ ...r, items: r.items.map((i) => (i.id === item.id ? item : i)) });
    if (itemAnswered(item)) setMissing((m) => m.filter((x) => x !== item.id));
  };

  async function submit() {
    setErr('');
    const left = missingItems(r.items);
    if (left.length) {
      setMissing(left.map((i) => i.id));
      document.getElementById(`item-${left[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSending(true);
    try {
      await portalApi(`/api/portal/asset-requests/${r.id}`, { body: { action: 'submit' } });
      void portalTrack('action', { label: 'Sent requested files' });
      setSent(true);
      await reload();
    } catch (e) {
      if (e instanceof PortalApiError && Array.isArray(e.body.missing)) setMissing(e.body.missing as string[]);
      setErr(e instanceof Error ? e.message : 'Could not send');
    }
    setSending(false);
  }

  const pill = r.status === 'received'
    ? { text: 'Received', bg: '#0a0a0a', fg: '#fff' }
    : r.status === 'submitted' ? { text: 'Sent', bg: '#0cf574', fg: '#0a0a0a' } : { text: 'Waiting on you', bg: '#fd6100', fg: '#fff' };

  return (
    <section id={`req-${r.id}`} className={s.card} style={{ display: 'grid', gap: 14, scrollMarginTop: 16 }}>
      <div className={s.top}>
        <div style={{ minWidth: 0 }}>
          <h2 className={s.h2}>{r.title}</h2>
          <p className={s.muted}>
            {r.project_name ? `${r.project_name} · ` : ''}
            {r.due_date && editable ? `Needed by ${longDay(r.due_date)} · ` : ''}
            {prog.done} of {prog.total} sent
            {r.submitted_at && r.status !== 'open' ? ` · sent ${shortDay(r.submitted_at)}` : ''}
          </p>
        </div>
        <span className={s.pill} style={{ background: pill.bg, color: pill.fg }}>{pill.text}</span>
      </div>
      <div className={s.bar}><div className={s.barFill} style={{ width: `${pct}%` }} /></div>
      {r.note && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap', borderLeft: '3px solid #e50586', paddingLeft: 12 }}>{r.note}</p>}
      {r.status === 'submitted' && !sent && (
        <p className={s.muted} style={{ fontSize: 14 }}>You sent this. Forgot something? Add it below and press Send the update.</p>
      )}

      <div className={s.questions} style={{ marginTop: 0 }}>
        {r.items.map((item) => (
          <ItemCard key={item.id} requestId={r.id} item={item} editable={editable} missing={missing.includes(item.id)} onChange={setItem} />
        ))}
      </div>

      {sent && (
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Sent! Thank you. I’ll take a look and let you know if I need anything else.</p>
      )}
      {err && <p className={s.err}>{err}</p>}
      {editable && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : r.status === 'submitted' ? 'Send the update' : 'Send'}
          </button>
          <span className={s.muted}>Everything saves as you go, so you can come back to it.</span>
        </div>
      )}
    </section>
  );
}

function ItemCard({ requestId, item, editable, missing, onChange }: {
  requestId: string; item: AssetItem; editable: boolean; missing: boolean; onChange: (i: AssetItem) => void;
}) {
  const [link, setLink] = useState(item.link ?? '');
  const [note, setNote] = useState(item.client_note ?? '');
  const [showLink, setShowLink] = useState(Boolean(item.link));
  const [showNote, setShowNote] = useState(Boolean(item.client_note));
  const [uploading, setUploading] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const url = `/api/portal/asset-requests/${requestId}`;

  async function save(patch: { link?: string | null; client_note?: string | null; unavailable?: boolean }) {
    setErr('');
    try {
      await portalApi(url, { body: { action: 'save', itemId: item.id, ...patch } });
      const next = { ...item, ...patch };
      if (patch.link !== undefined) next.link = patch.link?.trim() ? (/^https?:\/\//i.test(patch.link.trim()) ? patch.link.trim() : `https://${patch.link.trim()}`) : null;
      onChange(next);
      setSaved('Saved');
      setTimeout(() => setSaved(''), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Not saved');
    }
  }

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const bad = files.map(assetFileProblem).find(Boolean);
    if (bad) { setErr(bad); return; }
    setErr('');
    let current = item;
    try {
      for (const [k, file] of files.entries()) {
        setUploading(files.length > 1 ? `Uploading ${k + 1} of ${files.length}…` : 'Uploading…');
        const meta = { name: file.name, size: file.size, type: file.type || 'application/octet-stream' };
        const { upload: u } = await portalApi<{ upload: { path: string; token: string; bucket: string } }>(url, { body: { action: 'upload_url', itemId: item.id, file: meta } });
        const { error } = await supabasePortal.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, file, { contentType: meta.type });
        if (error) throw new Error(`${file.name} didn’t upload. Try again.`);
        await portalApi(url, { body: { action: 'attach', itemId: item.id, file: { ...meta, path: u.path } } });
        current = { ...current, unavailable: false, files: [...current.files, { ...meta, path: u.path, url: null }] };
        onChange(current);
      }
      void portalTrack('action', { label: 'Uploaded requested files' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    }
    setUploading('');
  }

  async function removeFile(path: string) {
    setErr('');
    try {
      await portalApi(url, { body: { action: 'remove_file', itemId: item.id, path } });
      onChange({ ...item, files: item.files.filter((f) => f.path !== path) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not remove that file');
    }
  }

  const done = itemAnswered(item);
  return (
    <div id={`item-${item.id}`} className={`${s.q} ${missing ? s.qMissing : ''}`} style={{ scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span aria-hidden style={{ marginTop: 2, width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: done ? '#0cf574' : '#fff', border: done ? 'none' : '1.5px solid #cfcfcf' }}>{done ? '✓' : ''}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className={s.prompt}>{item.label}{!item.required && <span className={s.muted} style={{ fontWeight: 500 }}> (optional)</span>}</span>
          {item.hint && <p className={s.help} style={{ marginBottom: 0 }}>{item.hint}</p>}
        </div>
      </div>

      {item.files.length > 0 && (
        <ul className={s.files}>
          {item.files.map((f) => (
            <li key={f.path} className={s.file}>
              {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer">{f.name}</a> : <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{f.name}</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={s.muted} style={{ whiteSpace: 'nowrap' }}>{fileSize(f.size)}</span>
                {editable && <button type="button" className={s.fileX} onClick={() => removeFile(f.path)} aria-label={`Remove ${f.name}`}>×</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!editable && item.link && <p style={{ margin: '10px 0 0', fontSize: 14, overflowWrap: 'anywhere' }}><a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#0a0a0a' }}>{item.link}</a></p>}
      {!editable && item.unavailable && <p className={s.muted} style={{ marginTop: 10 }}>You didn’t have this one.</p>}
      {!editable && item.client_note && <p style={{ margin: '10px 0 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{item.client_note}</p>}

      {editable && (
        <>
          <div className={s.choices}>
            <label className={`${s.choice} ${s.choiceOn}`} style={{ cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
              <input type="file" multiple accept={ASSET_ACCEPT} disabled={!!uploading} style={{ display: 'none' }}
                onChange={(e) => { const l = e.target.files; void upload(l).finally(() => { e.target.value = ''; }); }} />
              {uploading || (item.files.length ? '+ Upload more' : '↑ Upload files')}
            </label>
            {!showLink && <button type="button" className={s.choice} onClick={() => setShowLink(true)}>Paste a link</button>}
            {!showNote && <button type="button" className={s.choice} onClick={() => setShowNote(true)}>Add a note</button>}
            {item.files.length === 0 && !item.link && (
              <button type="button" className={`${s.choice} ${item.unavailable ? s.choiceOn : ''}`} aria-pressed={item.unavailable}
                onClick={() => save({ unavailable: !item.unavailable })}>
                {item.unavailable ? '✓ I don’t have this' : 'I don’t have this'}
              </button>
            )}
          </div>
          {showLink && (
            <input className={s.input} type="url" inputMode="url" value={link} placeholder="Google Drive, Dropbox or WeTransfer link"
              onChange={(e) => setLink(e.target.value)} onBlur={() => { if ((item.link ?? '') !== link.trim()) void save({ link: link.trim() || null }); }} />
          )}
          {showNote && (
            <textarea className={s.textarea} style={{ minHeight: 80 }} value={note} maxLength={2000} placeholder="Anything I should know, or type it here instead of a file"
              onChange={(e) => setNote(e.target.value)} onBlur={() => { if ((item.client_note ?? '') !== note.trim()) void save({ client_note: note.trim() || null }); }} />
          )}
          {item.unavailable && <p className={s.muted} style={{ marginTop: 8 }}>No problem. Add a note if there’s something close, or I’ll figure it out with you.</p>}
        </>
      )}
      {missing && <p className={s.missingNote}>Upload a file, paste a link, add a note, or tap “I don’t have this”.</p>}
      {err && <p className={s.missingNote}>{err}</p>}
      {saved && <p className={s.muted} style={{ marginTop: 6 }}>{saved}</p>}
    </div>
  );
}
