'use client';

// The designed-newsletter builder: a stack of blocks, each edited in its
// own card, plus the colors, fonts, logo and social links.

import { useState } from 'react';
import p from '../../../proposals/proposals.module.css';
import { apiUpload } from '../../../proposals/adminApi';
import {
  BLOCK_LABEL,
  EMAIL_FONTS,
  newBlock,
  type BlockType,
  type EmailFont,
  type NewsletterBlock,
  type NewsletterDesign,
} from '@/lib/newsletterBlocks';
import { SERVICE_SEO } from '@/lib/serviceSeo';

const PAGES = [
  ...Object.values(SERVICE_SEO).map((svc) => ({ label: svc.name, path: svc.path })),
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Journal', path: '/journal' },
  { label: 'Book a call', path: '/book' },
  { label: 'Contact', path: '/contact' },
];

const card: React.CSSProperties = { border: '1px solid #e4e1de', borderRadius: 10, background: '#fff', padding: 12, marginBottom: 10 };
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 };
const small: React.CSSProperties = { fontSize: 12, color: '#6b6b6b', margin: '4px 0 0' };

type Notify = (message: string, tone?: 'ok' | 'error') => void;

/** A link field: type a URL, or pick one of the site's pages. */
function LinkField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label>
      <span className={p.label}>{label}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        <input className={p.input} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /portfolio" disabled={disabled} />
        <select className={p.select} style={{ width: 44, padding: 4 }} value="" aria-label={`${label}: pick a page`} onChange={(e) => e.target.value && onChange(e.target.value)} disabled={disabled}>
          <option value="">↓</option>
          {PAGES.map((pg) => <option key={pg.path} value={pg.path}>{pg.label}</option>)}
        </select>
      </span>
    </label>
  );
}

