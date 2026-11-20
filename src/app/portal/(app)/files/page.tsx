'use client';

import { useEffect, useState } from 'react';
import { supabasePortal } from '@/lib/supabasePortal';
import { loadMyDocuments } from '@/lib/portalDocuments';
import Link from 'next/link';
import ProtectedPreview, { DraftReactions, FileViewer, downloadUrl, type ViewFile } from '../../ProtectedPreview';

interface DbFile {
  id: string;
  name: string;
  project_name: string;
  /** Null while it's a draft or locked until an invoice is paid (073). */
  file_url: string | null;
  created_at: string;
  stage?: 'draft' | 'final';
  locked?: 'draft' | 'unpaid' | null;
  has_preview?: boolean;
  unlock_invoice?: { id: string; invoice_number: string } | null;
  reaction?: ViewFile['reaction'];
  comments?: ViewFile['comments'];
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
  const [viewing, setViewing] = useState<DbFile | null>(null);
  // A like, dislike or comment on a draft (074), kept in the list and the open viewer.
  const updateFile = (changed: ViewFile) => {
    const f = changed as DbFile; // always one of these, with its fields spread back in
    setFiles((list) => list.map((x) => (x.id === f.id ? f : x)));
    setViewing((v) => (v && v.id === f.id ? f : v));
  };
  const drafts = files.filter((f) => f.locked === 'draft');
  const lockedFinals = files.filter((f) => f.locked === 'unpaid');
  const ready = files.filter((f) => !f.locked && f.file_url);

  async function refreshProposals() {
    const docs = await loadMyDocuments<DbFile, DbProposal>();
    if (docs) setProposals(docs.proposals);
  }

