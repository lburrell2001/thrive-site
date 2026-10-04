'use client';

// The right-hand panel: settings for the selected section, or the whole
// email's style when nothing is selected.

import p from '../proposals/proposals.module.css';
import d from './designer.module.css';
import {
  BLOCK_HINT,
  BLOCK_LABEL,
  EMAIL_FONTS,
  THEMES,
  type BlockOf,
  type EmailFont,
  type NewsletterBlock,
  type NewsletterDesign,
  type Theme,
} from '@/lib/newsletterBlocks';
import { ColorField, Field, ImageInput, LinkInput, Segmented, TextInput, Toggle, type Notify } from './fields';

const PADS = [
  { value: 'none' as const, label: '0' },
  { value: 'small' as const, label: 'S' },
  { value: 'medium' as const, label: 'M' },
  { value: 'large' as const, label: 'L' },
];
const ALIGN = [{ value: 'left' as const, label: 'Left' }, { value: 'center' as const, label: 'Center' }];

/** Add, edit and remove the repeated items of a section (projects, numbers, services). */
function Items<T>({ label, items, max, min = 1, make, render, onChange }: {
  label: string; items: T[]; max: number; min?: number; make: () => T;
  render: (item: T, set: (patch: Partial<T>) => void, i: number) => React.ReactNode;
  onChange: (items: T[]) => void;
}) {
  const set = (i: number, patch: Partial<T>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className={d.items}>
      {items.map((item, i) => (
        <div key={i} className={d.item}>
          <div className={d.itemHead}>
            <span>{label} {i + 1}</span>
            <span className={d.iconRow}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length <= min} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}>✕</button>
            </span>
          </div>
          {render(item, (patch) => set(i, patch), i)}
        </div>
      ))}
      {items.length < max && (
        <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => onChange([...items, make()])}>+ Add {label.toLowerCase()}</button>
      )}
    </div>
  );
}

