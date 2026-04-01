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

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export default function FilesPage() {
  const [files, setFiles]   = useState<DbFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabasePortal.auth.getUser();
      if (!user) return;

      const { data } = await supabasePortal
        .from('portal_files')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      setFiles(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 0, background: '#f6f5f4', minHeight: '100%' }}>

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

      {/* Empty state — only shown when not loading and no files */}
      {!loading && files.length === 0 && (
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
