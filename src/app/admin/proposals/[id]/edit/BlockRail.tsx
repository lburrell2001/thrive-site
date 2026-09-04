'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import s from '../../proposals.module.css';
import { BLOCK_LABELS, type ProposalBlock } from '@/types/proposal';

/** A short human label for a block, taken from whatever it actually says. */
export function blockSummary(block: ProposalBlock): string {
  const c = block.content as Record<string, unknown>;
  const first = (...keys: string[]) => {
    for (const key of keys) {
      const value = c[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };

  switch (block.type) {
    case 'cover':
      return first('subtitle', 'titleLine2', 'titleLine1') || 'Cover';
    case 'narrative':
    case 'moodboard':
      return (
        [first('headingLine1'), first('headingLine2')].filter(Boolean).join(' ') ||
        BLOCK_LABELS[block.type]
      );
    case 'split_narrative': {
      const left = (c.left as { heading?: string } | undefined)?.heading;
      return left || BLOCK_LABELS.split_narrative;
    }
    case 'signature':
      return first('clientSignerLabel') || 'Signature';
    default:
      return first('kicker') || BLOCK_LABELS[block.type];
  }
}

export function BlockRail({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onToggleVisible,
  onDuplicate,
  onDelete,
}: {
  blocks: ProposalBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (blocks: ProposalBlock[]) => void;
  onToggleVisible: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard dragging: focus a handle, press space, arrow, space again.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((block) => block.id === active.id);
    const to = blocks.findIndex((block) => block.id === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(blocks, from, to).map((block, index) => ({ ...block, position: index })));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {blocks.map((block) => (
            <RailRow
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              onSelect={() => onSelect(block.id)}
              onToggleVisible={() => onToggleVisible(block.id)}
              onDuplicate={() => onDuplicate(block.id)}
              onDelete={() => onDelete(block.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function RailRow({
  block,
  selected,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onDelete,
}: {
  block: ProposalBlock;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${s.railItem} ${selected ? s.railItemActive : ''} ${
        block.visible ? '' : s.railItemHidden
      } ${isDragging ? s.railItemDragging : ''}`}
      onClick={onSelect}
    >
      <button
        type="button"
        className={s.railHandle}
        aria-label={`Reorder ${blockSummary(block)}`}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </button>

      <span className={s.railLabel}>
        {blockSummary(block)}
        <span className={s.railType}>{BLOCK_LABELS[block.type]}</span>
      </span>

      <button
        type="button"
        className={s.railIcon}
        aria-label={block.visible ? 'Hide from the client' : 'Show to the client'}
        title={block.visible ? 'Hide from the client' : 'Show to the client'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
      >
        {block.visible ? '👁' : '🚫'}
      </button>

      <button
        type="button"
        className={s.railIcon}
        aria-label="Duplicate block"
        title="Duplicate block"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
      >
        ⧉
      </button>

      <button
        type="button"
        className={s.railIcon}
        aria-label="Delete block"
        title="Delete block"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ✕
      </button>
    </li>
  );
}
