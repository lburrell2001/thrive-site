import type { ProposalBlock } from '@/types/proposal';

/** Every form receives its own block and a patch callback for its content. */
export interface FormProps<B extends ProposalBlock> {
  block: B;
  onContentChange: (content: B['content']) => void;
}
