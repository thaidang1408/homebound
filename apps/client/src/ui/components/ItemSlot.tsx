import { getItem, isItemId } from '@homebound/shared';
import styles from './ItemSlot.module.css';

interface Props {
  itemId: string;
  qty: number;
  selected?: boolean;
  /** Small number in the corner (hotbar key). */
  hint?: string;
  onClick?: () => void;
  label?: string;
}

/** One inventory cell. Clickable cells are buttons (keyboard + screen-reader friendly). */
export function ItemSlot({ itemId, qty, selected = false, hint, onClick, label }: Props) {
  const item = qty > 0 && isItemId(itemId) ? getItem(itemId) : null;
  const title = item ? `${item.name} ×${qty}` : 'Empty';
  const content = (
    <>
      {hint && <span className={styles.hint}>{hint}</span>}
      {item && <span className={styles.icon}>{item.icon}</span>}
      {item && qty > 1 && <span className={styles.qty}>{qty}</span>}
    </>
  );
  const className = [styles.slot, selected && styles.selected, !item && styles.empty]
    .filter(Boolean)
    .join(' ');

  if (!onClick) {
    return (
      <div className={className} title={title}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={label ? `${label}: ${title}` : title}
      onClick={onClick}
      disabled={!item}
    >
      {content}
    </button>
  );
}
