'use client';

// Asking a portal client for files (migration 075), on the Client tab: build a
// list of what's needed (starting lists, one-click items or typed ones), with
// an optional project, due date and note, and send it (email + text if they've
// opted in). Each request then shows what they've sent — files to open, links,
// notes, "doesn't have it" — with Remind, Mark received, Reopen, + Add and Delete.
// Server: /api/admin/asset-requests (assetRequestRepo.ts).

import { useCallback, useEffect, useState } from 'react';
import p from '../proposals/proposals.module.css';
import { apiGet, apiSend } from '../proposals/adminApi';
import { lastRemindedLabel } from '../ReminderDialog';
import type { ReminderTarget } from '@/lib/reminders';
import {
  ASSET_BUNDLES, ASSET_PRESETS, MAX_ITEMS, STATUS_LABEL, fileSize, itemAnswered, progressOf,
  type AssetRequest, type AssetStatus,
} from '@/lib/assetRequests';

type Draft = { key: number; label: string; hint: string; required: boolean };

const FONT = 'var(--a-font)';
const PILL: Record<AssetStatus, { bg: string; fg: string }> = {
  open: { bg: '#fd6100', fg: '#ffffff' },
  submitted: { bg: '#0cf574', fg: '#0a0a0a' },
  received: { bg: '#0a0a0a', fg: '#ffffff' },
};

let nextKey = 1;
const draftOf = (label: string, hint = '', required = true): Draft => ({ key: nextKey++, label, hint, required });
const presetHint = (label: string) => ASSET_PRESETS.find((x) => x.label === label)?.hint ?? '';
const isImage = (name: string) => /\.(jpe?g|png|gif|webp|svg)$/i.test(name);

function day(d: string) {
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The list being built: presets as chips, typed items, each with its hint and Required. */
function ItemsEditor({ items, setItems }: { items: Draft[]; setItems: (fn: (cur: Draft[]) => Draft[]) => void }) {
  const [typed, setTyped] = useState('');
  const has = (label: string) => items.some((i) => i.label.toLowerCase() === label.toLowerCase());
  const add = (label: string, hint = '') => {
    if (!label.trim() || has(label) || items.length >= MAX_ITEMS) return;
    setItems((cur) => [...cur, draftOf(label.trim(), hint)]);
  };
  const small: React.CSSProperties = { fontSize: 12, color: 'var(--a-muted)' };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ASSET_PRESETS.map((x) => (
          <button key={x.label} type="button" className={`${p.btn} ${p.btnSmall}`} disabled={has(x.label)} onClick={() => add(x.label, x.hint)}
            style={has(x.label) ? { opacity: 0.45 } : undefined}>+ {x.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className={p.input} placeholder="Something else, e.g. “Floor plan of the shop”" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={160}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(typed); setTyped(''); } }} />
        <button type="button" className={p.btn} disabled={!typed.trim()} onClick={() => { add(typed); setTyped(''); }}>Add</button>
      </div>
      {items.length === 0 && <p style={{ ...small, margin: 0 }}>Nothing on the list yet.</p>}
      {items.map((it, k) => (
        <div key={it.key} style={{ border: '1px solid var(--a-border)', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 6, background: '#fff' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ ...small, width: 18 }}>{k + 1}.</span>
            <input className={p.input} value={it.label} maxLength={160} aria-label="What you need"
              onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, label: e.target.value } : x)))} style={{ fontWeight: 600 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }} title="Off: they can send without it">
              <input type="checkbox" checked={it.required} onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, required: e.target.checked } : x)))} />
              Required
            </label>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} aria-label={`Remove ${it.label}`} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}>×</button>
          </div>
          <input className={p.input} value={it.hint} maxLength={500} placeholder="A line to help them (optional), e.g. “PNG with a transparent background”"
            onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, hint: e.target.value } : x)))} style={{ fontSize: 13, marginLeft: 24, width: 'calc(100% - 24px)' }} />
        </div>
      ))}
    </div>
  );
}

