'use client';

import s from '../../proposals.module.css';
import { AccentSelect } from './fields';
import { CoverForm } from './forms/CoverForm';
import { NarrativeForm } from './forms/NarrativeForm';
import { FeatureListForm } from './forms/FeatureListForm';
import { MoodboardForm } from './forms/MoodboardForm';
import { ShowcaseForm } from './forms/ShowcaseForm';
import { PricingForm, type BuilderLineItem } from './forms/PricingForm';
import { PhasesForm } from './forms/PhasesForm';
import { SplitNarrativeForm } from './forms/SplitNarrativeForm';
import { ActionItemsForm } from './forms/ActionItemsForm';
import { DeliveryTimelineForm } from './forms/DeliveryTimelineForm';
import { SignatureForm } from './forms/SignatureForm';
import { BLOCK_LABELS, type ProposalBlock } from '@/types/proposal';

/**
 * Routes a selected block to its own hand-written form. The forms are not
 * generated from the Zod schemas on purpose — moodboard and pricing in
 * particular need affordances (uploads, a running total, a visibility
 * toggle) that a generated form would never produce.
 */
export function BlockEditor({
  block,
  onChange,
  lineItems,
  onLineItemsChange,
  currency,
}: {
  block: ProposalBlock;
  onChange: (block: ProposalBlock) => void;
  lineItems: BuilderLineItem[];
  onLineItemsChange: (items: BuilderLineItem[]) => void;
  currency: string;
}) {
  // Each branch narrows `block` to its own variant, so every form receives a
  // correctly typed block and content patcher.
  const body = (() => {
    switch (block.type) {
      case 'cover':
        return (
          <CoverForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'narrative':
        return (
          <NarrativeForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'feature_list':
        return (
          <FeatureListForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'moodboard':
        return (
          <MoodboardForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'showcase':
        return (
          <ShowcaseForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'pricing':
        return (
          <PricingForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
            lineItems={lineItems}
            onLineItemsChange={onLineItemsChange}
            currency={currency}
          />
        );
      case 'phases':
        return (
          <PhasesForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'split_narrative':
        return (
          <SplitNarrativeForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'action_items':
        return (
          <ActionItemsForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'delivery_timeline':
        return (
          <DeliveryTimelineForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      case 'signature':
        return (
          <SignatureForm
            block={block}
            onContentChange={(content) => onChange({ ...block, content })}
          />
        );
      default: {
        const never: never = block;
        void never;
        return null;
      }
    }
  })();

  return (
    <div className={s.editorForm}>
      <div className={s.repeatHead}>
        <h2 className={s.editorTitle}>{BLOCK_LABELS[block.type]}</h2>
      </div>

      <AccentSelect
        value={block.accent}
        onChange={(accent) => onChange({ ...block, accent })}
      />

      {body}
    </div>
  );
}
