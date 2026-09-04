'use client';

import { Repeater, TextArea, TextInput } from '../fields';
import type { ActionItemsBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function ActionItemsForm({ block, onContentChange }: FormProps<ActionItemsBlock>) {
  const c = block.content;
  const set = (patch: Partial<ActionItemsBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
      />

      <Repeater
        label="Items"
        items={c.items}
        addLabel="Add an item"
        blank={() => ({ title: '', description: '' })}
        onChange={(items) => set({ items })}
        render={(item, update) => (
          <>
            <TextInput
              label="What they do"
              value={item.title}
              onChange={(v) => update({ title: v })}
            />
            <TextArea
              label="Detail"
              value={item.description}
              rows={2}
              onChange={(v) => update({ description: v })}
            />
          </>
        )}
      />

      <TextInput
        label="Closing line"
        value={c.closing ?? ''}
        onChange={(v) => set({ closing: v || undefined })}
        hint="Avoid hard-coded day counts here — they go stale when the proposal is reused."
      />
    </>
  );
}