const toBody = (items: Draft[]) => items.filter((i) => i.label.trim()).map((i) => ({ label: i.label.trim(), hint: i.hint.trim() || null, required: i.required }));

export default function AssetRequestsSection({ clientId, projects, reminders, remind }: {
  clientId: string;
  projects: { id: string; name: string }[];
  reminders?: { target_type: string; target_id: string | null; created_at: string }[];
  remind: (target: ReminderTarget, title: string) => void;
}) {
  const [requests, setRequests] = useState<AssetRequest[] | null>(null);
  const [building, setBuilding] = useState(false);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<Draft[]>([]);
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ id: string; items: Draft[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let off = false;
    apiGet<{ requests: AssetRequest[] }>(`/api/admin/asset-requests?client=${clientId}`)
      .then((r) => { if (!off) setRequests(r.requests); })
      .catch((e) => { if (!off) { setRequests([]); setMsg({ text: e instanceof Error ? e.message : 'Could not load requests', tone: 'error' }); } });
    return () => { off = true; };
  }, [clientId, tick]);

  function start() {
    setTitle(''); setItems([]); setProjectId(projects.length === 1 ? projects[0].id : ''); setDueDate(''); setNote(''); setNotify(true);
    setBuilding(true); setMsg(null);
  }

  function applyBundle(b: (typeof ASSET_BUNDLES)[number]) {
    if (!title.trim()) setTitle(b.title);
    setItems((cur) => [...cur, ...b.items.filter((l) => !cur.some((c) => c.label === l)).map((l) => draftOf(l, presetHint(l)))]);
  }

  async function send() {
    const body = toBody(items);
    if (!title.trim() || !body.length) return;
    setBusy('send');
    try {
      const r = await apiSend<{ id: string; notified: string | null }>('/api/admin/asset-requests', 'POST', {
        clientId, projectId: projectId || null, title: title.trim(), note: note.trim() || null, dueDate: dueDate || null, items: body, notify,
      });
      setBuilding(false);
      setOpen(r.id);
      setMsg({ text: `Asked for ${body.length} thing${body.length === 1 ? '' : 's'}.${r.notified ? ` ${r.notified}.` : ''}`, tone: 'ok' });
      load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not send', tone: 'error' });
    }
    setBusy('');
  }

  async function act(r: AssetRequest, body: Record<string, unknown>, ok: string) {
    setBusy(r.id);
    try {
      const res = await apiSend<{ notified: string | null }>(`/api/admin/asset-requests/${r.id}`, 'PATCH', body);
      setMsg({ text: `${ok}${res.notified ? ` ${res.notified}.` : ''}`, tone: 'ok' });
      load();
      return true;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not update', tone: 'error' });
      return false;
    } finally {
      setBusy('');
    }
  }

  async function remove(r: AssetRequest) {
    const files = r.items.reduce((n, i) => n + i.files.length, 0);
    if (!window.confirm(`Delete “${r.title}”?${files ? ` The ${files} file${files === 1 ? '' : 's'} they uploaded will be deleted too — download anything you need first.` : ''} This can’t be undone.`)) return;
    setBusy(r.id);
    try { await apiSend(`/api/admin/asset-requests/${r.id}`, 'DELETE'); load(); }
    catch (e) { setMsg({ text: e instanceof Error ? e.message : 'Could not delete', tone: 'error' }); }
    setBusy('');
  }

  async function removeItem(r: AssetRequest, itemId: string, label: string, files: number) {
    if (!window.confirm(`Take “${label}” off the list?${files ? ` Their ${files} file${files === 1 ? '' : 's'} for it will be deleted.` : ''}`)) return;
    await act(r, { action: 'remove_item', itemId }, `Removed “${label}”.`);
  }

  async function addItems() {
    if (!adding) return;
    const r = requests?.find((x) => x.id === adding.id);
    const body = toBody(adding.items);
    if (!r || !body.length) return;
    if (await act(r, { action: 'add_items', items: body, notify: true }, `Added ${body.length} to “${r.title}”.`)) setAdding(null);
  }

  const box: React.CSSProperties = { border: '1px solid var(--a-border)', borderRadius: 10, padding: '12px 14px' };
  const small: React.CSSProperties = { fontFamily: FONT, fontSize: 12, color: 'var(--a-muted)' };
  const label: React.CSSProperties = { display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 600 };
  const waiting = requests?.filter((r) => r.status !== 'received').length ?? 0;

  return (
    <div style={{ fontFamily: FONT }} id="client-asset-requests">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 4px' }}>Files Requested</h3>
          <div style={small}>Logos, photos, copy… they upload them in their portal{requests && requests.length > 0 ? ` · ${waiting} open` : ''}</div>
        </div>
        {!building && <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={start} disabled={!requests}>+ Request files</button>}
      </div>

      {msg && <p style={{ fontSize: 13, margin: '0 0 10px', color: msg.tone === 'error' ? 'var(--a-danger)' : '#141414' }}>{msg.text}</p>}

      {building && (
        <div style={{ ...box, background: 'var(--a-surface-2)', marginBottom: 12, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={small}>Start from:</span>
            {ASSET_BUNDLES.map((b) => <button key={b.name} type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => applyBundle(b)}>{b.name}</button>)}
          </div>
          <label style={label}>
            Name it
            <input className={p.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Files for your website" />
          </label>
          <div style={label}>
            What you need
            <ItemsEditor items={items} setItems={setItems} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {projects.length > 0 && (
              <label style={{ ...label, flex: '1 1 200px' }}>
                For project (optional)
                <select className={p.select} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">No specific project</option>
                  {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                </select>
              </label>
            )}
            <label style={{ ...label, flex: '0 1 180px' }}>
              Needed by (optional)
              <input type="date" className={p.input} value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
          <label style={label}>
            A note from you (optional)
            <textarea className={p.input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Shown at the top of the request and in the email" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Email them the list (and text them if they’ve opted in)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!title.trim() || !toBody(items).length || busy === 'send'} onClick={send}>
              {busy === 'send' ? 'Sending…' : notify ? 'Send request' : 'Save request'}
            </button>
            <button type="button" className={p.btn} onClick={() => setBuilding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {requests === null && <p style={small}>Loading…</p>}
      {requests && requests.length === 0 && !building && <p style={{ fontSize: 14, color: '#bfbfbf', margin: 0 }}>Nothing requested yet.</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {requests?.map((r) => {
          const prog = progressOf(r.items);
          const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
          const c = PILL[r.status];
          const reminded = r.status === 'open' ? lastRemindedLabel(reminders, 'asset_request', r.id) : null;
          const expanded = open === r.id;
          const overdue = r.status === 'open' && r.due_date && r.due_date < new Date().toISOString().slice(0, 10);
          return (
            <div key={r.id} style={box}>
              <button type="button" onClick={() => setOpen(expanded ? null : r.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} aria-expanded={expanded}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14 }}>{r.title}</strong>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.fg }}>{STATUS_LABEL[r.status]}</span>
                  <span style={small}>
                    {prog.done} of {prog.total} sent{r.project_name ? ` · ${r.project_name}` : ''}
                    {r.due_date ? <> · <span style={overdue ? { color: '#e50586', fontWeight: 700 } : undefined}>needed by {day(r.due_date)}</span></> : ''}
                    {r.submitted_at && r.status !== 'open' ? ` · sent ${day(r.submitted_at)}` : ''}
                    {reminded ? ` · ${reminded}` : ''}
                  </span>
                  <span style={{ ...small, marginLeft: 'auto' }}>{expanded ? 'Hide' : 'Show'}</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: 999, height: 5, margin: '8px 0 0' }}>
                  <div style={{ height: 5, borderRadius: 999, background: '#0cf574', width: `${pct}%` }} />
                </div>
              </button>

              {expanded && (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {r.note && <p style={{ ...small, margin: 0, whiteSpace: 'pre-wrap' }}>Your note: {r.note}</p>}
                  {r.items.map((i) => (
                    <div key={i.id} style={{ borderTop: '1px solid var(--a-border)', paddingTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span aria-hidden style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, background: itemAnswered(i) ? '#0cf574' : '#ffffff', border: itemAnswered(i) ? 'none' : '1.5px solid #bfbfbf', display: 'grid', placeItems: 'center', fontSize: 10, color: '#0a0a0a' }}>{itemAnswered(i) ? '✓' : ''}</span>
                        <strong style={{ fontSize: 13.5, flex: 1 }}>{i.label}{!i.required && <span style={{ ...small, fontWeight: 500 }}> · optional</span>}</strong>
                        {r.status !== 'received' && <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy === r.id} onClick={() => removeItem(r, i.id, i.label, i.files.length)} aria-label={`Remove ${i.label}`}>×</button>}
                      </div>
                      <div style={{ marginLeft: 24, display: 'grid', gap: 6, marginTop: 4 }}>
                        {i.files.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {i.files.map((f) => (
                              <a key={f.path} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" title={`${f.name} · ${fileSize(f.size)}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--a-border)', borderRadius: 8, padding: 4, paddingRight: 8, fontSize: 12, color: '#0a0a0a', textDecoration: 'none', maxWidth: 240 }}>
                                {isImage(f.name) && f.url
                                  ? <img src={f.url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, background: '#f2f2f2' }} />
                                  : <span style={{ width: 36, height: 36, borderRadius: 6, background: '#f2f2f2', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{(f.name.split('.').pop() ?? '').toUpperCase().slice(0, 4)}</span>}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {i.link && <a href={i.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: '#3943b7', overflowWrap: 'anywhere' }}>{i.link}</a>}
                        {i.unavailable && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#e50586' }}>They don’t have this</span>}
                        {i.client_note && <span style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>“{i.client_note}”</span>}
                        {!itemAnswered(i) && <span style={small}>{i.hint || 'Nothing sent yet'}</span>}
                      </div>
                    </div>
                  ))}

                  {adding?.id === r.id && (
                    <div style={{ ...box, background: 'var(--a-surface-2)', display: 'grid', gap: 8 }}>
                      <ItemsEditor items={adding.items} setItems={(fn) => setAdding((a) => (a ? { ...a, items: fn(a.items) } : a))} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={!toBody(adding.items).length || busy === r.id} onClick={addItems}>Add and tell them</button>
                        <button type="button" className={p.btn} onClick={() => setAdding(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--a-border)', paddingTop: 8 }}>
                    {r.status !== 'received' && <button type="button" className={`${p.btn} ${p.btnSmall} ${r.status === 'submitted' ? p.btnPrimary : ''}`} disabled={busy === r.id} onClick={() => act(r, { action: 'received' }, `Marked “${r.title}” received.`)}>Mark received</button>}
                    {r.status === 'open' && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => remind({ kind: 'asset_request', id: r.id }, `Remind about ${r.title}`)}>Remind</button>}
                    {r.status !== 'open' && <button type="button" className={`${p.btn} ${p.btnSmall}`} disabled={busy === r.id}
                      onClick={() => { if (window.confirm(`Reopen “${r.title}” so they can send more? They’ll get the list again.`)) act(r, { action: 'reopen', notify: true }, `Reopened “${r.title}”.`); }}>Reopen</button>}
                    {adding?.id !== r.id && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => setAdding({ id: r.id, items: [] })}>+ Ask for more</button>}
                    <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} disabled={busy === r.id} onClick={() => remove(r)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
