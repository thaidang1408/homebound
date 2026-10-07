/** Data-driven item catalogue. Add items here; systems read definitions, never item ids. */
export interface ItemDefinition {
  name: string;
  /** Emoji placeholder icon until real art exists. */
  icon: string;
  maxStack: number;
  /** Hunger restored when eaten. Absent = not edible. */
  hunger?: number;
  /** Item id this turns into on a cooking station (checked with `cookResult`). */
  cooksInto?: string;
}

export const ITEMS = {
  raw_meat: { name: 'Raw meat', icon: '🥩', maxStack: 10, hunger: 8, cooksInto: 'cooked_meat' },
  cooked_meat: { name: 'Cooked meat', icon: '🍖', maxStack: 10, hunger: 35 },
  berries: { name: 'Berries', icon: '🫐', maxStack: 20, hunger: 6 },
  wood: { name: 'Wood', icon: '🪵', maxStack: 20 },
  stone: { name: 'Stone', icon: '🪨', maxStack: 20 },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

export function isItemId(value: string): value is ItemId {
  return Object.hasOwn(ITEMS, value);
}

export function getItem(id: ItemId): ItemDefinition {
  return ITEMS[id];
}

/** What an item becomes on the stove, or null if it can't be cooked. */
export function cookResult(id: ItemId): ItemId | null {
  const def: ItemDefinition = ITEMS[id];
  return def.cooksInto && isItemId(def.cooksInto) ? def.cooksInto : null;
}
