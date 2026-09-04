'use client';

import { Repeater, TextArea, TextInput } from '../fields';
import type { DeliveryTimelineBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function DeliveryTimelineForm({
  block,
  onContentChange,
}: FormProps<DeliveryTimelineBlock>) {
  const c = block.content;
  const set = (patch: Partial<DeliveryTimelineBlock['content']>) =>
    onContentChange({ ...c, ...patch });

  return (
    <>
      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
      />

      <Repeater
        label="Milestones"
        items={c.milestones}
        addLabel="Add a milestone"
        blank={() => ({ label: '', description: '' })}
        onChange={(milestones) => set({ milestones })}
        render={(milestone, update) => (
          <>
            <TextInput
              label="When"
              value={milestone.label}
              onChange={(v) => update({ label: v })}
            />
            <TextArea
              label="What lands"
              value={milestone.description}
              rows={3}
              onChange={(v) => update({ description: v })}
            />
          </>
        )}
      />
    </>
  );
}