export function SectionInspector({ block: b, onChange, notify, onMove, onDuplicate, onDelete, canUp, canDown }: {
  block: NewsletterBlock;
  onChange: (next: NewsletterBlock) => void;
  notify: Notify;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  // Each case narrows b; set merges a patch of that block's own fields.
  const set = (patch: Partial<NewsletterBlock>) => onChange({ ...b, ...patch } as NewsletterBlock);

  let fields: React.ReactNode = null;
  switch (b.type) {
    case 'header': {
      const h = b as BlockOf<'header'>;
      fields = (
        <>
          <p className={d.hint}>Shows your logo (from Style) — white on dark bands, outlined on light ones.</p>
          <Items label="Link" items={h.links} max={3} min={0} make={() => ({ label: 'Work', href: '/portfolio' })} onChange={(links) => set({ links })}
            render={(l, s) => (<><TextInput label="Label" value={l.label} onChange={(v) => s({ label: v })} /><LinkInput label="Goes to" value={l.href} onChange={(v) => s({ href: v })} /></>)} />
        </>
      );
      break;
    }
    case 'hero': {
      const h = b as BlockOf<'hero'>;
      fields = (
        <>
          <TextInput label="Small label" value={h.eyebrow} onChange={(v) => set({ eyebrow: v })} placeholder="New work" />
          <TextInput label="Headline" value={h.headline} onChange={(v) => set({ headline: v })} multiline rows={2} />
          <TextInput label="Line under it" value={h.text} onChange={(v) => set({ text: v })} multiline rows={3} />
          <div className={d.pair}>
            <TextInput label="Button" value={h.buttonLabel} onChange={(v) => set({ buttonLabel: v })} placeholder="Leave empty for none" />
            <LinkInput label="Goes to" value={h.buttonHref} onChange={(v) => set({ buttonHref: v })} />
          </div>
          <Segmented label="Image" value={h.imagePosition} onChange={(v) => set({ imagePosition: v })}
            options={[{ value: 'none', label: 'None' }, { value: 'above', label: 'Above' }, { value: 'below', label: 'Below' }]} />
          {h.imagePosition !== 'none' && <ImageInput src={h.image.src} alt={h.image.alt} href={h.image.href} notify={notify} onChange={(patch) => set({ image: { ...h.image, ...patch } })} />}
          <Segmented label="Align" value={h.align} options={ALIGN} onChange={(v) => set({ align: v })} />
        </>
      );
      break;
    }
    case 'gallery': {
      const g = b as BlockOf<'gallery'>;
      fields = (
        <>
          <TextInput label="Small label" value={g.eyebrow} onChange={(v) => set({ eyebrow: v })} placeholder="Recent work" />
          <TextInput label="Heading" value={g.heading} onChange={(v) => set({ heading: v })} />
          <Segmented label="Across" value={g.columns} onChange={(v) => set({ columns: v })} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} />
          <Items label="Project" items={g.items} max={6} make={() => ({ src: '', alt: '', href: '/portfolio', title: '', caption: '' })} onChange={(items) => set({ items })}
            render={(it, s) => (
              <>
                <ImageInput src={it.src} alt={it.alt} href={it.href} notify={notify} onChange={s} />
                <div className={d.pair}>
                  <TextInput label="Title" value={it.title} onChange={(v) => s({ title: v })} />
                  <TextInput label="Caption" value={it.caption} onChange={(v) => s({ caption: v })} placeholder="Brand identity" />
                </div>
              </>
            )} />
        </>
      );
      break;
    }
    case 'stats': {
      const st = b as BlockOf<'stats'>;
      fields = (
        <Items label="Number" items={st.items} max={3} make={() => ({ value: '10+', label: 'something' })} onChange={(items) => set({ items })}
          render={(it, s) => (<div className={d.pair}><TextInput label="Number" value={it.value} onChange={(v) => s({ value: v })} /><TextInput label="Label" value={it.label} onChange={(v) => s({ label: v })} /></div>)} />
      );
      break;
    }
    case 'features': {
      const f = b as BlockOf<'features'>;
      fields = (
        <>
          <TextInput label="Small label" value={f.eyebrow} onChange={(v) => set({ eyebrow: v })} />
          <TextInput label="Heading" value={f.heading} onChange={(v) => set({ heading: v })} />
          <Toggle label="Number them 01, 02, 03" checked={f.numbered} onChange={(v) => set({ numbered: v })} />
          <Items label="Item" items={f.items} max={6} make={() => ({ title: 'Service', text: '' })} onChange={(items) => set({ items })}
            render={(it, s) => (<><TextInput label="Title" value={it.title} onChange={(v) => s({ title: v })} /><TextInput label="Line" value={it.text} onChange={(v) => s({ text: v })} multiline rows={2} /></>)} />
        </>
      );
      break;
    }
    case 'quote': {
      const q = b as BlockOf<'quote'>;
      fields = (
        <>
          <TextInput label="What they said" value={q.text} onChange={(v) => set({ text: v })} multiline rows={4} />
          <div className={d.pair}>
            <TextInput label="Name" value={q.name} onChange={(v) => set({ name: v })} />
            <TextInput label="Role, company" value={q.role} onChange={(v) => set({ role: v })} />
          </div>
          <p className={d.hint}>Use real words from an approved review (Reviews page) — and ask before quoting someone by name.</p>
        </>
      );
      break;
    }
    case 'cta': {
      const c = b as BlockOf<'cta'>;
      fields = (
        <>
          <TextInput label="Headline" value={c.headline} onChange={(v) => set({ headline: v })} multiline rows={2} />
          <TextInput label="Line under it" value={c.text} onChange={(v) => set({ text: v })} multiline rows={2} />
          <div className={d.pair}>
            <TextInput label="Button" value={c.buttonLabel} onChange={(v) => set({ buttonLabel: v })} />
            <LinkInput label="Goes to" value={c.buttonHref} onChange={(v) => set({ buttonHref: v })} />
          </div>
          <Segmented label="Align" value={c.align} options={ALIGN} onChange={(v) => set({ align: v })} />
        </>
      );
      break;
    }
    case 'footer':
      fields = (
        <>
          <TextInput label="Sign-off line" value={(b as BlockOf<'footer'>).tagline} onChange={(v) => set({ tagline: v })} />
          <p className={d.hint}>Social links come from Style. The unsubscribe link and mailing address are added below every email automatically.</p>
        </>
      );
      break;
    case 'image': {
      const im = b as BlockOf<'image'>;
      fields = (
        <>
          <ImageInput src={im.src} alt={im.alt} href={im.href} notify={notify} onChange={(patch) => set(patch)} />
          <Segmented label="Width" value={im.width} onChange={(v) => set({ width: v })} options={[{ value: 'full', label: 'Edge to edge' }, { value: 'padded', label: 'Inset' }]} />
        </>
      );
      break;
    }
    case 'heading': {
      const h = b as BlockOf<'heading'>;
      fields = (
        <>
          <TextInput label="Small label" value={h.eyebrow} onChange={(v) => set({ eyebrow: v })} />
          <TextInput label="Heading" value={h.text} onChange={(v) => set({ text: v })} multiline rows={2} />
          <Segmented label="Size" value={h.size} onChange={(v) => set({ size: v })} options={[{ value: 'large', label: 'Large' }, { value: 'medium', label: 'Medium' }]} />
          <Segmented label="Align" value={h.align} options={ALIGN} onChange={(v) => set({ align: v })} />
        </>
      );
      break;
    }
    case 'text': {
      const t = b as BlockOf<'text'>;
      fields = (
        <>
          <TextInput label="Text" value={t.text} onChange={(v) => set({ text: v })} multiline rows={8}
            hint={<>**bold**, *italic*, [link text](/portfolio), and lines starting “- ” for a list.</>} />
          <Segmented label="Align" value={t.align} options={ALIGN} onChange={(v) => set({ align: v })} />
        </>
      );
      break;
    }
    case 'button': {
      const bt = b as BlockOf<'button'>;
      fields = (
        <>
          <div className={d.pair}>
            <TextInput label="Button" value={bt.label} onChange={(v) => set({ label: v })} />
            <LinkInput label="Goes to" value={bt.href} onChange={(v) => set({ href: v })} />
          </div>
          <Segmented label="Align" value={bt.align} options={ALIGN} onChange={(v) => set({ align: v })} />
        </>
      );
      break;
    }
    case 'columns': {
      const c = b as BlockOf<'columns'>;
      fields = (
        <>
          <ImageInput src={c.image.src} alt={c.image.alt} href={c.image.href} notify={notify} onChange={(patch) => set({ image: { ...c.image, ...patch } })} />
          <Segmented label="Image on the" value={c.imageSide} onChange={(v) => set({ imageSide: v })} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
          <TextInput label="Heading" value={c.heading} onChange={(v) => set({ heading: v })} />
          <TextInput label="Text" value={c.text} onChange={(v) => set({ text: v })} multiline rows={4} />
          <div className={d.pair}>
            <TextInput label="Button" value={c.buttonLabel} onChange={(v) => set({ buttonLabel: v })} placeholder="Optional" />
            <LinkInput label="Goes to" value={c.buttonHref} onChange={(v) => set({ buttonHref: v })} />
          </div>
        </>
      );
      break;
    }
    case 'spacer':
      fields = <Segmented label="Height" value={(b as BlockOf<'spacer'>).size} onChange={(v) => set({ size: v })} options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]} />;
      break;
    case 'social':
      fields = <p className={d.hint}>Shows the Instagram, LinkedIn and website links from Style.</p>;
      break;
    case 'divider':
      break;
  }

  return (
    <div>
      <div className={d.panelHead}>
        <div>
          <h3 className={d.panelTitle}>{BLOCK_LABEL[b.type]}</h3>
          <p className={d.hint} style={{ margin: 0 }}>{BLOCK_HINT[b.type]}</p>
        </div>
        <span className={d.iconRow}>
          <button type="button" onClick={() => onMove(-1)} disabled={!canUp} aria-label="Move up" title="Move up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={!canDown} aria-label="Move down" title="Move down">↓</button>
          <button type="button" onClick={onDuplicate} aria-label="Duplicate" title="Duplicate">⧉</button>
          <button type="button" onClick={onDelete} aria-label="Delete section" title="Delete" className={d.danger}>✕</button>
        </span>
      </div>
      <div className={d.group}>
        <ColorField label="Background" value={b.bg ?? ''} onChange={(v) => set({ bg: v })} allowNone />
        {b.type !== 'spacer' && <Segmented label="Space around" value={b.pad} options={PADS} onChange={(v) => set({ pad: v })} />}
      </div>
      {fields && <div className={d.group}>{fields}</div>}
      <p className={d.hint} style={{ padding: '0 16px 16px' }}>Tip: click words in the email to type straight into them. Text colour follows the background.</p>
    </div>
  );
}

