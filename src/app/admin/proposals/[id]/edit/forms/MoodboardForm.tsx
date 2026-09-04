'use client';

import s from '../../../proposals.module.css';
import { Checkbox, ImageField, Repeater, TextInput } from '../fields';
import type { MoodboardBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function MoodboardForm({ block, onContentChange }: FormProps<MoodboardBlock>) {
  const c = block.content;
  const set = (patch: Partial<MoodboardBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <div className={s.inlineRow}>
        <TextInput
          label="Heading line 1"
          value={c.headingLine1}
          onChange={(v) => set({ headingLine1: v })}
        />
        <TextInput
          label="Heading line 2"
          value={c.headingLine2}
          onChange={(v) => set({ headingLine2: v })}
        />
      </div>

      <TextInput
        label="Caption pill"
        value={c.caption}
        onChange={(v) => set({ caption: v })}
        hint="The single centred label under the grid."
      />

      <Repeater
        label="Images"
        items={c.images}
        addLabel="Add a tile"
        blank={(): MoodboardBlock['content']['images'][number] => ({ path: '', alt: '' })}
        onChange={(images) => set({ images })}
        render={(image, update) => (
          <>
            <ImageField
              label="Tile image"
              blockId={block.id}
              path={image.path || null}
              onChange={(path) => update({ path: path ?? '' })}
              alt={image.alt}
              onAltChange={(alt) => update({ alt })}
              altLabel="Label"
            />
            <Checkbox
              label="Double width"
              hint="Spans two columns instead of one."
              checked={image.span === 2}
              onChange={(wide) => update({ span: wide ? 2 : undefined })}
            />
          </>
        )}
      />

      <p className={s.hint}>
        A tile with no image still renders, showing its label — useful while you are waiting on
        photography.
      </p>
    </>
  );
}