  useEffect(() => {
    async function load() {
      // From the server, so links to private documents come back signed.
      const docs = await loadMyDocuments<DbFile, DbProposal>();
      setFiles(docs?.files ?? []);
      setProposals(docs?.proposals ?? []);
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
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, background: '#ffffff', minHeight: '100%' }}>

      {/* Proposals section */}
      {(loading || proposals.length > 0) && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-bungee), sans-serif', fontSize: 18, color: '#0a0a0a', margin: '0 0 12px', letterSpacing: '0em' }}>Proposals</h2>
          {loading ? (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f2f2', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, borderRadius: 4, background: '#f2f2f2', width: '45%', marginBottom: 8 }} />
                <div style={{ height: 10, borderRadius: 4, background: '#f2f2f2', width: '20%' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {uploadError && (
                <div style={{ background: '#f5f5f5', border: '1px solid #e50586', borderRadius: 10, padding: '10px 16px', fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, color: '#e50586' }}>
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
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: signed ? '#f5f5f5' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={signed ? '#08b957' : '#e50586'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 11, fontWeight: 700, background: signed ? '#f5f5f5' : '#f5f5f5', color: signed ? '#08b957' : '#fd6100', padding: '2px 8px', borderRadius: 999, display: 'inline-block', marginTop: 4 }}>
                          {signed ? '✓ Signed' : 'Awaiting your signature'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <a href={p.file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, color: '#0a0a0a', border: '1.5px solid #e5e5e5', borderRadius: 8, padding: '7px 14px', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                          {signed ? 'View Original' : 'Download & Sign'}
                        </a>
                        {signed && p.signed_file_url && (
                          <a href={p.signed_file_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, color: '#08b957', border: '1.5px solid #08b957', borderRadius: 8, padding: '7px 14px', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                            View Signed ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Upload signed copy — only shown when pending */}
                    {!signed && (
                      <div style={{ borderTop: '1px solid #f2f2f2', padding: '14px 20px', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
                      <div style={{ borderTop: '1px solid #0cf574', padding: '12px 20px', background: '#f5f5f5', fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#08b957' }}>
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

      {/* Drafts to review and final files locked until paid (073): watermarked previews only. */}
      {!loading && (drafts.length > 0 || lockedFinals.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-bungee), sans-serif', fontSize: 18, color: '#0a0a0a', margin: 0 }}>Drafts For Your Review</h2>
            <p style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, color: '#808080', margin: '4px 0 0', lineHeight: 1.5 }}>
              Like or dislike each one and leave comments so I know what to keep. Previews are watermarked and can&apos;t be downloaded; final files unlock once they&apos;re paid for.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {[...drafts, ...lockedFinals].map((f) => {
              const draft = f.locked === 'draft';
              return (
                <div key={f.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button type="button" onClick={() => f.has_preview && setViewing(f)} disabled={!f.has_preview}
                    style={{ all: 'unset', cursor: f.has_preview ? 'zoom-in' : 'default', display: 'block', borderRadius: 12 }} aria-label={`Open ${f.name}`}>
                    {f.has_preview
                      ? <ProtectedPreview fileId={f.id} label={f.name} maxHeight={260} />
                      : <div style={{ background: '#f2f2f2', borderRadius: 12, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, color: '#808080' }}>No preview for this file type</div>}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, color: '#808080', marginTop: 2 }}>{f.project_name}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: draft ? '#fd6100' : '#e50586', color: '#fff', whiteSpace: 'nowrap' }}>
                      {draft ? 'Draft' : 'Final · Locked'}
                    </span>
                  </div>
                  {draft && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #f2f2f2', paddingTop: 10 }}>
                      <DraftReactions file={f} onChange={updateFile} />
                      <button type="button" onClick={() => setViewing(f)} style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 13, fontWeight: 700, borderRadius: 999, padding: '8px 14px', border: '1.5px solid #e5e5e5', background: 'transparent', color: '#0a0a0a', cursor: 'pointer' }}>
                        {f.comments?.length ? `Comments (${f.comments.length})` : 'Comment'}
                      </button>
                    </div>
                  )}
                  {!draft && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #f2f2f2', paddingTop: 10 }}>
                      <span style={{ flex: 1, minWidth: 160, fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, color: '#0a0a0a' }}>
                        Unlocks when {f.unlock_invoice?.invoice_number ?? 'your invoice'} is paid in full.
                      </span>
                      <Link href="/portal/invoices" style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 12, fontWeight: 700, background: '#0a0a0a', color: '#fff', borderRadius: 999, padding: '7px 16px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Pay Invoice
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Opens any file: drafts / locked finals as the protected preview, finals with Download. */}
      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} onChange={updateFile} />}

      {/* Files section heading */}
      {!loading && ready.length > 0 && (
        <h2 style={{ fontFamily: 'var(--font-bungee), sans-serif', fontSize: 18, color: '#0a0a0a', margin: 0, letterSpacing: '0em' }}>Files & Assets</h2>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 24px',
              borderBottom: i < 3 ? '1px solid #f2f2f2' : 'none',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f2f2f2', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, borderRadius: 4, background: '#f2f2f2', width: '45%', marginBottom: 8 }} />
                <div style={{ height: 10, borderRadius: 4, background: '#f2f2f2', width: '30%' }} />
              </div>
              <div style={{ width: 80, height: 32, borderRadius: 8, background: '#f2f2f2', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — only shown when not loading and no files and no proposals */}
      {!loading && files.length === 0 && proposals.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', padding: '64px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: '#f2f2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bfbfbf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-bungee), sans-serif', fontSize: 24, color: '#0a0a0a', margin: '0 0 8px', letterSpacing: '0em' }}>
              NO FILES YET
            </h2>
            <p style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontSize: 14, color: '#808080', margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
              Your delivered files and brand assets will appear here once your Thrive team uploads them.
            </p>
          </div>
        </div>
      )}

      {/* File list — only shown when not loading and files exist */}
      {!loading && ready.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 24px',
            background: '#fafafa',
            borderBottom: '1px solid #f2f2f2',
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
          {ready.map((file, i) => (
            <div
              key={file.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 24px',
                borderBottom: i < ready.length - 1 ? '1px solid #f2f2f2' : 'none',
                justifyContent: 'space-between',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <FileIcon />
              </div>

              {/* Name + project */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <button type="button" onClick={() => setViewing(file)} style={{
                  all: 'unset', cursor: 'pointer', display: 'block', maxWidth: '100%',
                  fontFamily: 'var(--font-inter), Inter, sans-serif',
                  fontSize: 14, fontWeight: 700, color: '#0a0a0a',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {file.name}
                </button>
                <div style={{
                  fontFamily: 'var(--font-inter), Inter, sans-serif',
                  fontSize: 12, color: '#808080', marginTop: 2,
                }}>
                  {file.project_name}
                </div>
              </div>

              {/* Download */}
              <a
                href={downloadUrl(file) ?? '#'}
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
