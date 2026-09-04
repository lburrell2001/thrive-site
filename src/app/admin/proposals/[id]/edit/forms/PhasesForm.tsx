'use client';

import { Repeater, TextArea, TextInput } from '../fields';
import type { PhasesBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function PhasesForm({ block, onContentChange }: FormProps<PhasesBlock>) {
  const c = block.content;
  const set = (patch: Partial<PhasesBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
      />

      <Repeater
        label="Phases"
        items={c.phases}
        addLabel="Add a phase"
        blank={() => ({ label: `Phase ${c.phases.length + 1}`, name: '', description: '' })}
        onChange={(phases) => set({ phases })}
        render={(phase, update) => (
          <>
            <TextInput
              label="Label"
              value={phase.label}
              onChange={(v) => update({ label: v })}
              hint="Numbering is drawn automatically; this is the small label above the name."
            />
            <TextInput label="Name" value={phase.name} onChange={(v) => update({ name: v })} />
            <TextArea
              label="Description"
              value={phase.description}
              rows={3}
              onChange={(v) => update({ description: v })}
            />
          </>
        )}
      />
    </>
  );
}
