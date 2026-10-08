import {
  ItemStack,
  backpackSize,
  equipIndex,
  wearSlotOf,
  type PlayerState,
} from '@homebound/shared';
import { createSlots, type Slots } from './inventory.js';

/**
 * Wearing and taking off gear (ADR-027). A bag on your back adds backpack slots, so changing it
 * resizes the backpack — refused when the slots that would go away still hold something.
 */
export type GearOutcome = 'done' | 'not-gear' | 'empty' | 'bag-not-empty' | 'backpack-full';

export function createEquipment(): Slots {
  return createSlots(equipIndex('weapon') + 1);
}

/** Grows or shrinks the backpack to `size` slots. Only call after checking the tail is empty. */
function resize(inventory: Slots, size: number): void {
  while (inventory.length < size) inventory.push(new ItemStack());
  if (inventory.length > size) inventory.splice(size, inventory.length - size);
}

const tailEmpty = (inventory: Slots, from: number, except = -1) =>
  [...inventory].every((s, i) => i < from || i === except || s.qty === 0);

/** Puts on the gear in backpack slot `slot`; what was worn there takes its place in the backpack. */
export function equip(player: PlayerState, slot: number): GearOutcome {
  const stack = player.inventory.at(slot);
  if (!stack || stack.qty === 0) return 'empty';
  const where = wearSlotOf(stack.itemId);
  if (!where) return 'not-gear';
  const worn = player.equipment.at(equipIndex(where));
  if (!worn) return 'not-gear';
  // The backpack size once it's on (only a bag changes it).
  const after = backpackSize(
    [...player.equipment].map((s, i) => (i === equipIndex(where) ? stack : s)),
  );
  // A smaller bag: the slots that go away must be empty. `slot` empties unless the old piece
  // lands in it.
  if (!tailEmpty(player.inventory, after, worn.qty > 0 ? -1 : slot)) return 'bag-not-empty';
  const { itemId } = stack;
  stack.itemId = worn.qty > 0 ? worn.itemId : '';
  stack.qty = worn.qty > 0 ? 1 : 0;
  worn.itemId = itemId;
  worn.qty = 1;
  resize(player.inventory, after);
  return 'done';
}

/** Takes off what's in equipment slot `index`, into the first free backpack slot. */
export function unequip(player: PlayerState, index: number): GearOutcome {
  const worn = player.equipment.at(index);
  if (!worn || worn.qty === 0) return 'empty';
  const after = backpackSize([...player.equipment].filter((_, i) => i !== index));
  if (!tailEmpty(player.inventory, after)) return 'bag-not-empty';
  const free = [...player.inventory].findIndex((s, i) => i < after && s.qty === 0);
  if (free < 0) return 'backpack-full';
  const target = player.inventory.at(free);
  if (!target) return 'backpack-full';
  target.itemId = worn.itemId;
  target.qty = 1;
  worn.itemId = '';
  worn.qty = 0;
  resize(player.inventory, after);
  return 'done';
}

/** Matches the backpack to the gear (a restored save, a new player). */
export function fitBackpack(player: PlayerState): void {
  resize(player.inventory, backpackSize(player.equipment));
}
