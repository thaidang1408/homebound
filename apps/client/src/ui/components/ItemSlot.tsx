import { useState } from 'react';
import { getItem, isItemId } from '@homebound/shared';
import styles from './ItemSlot.module.css';

/** dataTransfer type for dragging stacks between slots (and out of the backpack, to drop). */
export const DRAG_TYPE = 'application/x-homebound-slot';

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
  /** Pointer or keyboard focus on the slot (shows its details). */
  onHover?: () => void;
  onDoubleClick?: () => void;
  /** Faint glyph in an empty slot (what goes there: 🧢 on the head slot). */
  placeholder?: string;
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
  onHover,
  onDoubleClick,
  placeholder,
}: Props) {
  const [over, setOver] = useState(false);
  const item = qty > 0 && isItemId(itemId) ? getItem(itemId) : null;
  const title = item ? `${item.name} ×${qty}` : 'Trống';
  const tooltip = item ? `${item.name}${qty > 1 ? ` ×${qty}` : ''} — ${item.description}` : title;
  const content = (
    <>
      {hint && <span className={styles.hint}>{hint}</span>}
      {item && <span className={styles.icon}>{item.icon}</span>}
      {!item && placeholder && (
        <span className={styles.placeholder} aria-hidden>
          {placeholder}
        </span>
      )}
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
      <div className={className} title={tooltip}>
        {content}
      </div>
    );
  }
  const droppable = dragId !== undefined && onDropItem !== undefined;
  return (
    <button
      type="button"
      className={className}
      title={tooltip}
      aria-label={label ? `${label}: ${title}` : title}
      onClick={item ? onClick : undefined}
      onDoubleClick={item ? onDoubleClick : undefined}
      onMouseEnter={onHover}
      // Also on move: the panel can open with the pointer already resting on a slot.
      onMouseMove={onHover}
      onFocus={onHover}
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
