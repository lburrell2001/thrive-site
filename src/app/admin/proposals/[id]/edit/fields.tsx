'use client';

import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react';
import s from '../../proposals.module.css';
import { apiUpload } from '../../adminApi';
import type { AccentName } from '@/types/proposal';

/* ------------------------------------------------------------ context */

interface BuilderCtx {
  proposalId: string;
  /** Storage path -> signed URL, for previewing images already uploaded. */
  imageUrls: Record<string, string>;
  registerImageUrl: (path: string, url: string) => void;
}

const Ctx = createContext<BuilderCtx | null>(null);

export const BuilderProvider = Ctx.Provider;

export function useBuilder(): BuilderCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBuilder used outside the builder');
  return ctx;
}

/* ------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <p className={s.hint}>{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className={s.input}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  hint,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <textarea
          id={id}
          className={s.textarea}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={s.toggleRow}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} style={{ cursor: 'pointer' }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{label}</span>
        {hint && <span className={s.hint}>{hint}</span>}
      </label>
    </div>
  );
}

const ACCENTS: { value: AccentName | ''; label: string }[] = [
  { value: '', label: 'Use the proposal accent' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'magenta', label: 'Magenta' },
  { value: 'purple', label: 'Purple' },
  { value: 'blue', label: 'Blue' },
];

export function AccentSelect({
  value,
  onChange,
}: {
  value: AccentName | undefined;
  onChange: (value: AccentName | undefined) => void;
}) {
  return (
    <Field label="Accent" hint="Colours the second heading line, kickers, and rules.">
      {(id) => (
        <select
          id={id}
          className={s.select}
          value={value ?? ''}
          onChange={(e) => onChange((e.target.value || undefined) as AccentName | undefined)}
        >
          {ACCENTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/* ---------------------------------------------------------- repeater */

export function Repeater<T>({
  label,
  items,
  onChange,
  blank,
  addLabel,
  max,
  render,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  addLabel: string;
  max?: number;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className={s.field}>
      <span className={s.label}>{label}</span>

      {items.map((item, index) => (
        <div key={index} className={s.repeatItem}>
          <div className={s.repeatHead}>
            <span className={s.repeatIndex}>{index + 1}</span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={s.railIcon}
                aria-label={`Move ${label} ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={s.railIcon}
                aria-label={`Move ${label} ${index + 1} down`}
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className={s.railIcon}
                aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </span>
          </div>

          {render(
            item,
            (patch) =>
              onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row))),
            index,
          )}
        </div>
      ))}

      <button
        type="button"
        className={`${s.btn} ${s.btnSmall}`}
        disabled={max !== undefined && items.length >= max}
        onClick={() => onChange([...items, blank()])}
      >
        {addLabel}
      </button>
      {max !== undefined && items.length >= max && (
        <p className={s.hint}>This block holds at most {max}.</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------- image field */

export function ImageField({
  label,
  blockId,
  path,
  onChange,
  alt,
  onAltChange,
  altLabel = 'Alt text',
}: {
  label: string;
  blockId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  alt?: string;
  onAltChange?: (alt: string) => void;
  altLabel?: string;
}) {
  const { proposalId, imageUrls, registerImageUrl } = useBuilder();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const url = path ? imageUrls[path] : undefined;

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('blockId', blockId);
      const result = await apiUpload<{ path: string; url: string | null }>(
        `/api/proposals/${proposalId}/upload`,
        form,
      );
      if (result.url) registerImageUrl(result.path, result.url);
      onChange(result.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
    setUploading(false);
    if (input.current) input.current.value = '';
  }

  return (
    <div className={s.field}>
      <span className={s.label}>{label}</span>

      <div className={s.imageRow}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed preview URL
          <img src={url} alt="" className={s.thumb} />
        ) : (
          <span className={`${s.thumb} ${s.thumbEmpty}`}>{path ? 'Missing' : 'None'}</span>
        )}

        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`${s.btn} ${s.btnSmall}`}
            disabled={uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? 'Uploading…' : path ? 'Replace' : 'Upload'}
          </button>
          {path && (
            <button
              type="button"
              className={`${s.btn} ${s.btnSmall}`}
              onClick={() => onChange(null)}
            >
              Clear
            </button>
          )}
        </span>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {error && <p className={s.hint} style={{ color: '#b00020' }}>{error}</p>}

      {onAltChange && (
        <TextInput
          label={altLabel}
          value={alt ?? ''}
          onChange={onAltChange}
          hint="Read aloud by screen readers, and shown if the image is still missing."
        />
      )}
    </div>
  );
}
