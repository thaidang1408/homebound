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
  /** Held in the hotbar, this item is a weapon (weapons.ts). */
  weapon?: string;
  /** Carried anywhere in the backpack, it's worn: creature blows hurt this much less (0–1). */
  armor?: number;
  /** Eating it grants this buff (buffs.ts). */
  buff?: string;
  /** Placed on the ground from the hotbar (left click) as this trap. */
  trap?: 'snare' | 'spike';
}

export const ITEMS = {
  raw_meat: { name: 'Raw meat', icon: '🥩', maxStack: 10, hunger: 8, cooksInto: 'cooked_meat' },
  cooked_meat: { name: 'Cooked meat', icon: '🍖', maxStack: 10, hunger: 35 },
  berries: { name: 'Berries', icon: '🫐', maxStack: 20, hunger: 6 },
  wood: { name: 'Wood', icon: '🪵', maxStack: 20 },
  stone: { name: 'Stone', icon: '🪨', maxStack: 20 },
  spear: { name: 'Spear', icon: '🔱', maxStack: 1, weapon: 'spear' },
  bow: { name: 'Bow', icon: '🏹', maxStack: 1, weapon: 'bow' },
  arrow: { name: 'Arrow', icon: '➶', maxStack: 30 },
  mushroom: { name: 'Mushroom', icon: '🍄', maxStack: 20, hunger: 4 },
  hide: { name: 'Hide', icon: '🟫', maxStack: 10 },
  antler: { name: 'Antler', icon: '🦌', maxStack: 5 },
  bear_claw: { name: 'Bear claw', icon: '🐾', maxStack: 5 },
  stew: { name: 'Hunter’s stew', icon: '🍲', maxStack: 5, hunger: 45, buff: 'warm' },
  mushroom_skewer: {
    name: 'Mushroom skewer',
    icon: '🍢',
    maxStack: 5,
    hunger: 20,
    buff: 'keen',
  },
  antler_spear: { name: 'Antler spear', icon: '🗡️', maxStack: 1, weapon: 'antler_spear' },
  leather_armor: { name: 'Leather armor', icon: '🦺', maxStack: 1, armor: 0.25 },
  bear_coat: { name: 'Bear-hide coat', icon: '🧥', maxStack: 1, armor: 0.45 },
  snare: { name: 'Snare', icon: '🪢', maxStack: 5, trap: 'snare' },
  spike_trap: { name: 'Spike trap', icon: '🔺', maxStack: 3, trap: 'spike' },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

export function isItemId(value: string): value is ItemId {
  return Object.hasOwn(ITEMS, value);
}

export function getItem(id: ItemId): ItemDefinition {
  return ITEMS[id];
}

/** The best armor in a backpack (0 = none): how much less creature blows hurt. */
export function armorOf(slots: Iterable<{ itemId: string }>): number {
  let best = 0;
  for (const s of slots) {
    if (!isItemId(s.itemId)) continue;
    const def: ItemDefinition = ITEMS[s.itemId];
    best = Math.max(best, def.armor ?? 0);
  }
  return best;
}

/** What an item becomes on the stove, or null if it can't be cooked. */
export function cookResult(id: ItemId): ItemId | null {
  const def: ItemDefinition = ITEMS[id];
  return def.cooksInto && isItemId(def.cooksInto) ? def.cooksInto : null;
}
