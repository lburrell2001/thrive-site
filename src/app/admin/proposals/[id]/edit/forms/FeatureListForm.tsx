'use client';

import { Repeater, TextArea, TextInput } from '../fields';
import type { FeatureListBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function FeatureListForm({ block, onContentChange }: FormProps<FeatureListBlock>) {
  const c = block.content;
  const set = (patch: Partial<FeatureListBlock['content']>) => onContentChange({ ...c, ...patch });

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
            <TextInput label="Title" value={item.title} onChange={(v) => update({ title: v })} />
            <TextArea
              label="Description"
              value={item.description}
              rows={3}
              onChange={(v) => update({ description: v })}
            />
          </>
        )}
      />
    </>
  );
}
