'use client';

import { ImageField, Repeater, TextArea, TextInput } from '../fields';
import type { ShowcaseBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function ShowcaseForm({ block, onContentChange }: FormProps<ShowcaseBlock>) {
  const c = block.content;
  const set = (patch: Partial<ShowcaseBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <TextInput
        label="Kicker"
        value={c.kicker ?? ''}
        onChange={(v) => set({ kicker: v || undefined })}
      />
      <TextArea label="Intro" value={c.intro} rows={4} onChange={(v) => set({ intro: v })} />

      <Repeater
        label="Cards"
        items={c.cards}
        max={4}
        addLabel="Add a card"
        blank={() => ({ imagePath: '', title: '', subtitle: '' })}
        onChange={(cards) => set({ cards })}
        render={(card, update) => (
          <>
            <ImageField
              label="Card image"
              blockId={block.id}
              path={card.imagePath || null}
              onChange={(path) => update({ imagePath: path ?? '' })}
            />
            <TextInput label="Title" value={card.title} onChange={(v) => update({ title: v })} />
            <TextInput
              label="Subtitle"
              value={card.subtitle}
              onChange={(v) => update({ subtitle: v })}
            />
          </>
        )}
      />
    </>
  );
}
