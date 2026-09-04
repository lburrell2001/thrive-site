'use client';

import s from '../../../proposals.module.css';
import { Field, ImageField, Repeater, TextInput } from '../fields';
import type { CoverBlock, OverlayName } from '@/types/proposal';
import type { FormProps } from './types';

const OVERLAYS: OverlayName[] = ['orange', 'magenta', 'purple', 'blue', 'green', 'none'];

export function CoverForm({ block, onContentChange }: FormProps<CoverBlock>) {
  const c = block.content;
  const set = (patch: Partial<CoverBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <TextInput label="Eyebrow" value={c.eyebrow} onChange={(v) => set({ eyebrow: v })} />

      <div className={s.inlineRow}>
        <TextInput
          label="Title line 1"
          value={c.titleLine1}
          onChange={(v) => set({ titleLine1: v })}
          hint="White, above line 2."
        />
        <TextInput
          label="Title line 2"
          value={c.titleLine2}
          onChange={(v) => set({ titleLine2: v })}
          hint="Accent, sized to fill the page width. Proposals read PROJECT PROPOSAL."
        />
      </div>

      <TextInput
        label="Project name"
        value={c.projectName ?? ''}
        onChange={(v) => set({ projectName: v || undefined })}
        hint="Optional. Sits over the cover image."
      />

      <TextInput
        label="Subtitle"
        value={c.subtitle}
        onChange={(v) => set({ subtitle: v })}
        hint="Used over the image when no project name is set."
      />
      <TextInput
        label="Tagline"
        value={c.tagline ?? ''}
        onChange={(v) => set({ tagline: v || undefined })}
      />
      <TextInput label="Date" value={c.dateLabel} onChange={(v) => set({ dateLabel: v })} />

      <div className={s.inlineRow}>
        <TextInput
          label="Prepared for"
          value={c.preparedFor}
          onChange={(v) => set({ preparedFor: v })}
        />
        <TextInput
          label="Prepared by"
          value={c.preparedBy}
          onChange={(v) => set({ preparedBy: v })}
        />
      </div>

      <ImageField
        label="Hero image"
        blockId={block.id}
        path={c.heroImagePath}
        onChange={(path) => set({ heroImagePath: path })}
      />

      <Field label="Duotone" hint="Pushes the accent through a greyscaled hero.">
        {(id) => (
          <select
            id={id}
            className={s.select}
            value={c.heroOverlay}
            onChange={(e) => set({ heroOverlay: e.target.value as OverlayName })}
          >
            {OVERLAYS.map((overlay) => (
              <option key={overlay} value={overlay}>
                {overlay === 'none' ? 'No overlay' : overlay[0].toUpperCase() + overlay.slice(1)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Repeater
        label="Stat strip"
        items={c.stats ?? []}
        max={6}
        addLabel="Add a stat"
        blank={() => ({ value: '', label: '' })}
        onChange={(stats) => set({ stats: stats.length ? stats : undefined })}
        render={(stat, update) => (
          <div className={s.inlineRow}>
            <TextInput label="Value" value={stat.value} onChange={(v) => update({ value: v })} />
            <TextInput label="Label" value={stat.label} onChange={(v) => update({ label: v })} />
          </div>
        )}
      />
    </>
  );
}
