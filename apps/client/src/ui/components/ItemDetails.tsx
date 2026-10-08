import {
  BUFFS,
  WEAPONS,
  getItem,
  isBuffId,
  isItemId,
  isWeaponId,
  wearSlotOf,
  type EquipSlot,
  type ItemDefinition,
} from '@homebound/shared';
import styles from './ItemDetails.module.css';

export const EQUIP_LABELS: Record<EquipSlot, { label: string; glyph: string }> = {
  head: { label: 'Head', glyph: '🧢' },
  body: { label: 'Body', glyph: '👕' },
  feet: { label: 'Feet', glyph: '🥾' },
  back: { label: 'Back', glyph: '🎒' },
  weapon: { label: 'Weapon', glyph: '⚔️' },
};

const MINUTE_MS = 60_000;

/** The numbers behind an item, in player words ("🛡️ −25% damage"). */
export function itemFacts(itemId: string): string[] {
  if (!isItemId(itemId)) return [];
  const d: ItemDefinition = getItem(itemId);
  const facts: string[] = [];
  if (d.hunger) facts.push(`🍖 +${d.hunger} hunger`);
  if (d.buff && isBuffId(d.buff)) {
    const b = BUFFS[d.buff];
    facts.push(`${b.icon} ${b.name} for ${Math.round(b.durationMs / MINUTE_MS)} min`);
  }
  if (d.weapon && isWeaponId(d.weapon)) facts.push(`⚔️ ${WEAPONS[d.weapon].damage} damage`);
  if (d.armor) facts.push(`🛡️ −${Math.round(d.armor * 100)}% damage taken`);
  if (d.stealth) facts.push(`🤫 noticed from ${Math.round((1 - d.stealth) * 100)}% closer`);
  if (d.slots) facts.push(`🎒 +${d.slots} backpack slots`);
  const where = wearSlotOf(itemId);
  if (where) facts.push(`Worn: ${EQUIP_LABELS[where].label.toLowerCase()}`);
  return facts;
}

/** The box under a grid: what the hovered item is, its numbers, and what you can do with it. */
export function ItemDetails({
  itemId,
  qty,
  children,
}: {
  itemId: string | null;
  qty?: number;
  children?: React.ReactNode;
}) {
  if (!itemId || !isItemId(itemId)) {
    return <p className={styles.empty}>Point at an item to read about it.</p>;
  }
  const item = getItem(itemId);
  return (
    <div className={styles.details} aria-live="polite">
      <span className={styles.icon} aria-hidden>
        {item.icon}
      </span>
      <div className={styles.text}>
        <strong>
          {item.name}
          {qty && qty > 1 ? ` ×${qty}` : ''}
        </strong>
        <span>{item.description}</span>
        <span className={styles.facts}>
          {itemFacts(itemId).map((f) => (
            <span key={f}>{f}</span>
          ))}
        </span>
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
