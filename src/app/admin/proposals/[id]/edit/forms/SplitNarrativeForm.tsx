'use client';

import { TextArea, TextInput } from '../fields';
import type { SplitNarrativeBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function SplitNarrativeForm({ block, onContentChange }: FormProps<SplitNarrativeBlock>) {
  const c = block.content;

  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <div key={side} style={{ marginBottom: 18 }}>
          <TextInput
            label={`${side === 'left' ? 'Left' : 'Right'} heading`}
            value={c[side].heading}
            onChange={(v) => onContentChange({ ...c, [side]: { ...c[side], heading: v } })}
          />
          <TextArea
            label={`${side === 'left' ? 'Left' : 'Right'} body`}
            value={c[side].body}
            rows={9}
            onChange={(v) => onContentChange({ ...c, [side]: { ...c[side], body: v } })}
            hint="Blank line starts a new paragraph. **bold** works well for the lead-in of each point."
          />
        </div>
      ))}
    </>
  );
}
