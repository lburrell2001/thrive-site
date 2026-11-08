'use client';

// One questionnaire question as the client sees it: the right input for its
// type, big tap targets, required marker and missing highlight. Used by the
// portal questionnaire page and the admin editor's live preview.

import { UPLOAD_ACCEPT, isMulti, type AnswerValue, type Question, type UploadedFile } from '@/lib/questionnaires';
import s from './questionnaire.module.css';

export default function QuestionField({ q, value, disabled, missing, uploading, onChange, onUpload, onRemove }: {
  q: Question;
  value: AnswerValue;
  disabled: boolean;
  missing: boolean;
  uploading: boolean;
  onChange: (v: AnswerValue, typed: boolean) => void;
  onUpload: (files: FileList | null) => void;
  onRemove: (path: string) => void;
}) {
  const fid = `q-${q.id}`;
  const str = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? (value as string[]) : [];

  let field: React.ReactNode;
  switch (q.type) {
    case 'short_text':
      field = <input id={fid} className={s.input} value={str} disabled={disabled} maxLength={1000} onChange={(e) => onChange(e.target.value, true)} />;
      break;
    case 'long_text':
      field = <textarea id={fid} className={s.textarea} value={str} disabled={disabled} maxLength={20000} onChange={(e) => onChange(e.target.value, true)} />;
      break;
    case 'url':
      field = <input id={fid} className={s.input} type="url" inputMode="url" placeholder="https://" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value, true)} />;
      break;
    case 'date':
      field = <input id={fid} className={s.input} type="date" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value || null, false)} style={{ maxWidth: 260 }} />;
      break;
    case 'yes_no':
      field = (
        <div className={s.choices} role="radiogroup" aria-labelledby={`${fid}-l`}>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={value === v} disabled={disabled}
              className={`${s.choice} ${value === v ? s.choiceOn : ''}`} onClick={() => onChange(value === v ? null : v, false)}>
              <span className={s.dot} />{v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );
      break;
    case 'single_choice':
      field = (
        <div className={s.choices} role="radiogroup" aria-labelledby={`${fid}-l`}>
          {q.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={str === o} disabled={disabled}
              className={`${s.choice} ${str === o ? s.choiceOn : ''}`} onClick={() => onChange(str === o ? null : o, false)}>
              <span className={s.dot} />{o}
            </button>
          ))}
        </div>
      );
      break;
    case 'multi_choice':
    case 'checkbox_list':
      field = (
        <div className={s.choices} role="group" aria-labelledby={`${fid}-l`}>
          {q.options.map((o) => {
            const on = list.includes(o);
            return (
              <button key={o} type="button" role="checkbox" aria-checked={on} disabled={disabled}
                className={`${s.choice} ${on ? s.choiceOn : ''}`}
                onClick={() => { const next = on ? list.filter((x) => x !== o) : [...list, o]; onChange(next.length ? next : null, false); }}>
                <span className={s.box}>{on ? '✓' : ''}</span>{o}
              </button>
            );
          })}
        </div>
      );
      break;
    case 'file_upload': {
      const files = Array.isArray(value) ? (value as unknown as UploadedFile[]) : [];
      field = (
        <>
          {files.length > 0 && (
            <ul className={s.files}>
              {files.map((f) => (
                <li key={f.path} className={s.file}>
                  {f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.name}</a> : <span>{f.name}</span>}
                  {!disabled && <button type="button" className={s.fileX} onClick={() => onRemove(f.path)} disabled={uploading} aria-label={`Remove ${f.name}`}>×</button>}
                </li>
              ))}
            </ul>
          )}
          {!disabled && (
            <label className={s.upload} style={{ position: 'relative', opacity: uploading ? 0.6 : 1 }}>
              <input type="file" multiple accept={UPLOAD_ACCEPT} disabled={uploading} onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }} />
              {uploading ? 'Uploading…' : files.length ? '+ Add more files' : '+ Upload files'}
            </label>
          )}
          <p className={s.help} style={{ margin: '8px 0 0' }}>Images, PDFs or documents, up to 10 MB each.</p>
        </>
      );
      break;
    }
  }

  const labelFor = ['short_text', 'long_text', 'url', 'date'].includes(q.type);
  return (
    <div className={`${s.q} ${missing ? s.qMissing : ''}`}>
      {labelFor
        ? <label htmlFor={fid} id={`${fid}-l`} className={s.prompt}>{q.prompt}{q.is_required && <span className={s.req} aria-label="required">*</span>}</label>
        : <p id={`${fid}-l`} className={s.prompt}>{q.prompt}{q.is_required && <span className={s.req} aria-label="required">*</span>}</p>}
      {q.help_text && <p className={s.help}>{q.help_text}</p>}
      {isMulti(q.type) && !disabled && <p className={s.help}>Pick as many as you like.</p>}
      {field}
      {missing && <p className={s.missingNote}>This one’s required.</p>}
    </div>
  );
}
