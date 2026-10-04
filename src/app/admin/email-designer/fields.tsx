'use client';

// Small controls the email designer's panels are built from.

import { useState } from 'react';
import p from '../proposals/proposals.module.css';
import d from './designer.module.css';
import { apiUpload } from '../proposals/adminApi';
import { SWATCHES } from '@/lib/newsletterBlocks';
import { SERVICE_SEO } from '@/lib/serviceSeo';

export type Notify = (message: string, tone?: 'ok' | 'error') => void;

const PAGES = [
  ...Object.values(SERVICE_SEO).map((svc) => ({ label: svc.name, path: svc.path })),
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Journal', path: '/journal' },
  { label: 'Book a call', path: '/book' },
  { label: 'Contact', path: '/contact' },
];

export async function uploadEmailImage(file: File): Promise<{ url: string; bytes: number; alt: string }> {
  const form = new FormData();
  form.append('file', file);
  const r = await apiUpload<{ url: string; bytes: number }>('/api/newsletters/images', form);
  return { ...r, alt: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() };
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className={d.field}>
      <span className={d.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={d.hint}>{hint}</span>}
    </label>
  );
}

export function TextInput({ label, value, onChange, placeholder, multiline, rows = 3, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; rows?: number; hint?: React.ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea className={p.textarea} rows={rows} style={{ minHeight: 0 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={p.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </Field>
  );
}

/** A link: type a URL, or pick one of the site's pages. */
export function LinkInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <span style={{ display: 'flex', gap: 6 }}>
        <input className={p.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /portfolio" />
        <select className={p.select} style={{ width: 40, padding: 4, flex: 'none' }} value="" aria-label={`${label}: pick a page`} onChange={(e) => e.target.value && onChange(e.target.value)}>
          <option value="">↓</option>
          {PAGES.map((pg) => <option key={pg.path} value={pg.path}>{pg.label}</option>)}
        </select>
      </span>
    </Field>
  );
}

/** Two to four mutually exclusive options as a pill row. */
export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T | undefined; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className={d.field}>
      <span className={d.fieldLabel}>{label}</span>
      <div className={d.segmented} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title}
            className={o.value === value ? d.segOn : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={d.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Brand swatches, plus any colour. `allowNone` adds "the email's own" as ''. */
export function ColorField({ label, value, onChange, allowNone }: {
  label: string; value: string; onChange: (v: string) => void; allowNone?: boolean;
}) {
  return (
    <div className={d.field}>
      <span className={d.fieldLabel}>{label}</span>
      <div className={d.swatches}>
        {allowNone && (
          <button type="button" className={`${d.swatch} ${d.swatchNone} ${value === '' ? d.swatchOn : ''}`} onClick={() => onChange('')} title="Same as the email" aria-label="Same as the email" />
        )}
        {SWATCHES.map((s) => (
          <button key={s.hex} type="button" className={`${d.swatch} ${value.toLowerCase() === s.hex ? d.swatchOn : ''}`} style={{ background: s.hex }}
            onClick={() => onChange(s.hex)} title={s.label} aria-label={s.label} />
        ))}
        <span className={d.swatchCustom} title="Any colour">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: any colour`} />
        </span>
      </div>
    </div>
  );
}

/** Upload (or drop) an image, with its description and optional link. */
export function ImageInput({ src, alt, href, onChange, notify, hideLink, label = 'Image' }: {
  src: string; alt: string; href?: string;
  onChange: (patch: { src?: string; alt?: string; href?: string }) => void;
  notify: Notify; hideLink?: boolean; label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [big, setBig] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const r = await uploadEmailImage(file);
      setBig(r.bytes > 1024 * 1024 ? r.bytes : null);
      onChange({ src: r.url, alt: alt || r.alt });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
    setUploading(false);
  }

  return (
    <div className={d.field}>
      <span className={d.fieldLabel}>{label}</span>
      <label
        className={`${d.drop} ${over ? d.dropOver : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
      >
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" className={d.dropImg} />
          : <span className={d.dropEmpty}>Drop an image or click</span>}
        <span className={d.dropAction}>{uploading ? 'Uploading…' : src ? 'Replace' : 'Upload'}</span>
        <input type="file" accept="image/jpeg,image/png,image/gif" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
      </label>
      {big !== null && (
        <span className={d.hint} style={{ color: '#b45309' }}>
          {(big / 1024 / 1024).toFixed(1)} MB is heavy for email. Export as JPG around 1200px wide.
        </span>
      )}
      <input className={p.input} style={{ marginTop: 6 }} value={alt} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Describe it (shown when images are off)" aria-label={`${label} description`} />
      {!hideLink && (
        <div style={{ marginTop: 6 }}><LinkInput label="Opens (optional)" value={href ?? ''} onChange={(v) => onChange({ href: v })} /></div>
      )}
    </div>
  );
}
