'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';

interface DbFile {
  id: string;
  name: string;
  project_name: string;
  file_url: string;
  created_at: string;
}

interface DbProposal {
  id: string;
  name: string;
  file_url: string;
  signed_file_url: string | null;
  status: string;
  created_at: string;
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export default function FilesPage() {
  const [files, setFiles]           = useState<DbFile[]>([]);
  const [proposals, setProposals]   = useState<DbProposal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [justSigned, setJustSigned] = useState<string | null>(null);

  async function refreshProposals() {
    const { data: { user } } = await supabasePortal.auth.getUser();
    if (!user) return;
    const { data } = await supabasePortal.from('portal_proposals').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
    setProposals(data ?? []);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;

      const [filesRes, proposalsRes] = await Promise.all([
        supabasePortal.from('portal_files').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
        supabasePortal.from('portal_proposals').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
      ]);

      setFiles(filesRes.data ?? []);
      setProposals(proposalsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignedUpload(proposalId: string, file: File) {
    if (file.size > 20 * 1024 * 1024) { setUploadError('File must be under 20 MB'); return; }
    setUploadingId(proposalId); setUploadError(''); setJustSigned(null);

    const { data: { session } } = await supabasePortal.auth.getSession();
    if (!session?.access_token) {
      setUploadError('Session expired — please refresh the page.');
      setUploadingId(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch('/api/portal/submit-proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ proposalId, fileName: file.name, fileData: base64, mimeType: file.type }),
        });
        const json = await res.json() as { ok?: boolean; error?: string };
        if (json.error) { setUploadError(json.error); }
        else { setJustSigned(proposalId); await refreshProposals(); }
      } catch {
        setUploadError('Upload failed — please try again.');
      }
      setUploadingId(null);
    };
    reader.onerror = () => { setUploadError('Could not read file.'); setUploadingId(null); };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, background: '#f6f5f4', minHeight: '100%' }}>

      {/* Proposals section */}
      {(loading || proposals.length > 0) && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-bungee), Bungee, sans-serif', fontSize: 14, color: '#0a0a0a', margin: '0 0 12px', letterSpacing: '-0.01em' }}>PROPOSALS</h2>
          {loading ? (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f0ef', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, borderRadius: 4, background: '#f1f0ef', width: '45%', marginBottom: 8 }} />
                <div style={{ height: 10, borderRadius: 4, background: '#f1f0ef', width: '20%' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {uploadError && (
                <div style={{ background: '#fff0f8', border: '1px solid #fbc8e8', borderRadius: 10, padding: '10px 16px', fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, color: '#e40586' }}>
                  {uploadError}
                </div>
              )}
              {proposals.map((p) => {
                const signed = p.status === 'signed';
                const isUploading = uploadingId === p.id;
                const showSuccess = justSigned === p.id;
                return (
                  <div key={p.id} style={{ background: '#fff', borderRadius: 16, border: signed ? '1.5px solid #0cf574' : '1px solid #e5e5e5', overflow: 'hidden' }}>
                    {/* Main row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', flexWrap: 'wrap' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: signed ? '#edfff6' : '#fff0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={signed ? '#1a8a4a' : '#e40586'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 11, fontWeight: 700, background: signed ? '#edfff6' : '#fff4ec', color: signed ? '#1a8a4a' : '#fd6100', padding: '2px 8px', borderRadius: 999, display: 'inline-block', marginTop: 4 }}>
                          {signed ? '✓ Signed' : 'Awaiting your signature'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, color: '#0a0a0a', border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '7px 14px', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                          {signed ? 'View Original' : 'Download & Sign'}
                        </a>
                        {signed && p.signed_file_url && (
                          <a href={p.signed_file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, color: '#1a8a4a', border: '1.5px solid #1a8a4a', borderRadius: 8, padding: '7px 14px', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                            View Signed ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Upload signed copy — only shown when pending */}
                    {!signed && (
                      <div style={{ borderTop: '1px solid #f1f0ef', padding: '14px 20px', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, color: '#0a0a0a' }}>Return signed copy</div>
                          <div style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, color: '#808080', marginTop: 2 }}>Download the proposal, fill it out, then upload the completed file below.</div>
                        </div>
                        <label style={{ cursor: isUploading ? 'default' : 'pointer', flexShrink: 0 }}>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            style={{ display: 'none' }}
                            disabled={isUploading}
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleSignedUpload(p.id, f); }}
                          />
                          <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, background: isUploading ? '#e5e5e5' : '#0a0a0a', color: isUploading ? '#808080' : '#fff', borderRadius: 8, padding: '8px 16px', display: 'inline-block', whiteSpace: 'nowrap' }}>
                            {isUploading ? 'Uploading…' : '↑ Upload Signed Copy'}
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Success confirmation */}
                    {showSuccess && (
                      <div style={{ borderTop: '1px solid #0cf574', padding: '12px 20px', background: '#edfff6', fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#1a8a4a' }}>
                        ✓ Signed proposal received — your Thrive team has been notified.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Files section heading */}
      {!loading && files.length > 0 && (
        <h2 style={{ fontFamily: 'var(--font-bungee), Bungee, sans-serif', fontSize: 14, color: '#0a0a0a', margin: 0, letterSpacing: '-0.01em' }}>FILES & ASSETS</h2>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 24px',
              borderBottom: i < 3 ? '1px solid #f1f0ef' : 'none',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f0ef', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, borderRadius: 4, background: '#f1f0ef', width: '45%', marginBottom: 8 }} />
                <div style={{ height: 10, borderRadius: 4, background: '#f1f0ef', width: '30%' }} />
              </div>
              <div style={{ width: 80, height: 32, borderRadius: 8, background: '#f1f0ef', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — only shown when not loading and no files and no proposals */}
      {!loading && files.length === 0 && proposals.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '64px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: '#f1f0ef',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bfbfbf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-bungee), Bungee, sans-serif', fontSize: 24, color: '#0a0a0a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              NO FILES YET
            </h2>
            <p style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 14, color: '#808080', margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
              Your delivered files and brand assets will appear here once your Thrive team uploads them.
            </p>
          </div>
        </div>
      )}

      {/* File list — only shown when not loading and files exist */}
      {!loading && files.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 24px',
            background: '#fafafa',
            borderBottom: '1px solid #f1f0ef',
          }}>
            <div style={{ width: 40, flexShrink: 0 }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bfbfbf' }}>
              File Name
            </span>
            <span style={{ width: 80, flexShrink: 0, fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bfbfbf', textAlign: 'right' }}>
              Action
            </span>
          </div>

          {/* File rows */}
          {files.map((file, i) => (
            <div
              key={file.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 24px',
                borderBottom: i < files.length - 1 ? '1px solid #f1f0ef' : 'none',
                justifyContent: 'space-between',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: '#f6f5f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <FileIcon />
              </div>

              {/* Name + project */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-inter), Inter, sans-serif',
                  fontSize: 14, fontWeight: 700, color: '#0a0a0a',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {file.name}
                </div>
                <div style={{
                  fontFamily: 'var(--font-inter), Inter, sans-serif',
                  fontSize: 12, color: '#808080', marginTop: 2,
                }}>
                  {file.project_name}
                </div>
              </div>

              {/* Download */}
              <a
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flexShrink: 0,
                  fontFamily: 'var(--font-inter), Inter, sans-serif',
                  fontSize: 12, fontWeight: 700,
                  color: '#0a0a0a',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: 8,
                  padding: '7px 16px',
                  textDecoration: 'none',
                  transition: 'background .15s, color .15s',
                  display: 'inline-block',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#0a0a0a'; (e.currentTarget as HTMLAnchorElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#0a0a0a'; }}
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
