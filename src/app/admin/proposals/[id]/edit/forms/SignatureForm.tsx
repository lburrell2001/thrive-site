'use client';

import { TextInput } from '../fields';
import type { SignatureBlock } from '@/types/proposal';
import type { FormProps } from './types';

export function SignatureForm({ block, onContentChange }: FormProps<SignatureBlock>) {
  const c = block.content;
  const set = (patch: Partial<SignatureBlock['content']>) => onContentChange({ ...c, ...patch });

  return (
    <>
      <TextInput
        label="Client approval label"
        value={c.clientSignerLabel}
        onChange={(v) => set({ clientSignerLabel: v })}
      />
      <TextInput
        label="Your name"
        value={c.agencySignerName}
        onChange={(v) => set({ agencySignerName: v })}
      />
      <TextInput
        label="Your title"
        value={c.agencySignerTitle}
        onChange={(v) => set({ agencySignerTitle: v })}
      />
      <TextInput
        label="Terms link"
        value={c.termsUrl ?? ''}
        onChange={(v) => set({ termsUrl: v || undefined })}
        hint="Optional. Must be a full https:// address."
      />
    </>
  );
}
