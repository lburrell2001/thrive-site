'use client';

// Proposals in the portal: the ones Thrive built (read and sign online — the
// same signing page as the emailed link, with its estimate to download) and
// uploaded PDF proposals (download, sign, upload the signed copy).

import { useCallback, useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';
import { portalApi } from '@/lib/portalApi';
import { loadMyDocuments } from '@/lib/portalDocuments';

interface BuiltProposal {
  id: string; title: string; status: string; total_cents: number; currency: string; deposit_percent: number;
  sent_at: string | null; signed_at: string | null; declined_at: string | null; valid_until: string | null; href: string;
}
interface UploadedProposal { id: string; name: string; file_url: string; signed_file_url: string | null; status: string; created_at: string }

const F = `var(--font-inter), Inter, sans-serif`;
const money = (c: number, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const day = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function statusOf(p: BuiltProposal): { label: string; color: string; bg: string } {
  if (p.status === 'signed') return { label: `Signed${p.signed_at ? ` ${day(p.signed_at)}` : ''}`, color: '#0a0a0a', bg: '#0cf574' };
  if (p.status === 'declined') return { label: 'Declined', color: '#fff', bg: '#e50586' };
  if (p.status === 'expired' || (p.valid_until && p.valid_until < new Date().toISOString().slice(0, 10))) return { label: 'Expired', color: '#fff', bg: '#0a0a0a' };
  return { label: 'Awaiting your signature', color: '#fff', bg: '#fd6100' };
}

export default function PortalProposalsPage() {
  const [built, setBuilt] = useState<BuiltProposal[]>([]);
  const [uploaded, setUploaded] = useState<UploadedProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [justSigned, setJustSigned] = useState<string | null>(null);

  const fetchAll = () => Promise.all([
    portalApi<{ proposals: BuiltProposal[] }>('/api/portal/proposals').catch(() => ({ proposals: [] as BuiltProposal[] })),
    loadMyDocuments<unknown, UploadedProposal>(),
  ]);

  const load = useCallback(async () => {
    const [b, docs] = await fetchAll();
    setBuilt(b.proposals);
    setUploaded(docs?.proposals ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll().then(([b, docs]) => {
      if (cancelled) return;
      setBuilt(b.proposals);
      setUploaded(docs?.proposals ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSignedUpload(proposalId: string, file: File) {
    if (file.size > 20 * 1024 * 1024) { setUploadError('File must be under 20 MB'); return; }
    setUploadingId(proposalId); setUploadError(''); setJustSigned(null);
    const { data: { session } } = await supabasePortal.auth.getSession();
    if (!session?.access_token) { setUploadError('Session expired — please refresh the page.'); setUploadingId(null); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch('/api/portal/submit-proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ proposalId, fileName: file.name, fileData: base64, mimeType: file.type }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (json.error) setUploadError(json.error);
        else { setJustSigned(proposalId); await load(); }
      } catch {
        setUploadError('Upload failed — please try again.');
      }
      setUploadingId(null);
    };
    reader.onerror = () => { setUploadError('Could not read file.'); setUploadingId(null); };
    reader.readAsDataURL(file);
  }

  const waiting = built.filter((p) => p.status === 'sent' || p.status === 'viewed').length + uploaded.filter((p) => p.status !== 'signed').length;
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' };
  const pill = (bg: string, color: string): React.CSSProperties => ({ fontFamily: F, fontSize: 11, fontWeight: 700, background: bg, color, padding: '3px 10px', borderRadius: 999, display: 'inline-block', marginTop: 4 });
  const button = (primary: boolean): React.CSSProperties => ({
    fontFamily: F, fontSize: 13, fontWeight: 700, color: primary ? '#fff' : '#0a0a0a', background: primary ? '#e50586' : '#fff',
    border: primary ? 'none' : '1.5px solid #e5e5e5', borderRadius: 10, padding: '10px 18px', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap', cursor: 'pointer',
  });

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#ffffff', minHeight: '100%' }}>
      {!loading && waiting > 0 && (
        <div style={{ background: '#0a0a0a', color: '#fff', borderRadius: 16, padding: '16px 20px', fontFamily: F, fontSize: 14, fontWeight: 600 }}>
          {waiting === 1 ? 'One proposal is waiting for your signature.' : `${waiting} proposals are waiting for your signature.`}
        </div>
      )}

      {loading && <div style={{ ...card, height: 72 }} />}
      {!loading && built.length === 0 && uploaded.length === 0 && (
        <div style={{ ...card, justifyContent: 'center', color: '#808080', fontFamily: F, fontSize: 14 }}>No proposals yet. When Thrive sends you one, it shows up here.</div>
      )}

      {built.map((p) => {
        const st = statusOf(p);
        const open = p.status === 'sent' || p.status === 'viewed';
        return (
          <div key={p.id} style={{ ...card, border: open ? '1.5px solid #fd6100' : card.border }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{p.title}</div>
              <span style={pill(st.bg, st.color)}>{st.label}</span>
              <div style={{ fontFamily: F, fontSize: 12, color: '#808080', marginTop: 6 }}>
                {money(p.total_cents, p.currency)}
                {p.deposit_percent > 0 && p.deposit_percent < 100 ? ` · ${p.deposit_percent}% deposit at signing` : ''}
                {p.sent_at ? ` · sent ${day(p.sent_at)}` : ''}
              </div>
            </div>
            <a href={p.href} style={button(open)}>{open ? 'Review & sign' : 'View proposal'}</a>
          </div>
        );
      })}

      {uploadError && (
        <div style={{ background: '#fff', border: '1.5px solid #e50586', borderRadius: 12, padding: '10px 16px', fontFamily: F, fontSize: 13, color: '#e50586' }}>{uploadError}</div>
      )}
      {uploaded.map((p) => {
        const signed = p.status === 'signed';
        const isUploading = uploadingId === p.id;
        return (
          <div key={p.id} style={{ ...card, border: signed ? card.border : '1.5px solid #fd6100' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{p.name}</div>
              <span style={pill(signed ? '#0cf574' : '#fd6100', signed ? '#0a0a0a' : '#fff')}>{signed ? 'Signed' : 'Awaiting your signature'}</span>
              {!signed && <div style={{ fontFamily: F, fontSize: 12, color: '#808080', marginTop: 6 }}>Download it, sign it, then upload the signed copy.</div>}
              {justSigned === p.id && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: '#0a0a0a', marginTop: 6 }}>Signed copy received — Thrive has been notified.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={button(false)}>{signed ? 'Original' : 'Download'}</a>
              {signed && p.signed_file_url && <a href={p.signed_file_url} target="_blank" rel="noopener noreferrer" style={button(false)}>Signed copy</a>}
              {!signed && (
                <label style={{ ...button(true), opacity: isUploading ? 0.6 : 1 }}>
                  <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} disabled={isUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleSignedUpload(p.id, f); }} />
                  {isUploading ? 'Uploading…' : 'Upload signed copy'}
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
