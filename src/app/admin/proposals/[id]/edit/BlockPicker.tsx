'use client';

import s from '../../proposals.module.css';
import { BLOCK_DESCRIPTIONS, BLOCK_LABELS, type BlockType } from '@/types/proposal';
import { BLOCK_TYPES } from '@/lib/proposalSchemas';

export function BlockPicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (type: BlockType) => void;
}) {
  if (!open) return null;

  return (
    <div className={s.railSection} style={{ paddingTop: 0 }}>
      <div className={s.repeatHead}>
        <span className={s.label} style={{ margin: 0 }}>
          Add a block
        </span>
        <button type="button" className={s.railIcon} aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={s.pickerGrid}>
        {BLOCK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={s.pickerItem}
            onClick={() => {
              onAdd(type);
              onClose();
            }}
          >
            <div className={s.pickerName}>{BLOCK_LABELS[type]}</div>
            <p className={s.pickerDesc}>{BLOCK_DESCRIPTIONS[type]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
