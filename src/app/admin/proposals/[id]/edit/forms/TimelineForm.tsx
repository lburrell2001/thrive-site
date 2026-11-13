'use client';

import s from '../../../proposals.module.css';
import { Repeater, TextArea, TextInput } from '../fields';
import type { TimelineBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function TimelineForm({ block, onContentChange }: FormProps<TimelineBlock>) {
  const c = block.content;
  const set = (patch: Partial<TimelineBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <div className={s.inlineRow}>
        <TextInput label="Heading line 1" value={c.headingLine1} onChange={(v) => set({ headingLine1: v })} hint="White." />
        <TextInput label="Heading line 2" value={c.headingLine2} onChange={(v) => set({ headingLine2: v })} hint="Accent colour, e.g. to Launch." />
      </div>

      <TextArea label="Intro (optional)" value={c.intro ?? ''} rows={2} onChange={(v) => set({ intro: v || undefined })} />

      <Repeater
        label="Steps"
        items={c.entries}
        addLabel="Add a step"
        blank={() => ({ when: '', title: '', description: '' })}
        onChange={(entries) => set({ entries })}
        render={(entry, update) => (
          <>
            <div className={s.inlineRow}>
              <TextInput label="When" value={entry.when} onChange={(v) => update({ when: v })} hint="e.g. Now, By mid-December, March–April" />
              <TextInput label="Title" value={entry.title} onChange={(v) => update({ title: v })} />
            </div>
            <TextInput label="Description" value={entry.description} onChange={(v) => update({ description: v })} />
          </>
        )}
      />
    </>
  );
}