/** Upload (or paste a link to) an image, with its description and link. */
function ImageField({ src, alt, href, onChange, notify, disabled, hideLink }: {
  src: string; alt: string; href?: string;
  onChange: (patch: { src?: string; alt?: string; href?: string }) => void;
  notify: Notify; disabled?: boolean; hideLink?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await apiUpload<{ url: string; bytes: number }>('/api/newsletters/images', form);
      setBytes(r.bytes);
      onChange({ src: r.url, alt: alt || file.name.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ') });
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Upload failed', 'error');
    }
    setUploading(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
        ) : (
          <span style={{ width: 96, height: 60, borderRadius: 6, border: '1px dashed #ccc', display: 'grid', placeItems: 'center', fontSize: 11, color: '#999' }}>No image</span>
        )}
        <label className={`${p.btn} ${p.btnSmall}`} style={{ cursor: disabled ? 'default' : 'pointer' }}>
          {uploading ? 'Uploading…' : src ? 'Replace' : 'Upload image'}
          <input type="file" accept="image/jpeg,image/png,image/gif" hidden disabled={disabled || uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        </label>
      </div>
      {bytes !== null && bytes > 1024 * 1024 && (
        <p style={{ ...small, color: '#b45309' }}>
          This image is {(bytes / 1024 / 1024).toFixed(1)} MB — large for email and slow on phones. Export from Canva as a JPG at around 1200px wide.
        </p>
      )}
      <div style={row}>
        <label>
          <span className={p.label}>Describe the image</span>
          <input className={p.input} value={alt} onChange={(e) => onChange({ alt: e.target.value })} placeholder="What it shows or says" disabled={disabled} />
        </label>
        {!hideLink && <LinkField label="Link (optional)" value={href ?? ''} onChange={(v) => onChange({ href: v })} disabled={disabled} />}
      </div>
      <p style={small}>The description is what people see when their email hides images, and what screen readers read. If the image has words on it, type them here.</p>
    </div>
  );
}

function BlockFields({ block, update, notify, disabled }: {
  block: NewsletterBlock;
  update: (patch: Partial<NewsletterBlock>) => void;
  notify: Notify;
  disabled?: boolean;
}) {
  const alignSelect = (value: 'left' | 'center') => (
    <label>
      <span className={p.label}>Align</span>
      <select className={p.select} value={value} onChange={(e) => update({ align: e.target.value as 'left' | 'center' } as Partial<NewsletterBlock>)} disabled={disabled}>
        <option value="left">Left</option>
        <option value="center">Center</option>
      </select>
    </label>
  );

  switch (block.type) {
    case 'image':
      return (
        <>
          <ImageField src={block.src} alt={block.alt} href={block.href} onChange={(patch) => update(patch)} notify={notify} disabled={disabled} />
          <div style={row}>
            <label>
              <span className={p.label}>Width</span>
              <select className={p.select} value={block.width} onChange={(e) => update({ width: e.target.value as 'full' | 'padded' })} disabled={disabled}>
                <option value="full">Edge to edge (banners)</option>
                <option value="padded">Inside the margins</option>
              </select>
            </label>
          </div>
        </>
      );
    case 'heading':
      return (
        <div style={row}>
          <label style={{ gridColumn: '1 / -1' }}>
            <span className={p.label}>Heading</span>
            <input className={p.input} value={block.text} onChange={(e) => update({ text: e.target.value })} disabled={disabled} />
          </label>
          <label>
            <span className={p.label}>Size</span>
            <select className={p.select} value={block.size} onChange={(e) => update({ size: e.target.value as 'large' | 'medium' })} disabled={disabled}>
              <option value="large">Large</option>
              <option value="medium">Medium</option>
            </select>
          </label>
          {alignSelect(block.align)}
        </div>
      );
    case 'text':
      return (
        <>
          <textarea className={p.textarea} style={{ marginTop: 8, minHeight: 100 }} value={block.text} onChange={(e) => update({ text: e.target.value })} disabled={disabled} aria-label="Text" />
          <p style={small}>**bold**, *italic*, [link text](/portfolio), and lines starting with “- ” for a list.</p>
          <div style={row}>{alignSelect(block.align)}</div>
        </>
      );
    case 'button':
      return (
        <div style={row}>
          <label>
            <span className={p.label}>Button text</span>
            <input className={p.input} value={block.label} onChange={(e) => update({ label: e.target.value })} disabled={disabled} />
          </label>
          <LinkField label="Goes to" value={block.href} onChange={(v) => update({ href: v })} disabled={disabled} />
          {alignSelect(block.align)}
        </div>
      );
    case 'columns':
      return (
        <>
          <ImageField src={block.image.src} alt={block.image.alt} href={block.image.href} onChange={(patch) => update({ image: { ...block.image, ...patch } })} notify={notify} disabled={disabled} />
          <div style={row}>
            <label>
              <span className={p.label}>Image on the</span>
              <select className={p.select} value={block.imageSide} onChange={(e) => update({ imageSide: e.target.value as 'left' | 'right' })} disabled={disabled}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              <span className={p.label}>Heading</span>
              <input className={p.input} value={block.heading} onChange={(e) => update({ heading: e.target.value })} disabled={disabled} />
            </label>
          </div>
          <textarea className={p.textarea} style={{ marginTop: 8, minHeight: 80 }} value={block.text} onChange={(e) => update({ text: e.target.value })} disabled={disabled} aria-label="Text" />
          <div style={row}>
            <label>
              <span className={p.label}>Button text (optional)</span>
              <input className={p.input} value={block.buttonLabel} onChange={(e) => update({ buttonLabel: e.target.value })} disabled={disabled} />
            </label>
            <LinkField label="Button goes to" value={block.buttonHref} onChange={(v) => update({ buttonHref: v })} disabled={disabled} />
          </div>
          <p style={small}>Side by side on computers; the image stacks above the text on phones.</p>
        </>
      );
    case 'spacer':
      return (
        <div style={row}>
          <label>
            <span className={p.label}>Height</span>
            <select className={p.select} value={block.size} onChange={(e) => update({ size: e.target.value as 'small' | 'medium' | 'large' })} disabled={disabled}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
      );
    case 'social':
      return <p style={small}>Shows your Instagram, LinkedIn and website links from Colors &amp; fonts below.</p>;
    case 'divider':
      return null;
  }
}

export function BlockEditor({ blocks, design, onBlocks, onDesign, notify, disabled }: {
  blocks: NewsletterBlock[];
  design: NewsletterDesign;
  onBlocks: (blocks: NewsletterBlock[]) => void;
  onDesign: (design: NewsletterDesign) => void;
  notify: Notify;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState<BlockType | ''>('');
  const [showDesign, setShowDesign] = useState(false);

  const update = (i: number, patch: Partial<NewsletterBlock>) =>
    onBlocks(blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as NewsletterBlock) : b)));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onBlocks(next);
  };
  const duplicate = (i: number) => {
    const copy = { ...structuredClone(blocks[i]), id: newBlock(blocks[i].type).id };
    onBlocks([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
  };
  const remove = (i: number) => onBlocks(blocks.filter((_, j) => j !== i));
  const setD = <K extends keyof NewsletterDesign>(key: K, value: NewsletterDesign[K]) => onDesign({ ...design, [key]: value });

  const colors: { key: keyof NewsletterDesign; label: string }[] = [
    { key: 'accent', label: 'Buttons & links' },
    { key: 'buttonText', label: 'Button text' },
    { key: 'headingColor', label: 'Headings' },
    { key: 'textColor', label: 'Text' },
    { key: 'contentBg', label: 'Email background' },
    { key: 'pageBg', label: 'Page around it' },
  ];

  return (
    <div>
      <div style={card}>
        <button type="button" onClick={() => setShowDesign((v) => !v)} aria-expanded={showDesign} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>Colors &amp; fonts</span><span aria-hidden="true">{showDesign ? '−' : '+'}</span>
        </button>
        {showDesign && (
          <div>
            <div style={row}>
              {colors.map((c) => (
                <label key={c.key}>
                  <span className={p.label}>{c.label}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="color" value={design[c.key] as string} onChange={(e) => setD(c.key, e.target.value as never)} disabled={disabled} style={{ width: 36, height: 32, padding: 0, border: 'none', background: 'none' }} aria-label={`${c.label} color`} />
                    <input className={p.input} value={design[c.key] as string} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setD(c.key, e.target.value as never)} disabled={disabled} style={{ fontFamily: 'monospace' }} aria-label={`${c.label} hex`} />
                  </span>
                </label>
              ))}
            </div>
            <div style={row}>
              {(['headingFont', 'bodyFont'] as const).map((key) => (
                <label key={key}>
                  <span className={p.label}>{key === 'headingFont' ? 'Heading font' : 'Text font'}</span>
                  <select className={p.select} value={design[key]} onChange={(e) => setD(key, e.target.value as EmailFont)} disabled={disabled}>
                    {(Object.keys(EMAIL_FONTS) as EmailFont[]).map((f) => <option key={f} value={f}>{EMAIL_FONTS[f].label}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p style={small}>Custom fonts show in Apple Mail and on iPhones. Gmail and Outlook use a similar standard font instead — design with that in mind, or put special lettering in a Canva image.</p>
            <p className={p.label} style={{ marginTop: 12 }}>Logo at the top (optional)</p>
            <ImageField src={design.logoUrl} alt="Thrive Creative Studios" onChange={(patch) => patch.src !== undefined && setD('logoUrl', patch.src)} notify={notify} disabled={disabled} hideLink />
            {design.logoUrl && <button type="button" className={`${p.btn} ${p.btnSmall}`} style={{ marginTop: 6 }} onClick={() => setD('logoUrl', '')} disabled={disabled}>Remove logo</button>}
            <div style={row}>
              {(['instagram', 'linkedin', 'website'] as const).map((key) => (
                <label key={key}>
                  <span className={p.label}>{key === 'instagram' ? 'Instagram' : key === 'linkedin' ? 'LinkedIn' : 'Website'}</span>
                  <input className={p.input} value={design[key]} onChange={(e) => setD(key, e.target.value)} placeholder="https://…" disabled={disabled} />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {blocks.map((b, i) => (
        <div key={b.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ flex: 1, fontSize: 13 }}>{BLOCK_LABEL[b.type]}</strong>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label="Move up">↑</button>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => move(i, 1)} disabled={disabled || i === blocks.length - 1} aria-label="Move down">↓</button>
            <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => duplicate(i)} disabled={disabled} aria-label="Duplicate">⧉</button>
            <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnDanger}`} onClick={() => remove(i)} disabled={disabled} aria-label="Delete block">×</button>
          </div>
          <BlockFields block={b} update={(patch) => update(i, patch)} notify={notify} disabled={disabled} />
        </div>
      ))}

      {!disabled && (
        <div style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', background: '#fafafa' }}>
          <select className={p.select} value={adding} onChange={(e) => setAdding(e.target.value as BlockType | '')} aria-label="Block to add">
            <option value="">Add a block…</option>
            {(Object.keys(BLOCK_LABEL) as BlockType[]).map((t) => <option key={t} value={t}>{BLOCK_LABEL[t]}</option>)}
          </select>
          <button type="button" className={`${p.btn} ${p.btnSmall} ${p.btnPrimary}`} disabled={!adding} onClick={() => { if (adding) { onBlocks([...blocks, newBlock(adding)]); setAdding(''); } }}>Add</button>
        </div>
      )}
    </div>
  );
}
