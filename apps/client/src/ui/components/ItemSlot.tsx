import { useState } from 'react';
import { getItem, isItemId } from '@homebound/shared';
import styles from './ItemSlot.module.css';

/** dataTransfer type for dragging stacks between slots. */
const DRAG_TYPE = 'application/x-homebound-slot';

interface Props {
  itemId: string;
  qty: number;
  selected?: boolean;
  /** Small number in the corner (hotbar key). */
  hint?: string;
  onClick?: () => void;
  label?: string;
  /** Makes the slot draggable and a drop target; `dragId` identifies it (e.g. "player:3"). */
  dragId?: string;
  onDropItem?: (fromDragId: string) => void;
}

/** One inventory cell. Clickable cells are buttons (keyboard + screen-reader friendly). */
export function ItemSlot({
  itemId,
  qty,
  selected = false,
  hint,
  onClick,
  label,
  dragId,
  onDropItem,
}: Props) {
  const [over, setOver] = useState(false);
  const item = qty > 0 && isItemId(itemId) ? getItem(itemId) : null;
  const title = item ? `${item.name} ×${qty}` : 'Empty';
  const content = (
    <>
      {hint && <span className={styles.hint}>{hint}</span>}
      {item && <span className={styles.icon}>{item.icon}</span>}
      {item && qty > 1 && <span className={styles.qty}>{qty}</span>}
    </>
  );
  const className = [
    styles.slot,
    selected && styles.selected,
    !item && styles.empty,
    over && styles.dropTarget,
  ]
    .filter(Boolean)
    .join(' ');

  if (!onClick && !onDropItem) {
    return (
      <div className={className} title={title}>
        {content}
      </div>
    );
  }
  const droppable = dragId !== undefined && onDropItem !== undefined;
  return (
    <button
      type="button"
      className={className}
      title={item && droppable ? `${title} — drag to move` : title}
      aria-label={label ? `${label}: ${title}` : title}
      onClick={item ? onClick : undefined}
      // Empty slots stay enabled when they can receive a dragged stack.
      disabled={!item && !droppable}
      draggable={droppable && item !== null}
      onDragStart={(e) => {
        if (!dragId) return;
        e.dataTransfer.setData(DRAG_TYPE, dragId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (!droppable || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault(); // allow the drop
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const from = e.dataTransfer.getData(DRAG_TYPE);
        if (!from || !onDropItem || from === dragId) return;
        e.preventDefault();
        onDropItem(from);
      }}
    >
      {content}
    </button>
  );
}