export function StylePanel({ design, onDesign, onTheme, notify }: {
  design: NewsletterDesign;
  onDesign: (d: NewsletterDesign) => void;
  onTheme: (t: Theme) => void;
  notify: Notify;
}) {
  const set = <K extends keyof NewsletterDesign>(k: K, v: NewsletterDesign[K]) => onDesign({ ...design, [k]: v });
  const fontOptions = (Object.keys(EMAIL_FONTS) as EmailFont[]).map((f) => <option key={f} value={f}>{EMAIL_FONTS[f].label}</option>);

  return (
    <div>
      <div className={d.panelHead}>
        <div>
          <h3 className={d.panelTitle}>Style</h3>
          <p className={d.hint} style={{ margin: 0 }}>For the whole email. Click a section to edit it.</p>
        </div>
      </div>

      <div className={d.group}>
        <span className={d.fieldLabel}>Theme</span>
        <div className={d.themes}>
          {THEMES.map((t) => (
            <button key={t.key} type="button" className={`${d.theme} ${design.theme === t.key ? d.themeOn : ''}`} onClick={() => onTheme(t)}>
              <span className={d.themeSwatch}>{t.swatch.map((c) => <span key={c} style={{ background: c }} />)}</span>
              {t.label}
            </button>
          ))}
        </div>
        <p className={d.hint}>Sets colours, fonts and the coloured bands. Your words and images stay.</p>
      </div>

      <div className={d.group}>
        <ColorField label="Accent — buttons, links, labels" value={design.accent} onChange={(v) => set('accent', v)} />
        <ColorField label="Button text" value={design.buttonText} onChange={(v) => set('buttonText', v)} />
        <ColorField label="Headings" value={design.headingColor} onChange={(v) => set('headingColor', v)} />
        <ColorField label="Text" value={design.textColor} onChange={(v) => set('textColor', v)} />
        <ColorField label="Email background" value={design.contentBg} onChange={(v) => set('contentBg', v)} />
        <ColorField label="Around the email" value={design.pageBg} onChange={(v) => set('pageBg', v)} />
      </div>

      <div className={d.group}>
        <div className={d.pair}>
          <Field label="Heading font"><select className={p.select} value={design.headingFont} onChange={(e) => set('headingFont', e.target.value as EmailFont)}>{fontOptions}</select></Field>
          <Field label="Text font"><select className={p.select} value={design.bodyFont} onChange={(e) => set('bodyFont', e.target.value as EmailFont)}>{fontOptions}</select></Field>
        </div>
        <Toggle label="Headlines in capitals" checked={design.uppercase} onChange={(v) => set('uppercase', v)} />
        <Segmented label="Corners" value={design.corners} onChange={(v) => set('corners', v)}
          options={[{ value: 'square', label: 'Square' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: 'Round' }]} />
        <p className={d.hint}>Apple Mail and iPhones show these fonts. Gmail and Outlook swap in a close standard font — for exact lettering, put it in an image.</p>
      </div>

      <div className={d.group}>
        <ImageInput label="Logo (optional — replaces the Thrive logo)" src={design.logoUrl} alt="Thrive Creative Studios" notify={notify} hideLink onChange={(patch) => patch.src !== undefined && set('logoUrl', patch.src)} />
        {design.logoUrl && <button type="button" className={`${p.btn} ${p.btnSmall}`} onClick={() => set('logoUrl', '')}>Use the Thrive logo</button>}
      </div>

      <div className={d.group}>
        <TextInput label="Instagram" value={design.instagram} onChange={(v) => set('instagram', v)} placeholder="https://instagram.com/…" />
        <TextInput label="LinkedIn" value={design.linkedin} onChange={(v) => set('linkedin', v)} placeholder="https://linkedin.com/…" />
        <TextInput label="Website" value={design.website} onChange={(v) => set('website', v)} />
      </div>
    </div>
  );
}
