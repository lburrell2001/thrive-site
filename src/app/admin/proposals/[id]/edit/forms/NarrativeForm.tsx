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
          hint="Accent, clipped at the page edge."
        />
      </div>

      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
        hint="Small label above an accent rule."
      />

      <TextArea
        label="Body"
        value={c.body}
        rows={10}
        onChange={(v) => set({ body: v })}
        hint="Blank line starts a new paragraph. **bold**, *italic*, [link](https://…), and - bullets."
      />
    </>
  );
}
