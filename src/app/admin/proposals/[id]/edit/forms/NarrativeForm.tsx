'use client';

import s from '../../../proposals.module.css';
import { TextArea, TextInput } from '../fields';
import type { NarrativeBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function NarrativeForm({ block, onContentChange }: FormProps<NarrativeBlock>) {
  const c = block.content;
  const set = (patch: Partial<NarrativeBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <div className={s.inlineRow}>
        <TextInput
          label="Heading line 1"
          value={c.headingLine1}
          onChange={(v) => set({ headingLine1: v })}
          hint="White."
        />
        <TextInput
          label="Heading line 2"
          value={c.headingLine2}
          onChange={(v) => set({ headingLine2: v })}
          hint="Accent colour. Start it with & (as in & PRICING) for the big ampersand."
        />
      </div>

      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
        hint="Bold label on a rule that runs to the page edge, in the accent's partner colour."
      />

      <TextArea
        label="Body"
        value={c.body}
        rows={10}
        onChange={(v) => set({ body: v })}
        hint="Blank line starts a new paragraph. **bold**, *italic*, [link](https://…), - bullets, ### coloured subheading, > callout with a bar (> **Label** text puts the label in colour)."
      />
    </>
  );
}
