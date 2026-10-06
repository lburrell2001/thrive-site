'use client';

// One print campaign: its details and cost, the QR code to put on the
// piece, what it's produced, and everyone it went to — with what the CRM
// noticed on its own (a reply, a deal, an inquiry through the QR code) and
// a place to mark how each person responded.

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import p from '../../../proposals/proposals.module.css';
import w from '../../workspace.module.css';
import { apiGet, apiSend, formatDate, formatMoneyCents } from '../../../proposals/adminApi';
import { useCrm } from '../../CrmContext';
import { avatarColor, initials, parseDollars, timeAgo } from '../../shared';
import { OUTCOME_LABEL, PIECE_LABEL, pct } from '../shared';
import { SITE_URL } from '@/lib/seo';
import type { CampaignStats, Outcome, RecipientRow } from '@/lib/marketing';

interface Campaign {
  id: string; name: string; piece: string; sent_on: string | null; cost_cents: number | null;
  notes: string; code: string; destination: string; created_at: string;
}
interface Detail {
  campaign: Campaign;
  recipients: RecipientRow[];
  stats: CampaignStats;
  scansByDay: { day: string; n: number }[];
  inquiries: { id: string; name: string; contact_id: string | null; created_at: string }[];
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { version, refresh, notify, openContact, contacts } = useCrm();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<Detail>(`/api/campaigns/${id}`)
      .then((r) => { if (!cancelled) setD(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the campaign'); });
    return () => { cancelled = true; };
  }, [id, version]);

  // The short link always uses the live domain: it's going on paper.
  const link = d ? `${SITE_URL}/m/${d.campaign.code}` : '';
  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then((svg) => { if (!cancelled) setQr(svg); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [link]);

  if (error) return <div className={w.page}><p className={w.empty}>{error}</p></div>;
  if (!d) return <div className={w.page}><p className={w.empty}>Loading…</p></div>;
  const c = d.campaign;
  const s = d.stats;
  const leads = s.leads + (s.inquiries ?? 0);

  async function patch(body: Partial<Campaign>, ok = 'Saved.') {
    try { await apiSend(`/api/campaigns/${id}`, 'PATCH', body); notify(ok); refresh(); } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save', 'error');
    }
  }

  async function setOutcome(contactId: string, outcome: Outcome) {
    try {
      await apiSend(`/api/campaigns/${id}/recipients`, 'PATCH', { contact_id: contactId, outcome });
      notify(outcome === 'lead' ? 'Marked as a lead — they’re on the pipeline now.' : 'Updated.');
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not update', 'error');
    }
  }

  async function removeRecipient(contactId: string) {
    try { await apiSend(`/api/campaigns/${id}/recipients?contact=${contactId}`, 'DELETE'); refresh(); } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not remove', 'error');
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${c.name}”? Its recipient list and scan counts go too; contacts and deals stay.`)) return;
    try { await apiSend(`/api/campaigns/${id}`, 'DELETE'); refresh(); router.push('/admin/crm/campaigns'); } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete', 'error');
    }
  }

  function download(kind: 'svg' | 'png') {
    const name = `qr-${c.code}.${kind}`;
    if (kind === 'svg') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([qr], { type: 'image/svg+xml' }));
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    // 1200px: sharp at print sizes up to about 2 inches.
    QRCode.toDataURL(link, { width: 1200, margin: 1, errorCorrectionLevel: 'M' }).then((url) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
    });
  }

  return (
    <div className={w.page}>
      <div className={w.head}>
        <div style={{ minWidth: 0 }}>
          <p className={w.eyebrow}><Link href="/admin/crm/campaigns" style={{ color: 'inherit' }}>← Campaigns</Link></p>
          <h1 className={w.title} style={{ fontSize: 26 }}>{c.name}</h1>
          <p className={w.sub}>
            <span className={`${w.pill} ${w.pillProspect}`}>{PIECE_LABEL[c.piece]}</span>{' '}
            {c.sent_on ? `Sent ${formatDate(c.sent_on)}` : 'Not sent yet'}
            {c.cost_cents != null ? ` · ${formatMoneyCents(c.cost_cents)}` : ''}
          </p>
        </div>
        <div className={w.headActions}>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => setAdding(true)}>Add recipients</button>
        </div>
      </div>

      <div className={w.statRow}>
        <div className={w.stat}><p className={w.statLabel}>Reached</p><p className={w.statValue}>{s.reached}</p></div>
        <div className={w.stat}><p className={w.statLabel}>QR scans</p><p className={w.statValue}>{s.scans ?? 0}</p><p className={w.statNote}>{s.scanners ?? 0} different people</p></div>
        <div className={w.stat}><p className={w.statLabel}>Responded</p><p className={w.statValue}>{s.responded}</p><p className={w.statNote}>{pct(s.responded, s.reached)} of recipients</p></div>
        <div className={w.stat}><p className={w.statLabel}>Leads</p><p className={w.statValue}>{leads}</p><p className={w.statNote}>{c.cost_cents && leads ? `${formatMoneyCents(Math.round(c.cost_cents / leads))} each` : `${s.inquiries ?? 0} via the QR code`}</p></div>
        <div className={w.stat}><p className={w.statLabel}>Won</p><p className={w.statValue}>{s.won ? formatMoneyCents(s.won_cents) : '—'}</p><p className={w.statNote}>{c.cost_cents && s.won_cents ? `${(s.won_cents / c.cost_cents).toFixed(1)}× the cost` : `${s.won} client${s.won === 1 ? '' : 's'}`}</p></div>
      </div>

      <div className={w.grid2} style={{ marginBottom: 18 }}>
        <section className={w.card}>
          <div className={w.cardHead}><h2 className={w.cardTitle}>QR code for the piece</h2></div>
          <div style={{ padding: 18, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ width: 150, height: 150, flex: 'none', border: '1px solid #ebe9e5', borderRadius: 12, padding: 8, background: '#fff' }}
              // The SVG is generated locally by the qrcode library from our own URL.
              dangerouslySetInnerHTML={{ __html: qr }} aria-label={`QR code for ${link}`} role="img" />
            <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 8 }}>
              <code style={{ fontSize: 13, wordBreak: 'break-all' }}>{link.replace(/^https?:\/\//, '')}</code>
              <p className={w.muted} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                Opens {c.destination === '/' ? 'the homepage' : c.destination}. Put the code on the design in Canva (SVG stays sharp at any size; keep it at least 0.8 in / 2 cm wide). You can also print the short link for people who type.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => download('svg')} disabled={!qr}>Download SVG</button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => download('png')} disabled={!qr}>Download PNG</button>
                <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => { void navigator.clipboard.writeText(link); notify('Link copied.'); }}>Copy link</button>
              </div>
              {d.scansByDay.length > 0 && (
                <p className={w.muted} style={{ margin: 0, fontSize: 12.5 }}>
                  Last scan {formatDate(d.scansByDay[d.scansByDay.length - 1].day)} · busiest day {formatDate([...d.scansByDay].sort((a, b) => b.n - a.n)[0].day)}
                </p>
              )}
            </div>
          </div>
        </section>

        <CampaignDetails key={`${c.id}:${c.sent_on}:${c.cost_cents}:${c.destination}:${c.notes}:${c.name}`} c={c} onSave={patch} onDelete={remove} />
      </div>

      {d.inquiries.length > 0 && (
        <section className={w.card} style={{ marginBottom: 18 }}>
          <div className={w.cardHead}><h2 className={w.cardTitle}>Inquiries through the QR code</h2><span className={`${w.cardCount} ${w.cardHot}`}>{d.inquiries.length}</span></div>
          {d.inquiries.map((i) => (
            <button key={i.id} type="button" className={w.item} onClick={() => i.contact_id && openContact(i.contact_id)}>
              <span className={w.avatar} style={{ background: i.contact_id ? avatarColor(i.contact_id) : '#a19d97' }}>{initials(i.name)}</span>
              <span className={w.itemMain}><span className={w.itemTitle}>{i.name}</span><span className={w.itemSub}>Sent the contact form after scanning</span></span>
              <span className={w.itemWhen}>{timeAgo(i.created_at)}</span>
            </button>
          ))}
        </section>
      )}

      <p className={w.navLabel} style={{ margin: '0 4px 8px' }}>Recipients · {d.recipients.length}</p>
      <div className={w.table}>
        {d.recipients.length === 0 && (
          <p className={w.empty}>Nobody on this campaign yet. Add the people it went to — pick them, or add every prospect with a tag.</p>
        )}
        {d.recipients.map((r) => (
          <div key={r.contact_id} className={w.row} style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 170px 28px' }}>
            <button type="button" className={w.who} style={{ all: 'unset', display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, cursor: 'pointer' }} onClick={() => openContact(r.contact_id)}>
              <span className={w.avatar} style={{ background: avatarColor(r.contact_id) }}>{initials(r.name, r.email)}</span>
              <span className={w.whoText}>
                <span className={w.truncate} style={{ display: 'block', fontWeight: 600 }}>{r.name}{r.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {r.company}</span> : null}</span>
                <span className={`${w.truncate} ${w.muted}`} style={{ display: 'block', fontSize: 12.5 }}>{r.note || r.email || ''}</span>
              </span>
            </button>
            <span className={w.chips}>
              {r.auto.won && <span className={`${w.pill} ${w.pillClient}`}>Won a deal</span>}
              {!r.auto.won && r.auto.deal && <span className={`${w.pill} ${w.pillLead}`}>Opened a deal</span>}
              {r.auto.inquiry && <span className={`${w.pill} ${w.pillBlue}`}>Inquired via QR</span>}
              {r.auto.replied && <span className={`${w.pill} ${w.pillBlue}`}>Replied to an email</span>}
            </span>
            <select className={p.select} value={r.outcome} onChange={(e) => setOutcome(r.contact_id, e.target.value as Outcome)} aria-label={`Outcome for ${r.name}`}
              style={{ fontWeight: 600 }}>
              {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
            </select>
            <button type="button" className={w.cardLink} aria-label={`Take ${r.name} off this campaign`} onClick={() => removeRecipient(r.contact_id)}>✕</button>
          </div>
        ))}
      </div>
      {d.recipients.length > 0 && (
        <p className={w.muted} style={{ fontSize: 12.5, margin: '8px 4px 0', lineHeight: 1.5 }}>
          Mark someone when they call or mention the {PIECE_LABEL[c.piece].toLowerCase()}; “Became a lead” opens a deal for them on the pipeline.
          The coloured tags beside each name are what the CRM spotted on its own within 60 days of sending.
        </p>
      )}

      {adding && <AddRecipients campaignId={id} existing={new Set(d.recipients.map((r) => r.contact_id))} contacts={contacts ?? []} onClose={() => setAdding(false)} onAdded={(n) => { setAdding(false); notify(`${n} added.`); refresh(); }} />}
    </div>
  );
}

function CampaignDetails({ c, onSave, onDelete }: { c: Campaign; onSave: (b: Partial<Campaign>) => Promise<void>; onDelete: () => void }) {
  const [name, setName] = useState(c.name);
  const [sentOn, setSentOn] = useState(c.sent_on ?? '');
  const [cost, setCost] = useState(c.cost_cents != null ? String(c.cost_cents / 100) : '');
  const [destination, setDestination] = useState(c.destination);
  const [notes, setNotes] = useState(c.notes);
  const cents = parseDollars(cost);
  const dirty = name !== c.name || sentOn !== (c.sent_on ?? '') || cents !== c.cost_cents || destination !== c.destination || notes !== c.notes;

  return (
    <form className={w.card} onSubmit={(e) => { e.preventDefault(); if (cents !== undefined) void onSave({ name, sent_on: sentOn || null, cost_cents: cents, destination, notes }); }}>
      <div className={w.cardHead}><h2 className={w.cardTitle}>Details</h2></div>
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ gridColumn: '1 / -1' }}><span className={p.label}>Name</span><input className={p.input} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label><span className={p.label}>Sent</span><input className={p.input} type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} /></label>
        <label><span className={p.label}>Total cost ($){cents === undefined && <span style={{ color: '#b00020' }}> · numbers only</span>}</span><input className={p.input} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Printing + postage" /></label>
        <label style={{ gridColumn: '1 / -1' }}><span className={p.label}>QR code opens (a page on the site)</span><input className={p.input} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="/portfolio" /></label>
        <label style={{ gridColumn: '1 / -1' }}><span className={p.label}>Notes</span><textarea className={p.textarea} rows={2} style={{ minHeight: 0 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Printer, quantity, the offer on the card…" /></label>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={onDelete}>Delete campaign</button>
          <button type="submit" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={!dirty || cents === undefined}>Save</button>
        </div>
      </div>
    </form>
  );
}

function AddRecipients({ campaignId, existing, contacts, onClose, onAdded }: {
  campaignId: string;
  existing: Set<string>;
  contacts: { id: string; name: string; company: string | null; email: string | null; tags: string[]; prospect_status: string | null }[];
  onClose: () => void;
  onAdded: (n: number) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const prospects = contacts.filter((c) => c.prospect_status === 'prospect');
  const tags = useMemo(() => [...new Set(prospects.flatMap((c) => c.tags))].sort(), [prospects]);
  const query = q.trim().toLowerCase();
  const list = contacts
    .filter((c) => !existing.has(c.id))
    .filter((c) => !query || [c.name, c.company, c.email, ...c.tags].some((v) => v?.toLowerCase().includes(query)))
    .sort((a, b) => Number(b.prospect_status === 'prospect') - Number(a.prospect_status === 'prospect'))
    .slice(0, 60);

  async function add(body: object) {
    setBusy(true); setError('');
    try {
      const r = await apiSend<{ added: number }>(`/api/campaigns/${campaignId}/recipients`, 'POST', body);
      onAdded(r.added);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add');
      setBusy(false);
    }
  }

  return (
    <>
      <div className={w.paletteBack} style={{ zIndex: 60 }} onClick={() => !busy && onClose()} />
      <div className={w.dialog} role="dialog" aria-modal="true" aria-labelledby="add-recipients-title" style={{ width: 'min(620px, calc(100vw - 32px))' }}>
        <h2 id="add-recipients-title" className={w.dialogTitle}>Who did it go to?</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
          <button type="button" className={p.btn} disabled={busy || !prospects.length} onClick={() => add({ all_prospects: true })}>All {prospects.length} prospects</button>
          {tags.length > 0 && (
            <>
              <select className={p.select} style={{ width: 'auto' }} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Prospects with tag">
                <option value="">Prospects tagged…</option>
                {tags.map((t) => <option key={t} value={t}>{t} ({prospects.filter((c) => c.tags.includes(t)).length})</option>)}
              </select>
              <button type="button" className={p.btn} disabled={busy || !tag} onClick={() => add({ tag })}>Add tag</button>
            </>
          )}
        </div>
        <input className={w.searchInput} style={{ maxWidth: 'none', width: '100%', boxSizing: 'border-box' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or pick people: search name, company, tag…" aria-label="Search contacts" autoFocus />
        <div className={w.table} style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
          {list.length === 0 && <p className={w.empty}>No one else to add.</p>}
          {list.map((c) => (
            <label key={c.id} className={w.item} style={{ cursor: 'pointer', alignItems: 'center' }}>
              <input type="checkbox" className={w.check} checked={picked.has(c.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
              <span className={w.itemMain}>
                <span className={w.itemTitle}>{c.name || c.email}{c.company ? <span className={w.muted} style={{ fontWeight: 500 }}> · {c.company}</span> : null}</span>
                <span className={w.itemSub}>{[c.prospect_status === 'prospect' ? 'Prospect' : null, ...c.tags].filter(Boolean).join(' · ') || c.email}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className={p.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={`${p.btn} ${p.btnPrimary}`} disabled={busy || !picked.size} onClick={() => add({ contact_ids: [...picked] })}>
            {busy ? 'Adding…' : `Add ${picked.size || ''}`.trim()}
          </button>
        </div>
      </div>
    </>
  );
}
