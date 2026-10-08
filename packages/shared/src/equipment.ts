import { ARMOR_MAX, PLAYER_INVENTORY_SLOTS } from './constants.js';
import { EQUIP_SLOTS, getItem, isItemId, type EquipSlot, type ItemDefinition } from './items.js';

/**
 * Worn gear (Phase 14, ADR-027): one item per equipment slot (EQUIP_SLOTS order). Only worn
 * pieces count — armor, quiet boots, the extra slots of a bag on your back.
 */
type Stack = { itemId: string; qty: number };

export const equipIndex = (slot: EquipSlot): number => EQUIP_SLOTS.indexOf(slot);

/** Where an item is worn, or null if it isn't gear. Weapons go in the weapon slot. */
export function wearSlotOf(itemId: string): EquipSlot | null {
  if (!isItemId(itemId)) return null;
  const def: ItemDefinition = getItem(itemId);
  return def.wear ?? (def.weapon ? 'weapon' : null);
}

function wornDefs(equipment: Iterable<Stack>): ItemDefinition[] {
  const out: ItemDefinition[] = [];
  for (const s of equipment) if (s.qty > 0 && isItemId(s.itemId)) out.push(getItem(s.itemId));
  return out;
}

/** How much less creature blows hurt (0–ARMOR_MAX): worn pieces add up. */
export function armorOf(equipment: Iterable<Stack>): number {
  const total = wornDefs(equipment).reduce((sum, d) => sum + (d.armor ?? 0), 0);
  return Math.min(ARMOR_MAX, total);
}

/** Share of the usual distance creatures notice you from (1 = no help). */
export function gearStealth(equipment: Iterable<Stack>): number {
  return wornDefs(equipment).reduce((m, d) => m * (d.stealth ?? 1), 1);
}

/** Backpack slots with this gear on: the base, plus the bag on your back. */
export function backpackSize(equipment: Iterable<Stack>): number {
  return PLAYER_INVENTORY_SLOTS + wornDefs(equipment).reduce((n, d) => n + (d.slots ?? 0), 0);
}

/**
 * What's in your hand: the selected hotbar item, or — with that slot empty — the weapon you wear.
 */
export function handItem(
  p: {
    inventory: { at(i: number): Stack | undefined };
    equipment: { at(i: number): Stack | undefined };
  },
  slot: number,
): string {
  const held = p.inventory.at(slot);
  if (held && held.qty > 0) return held.itemId;
  const weapon = p.equipment.at(equipIndex('weapon'));
  return weapon && weapon.qty > 0 ? weapon.itemId : '';
}
