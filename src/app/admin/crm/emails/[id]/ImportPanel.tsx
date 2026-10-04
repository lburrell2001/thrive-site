'use client';

// Import a design from Canva Email: how to export it, the upload, and what
// the importer noticed.

import { useState } from 'react';
import p from '../../../proposals/proposals.module.css';
import { apiSend, apiUpload, formatDate } from '../../../proposals/adminApi';
import type { Newsletter } from '@/lib/newsletter';

export function ImportPanel({ newsletter, onChange, notify, locked }: {
  newsletter: Newsletter;
  onChange: (n: Newsletter) => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
  locked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const meta = newsletter.html_meta;

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await apiUpload<Newsletter>(`/api/newsletters/${newsletter.id}/import`, form);
      onChange(updated);
      notify(updated.html_meta?.warnings.length ? 'Imported — check the notes below.' : 'Design imported.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Import failed', 'error');
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm('Remove the imported design? You can import it again, or build one here instead.')) return;
    try {
      onChange(await apiSend<Newsletter>(`/api/newsletters/${newsletter.id}/import`, 'DELETE'));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not remove', 'error');
    }
  }

  const picker = (label: string) => (
    <label className={`${p.btn} ${newsletter.html ? '' : p.btnPrimary}`} style={{ cursor: locked || busy ? 'default' : 'pointer' }}>
      {busy ? 'Importing…' : label}
      <input type="file" accept=".zip,.html,.htm,application/zip,text/html" hidden disabled={locked || busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
    </label>
  );

  if (!newsletter.html) {
    return (
      <div className={p.card} style={{ marginBottom: 14 }}>
        <h2 className={p.cardTitle}>Import a design from Canva</h2>
        <ol style={{ margin: '10px 0 14px', paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
          <li>In Canva, choose <strong>Create a design → Email</strong> and design it however you like — text, images, buttons, colors, fonts.</li>
          <li>Link each button and any clickable text or image: select it, then <strong>Link</strong>. Type <code>{'{{first_name}}'}</code> anywhere you want the person’s first name.</li>
          <li><strong>Share → Download</strong>, set File type to <strong>HTML and images</strong>, and download the .zip.</li>
          <li>Upload that .zip here. Images are moved to your own storage and your unsubscribe footer is added automatically.</li>
        </ol>
        {picker('Upload Canva .zip')}
        <p className={p.rowMeta} style={{ marginTop: 10 }}>Prefer to build it here instead? Use the builder below — you can import a design over it at any time.</p>
      </div>
    );
  }

  return (
    <div className={p.card} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 className={p.cardTitle}>Designed in Canva</h2>
          {meta && (
            <p className={p.rowMeta} style={{ margin: '2px 0 0' }}>
              {meta.file} · {meta.images} image{meta.images === 1 ? '' : 's'} · {Math.round(meta.bytes / 1024)} KB · imported {formatDate(meta.imported_at)}
            </p>
          )}
        </div>
        {!locked && picker('Replace design')}
        {!locked && <button type="button" className={`${p.btn} ${p.btnDanger}`} onClick={remove}>Remove design</button>}
      </div>
      {meta?.warnings.map((w) => (
        <p key={w} style={{ margin: '10px 0 0', fontSize: 13, color: '#92400e', background: '#fffbeb', borderRadius: 8, padding: '8px 10px' }}>{w}</p>
      ))}
      <p className={p.rowMeta} style={{ marginTop: 10 }}>
        To change the design, edit it in Canva, download again, and click Replace design. Subject, preview text and audience are set above.
      </p>
    </div>
  );
}
