/** Where a piece of gear is worn (Phase 14, ADR-027). Order = the equipment slots. */
export const EQUIP_SLOTS = ['head', 'body', 'feet', 'back', 'weapon'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** Data-driven item catalogue. Add items here; systems read definitions, never item ids. */
export interface ItemDefinition {
  name: string;
  /** Emoji placeholder icon until real art exists. */
  icon: string;
  /** One line for the tooltip: what it is and what it's for. */
  description: string;
  maxStack: number;
  /** Hunger restored when eaten. Absent = not edible. */
  hunger?: number;
  /** Item id this turns into on a cooking station (checked with `cookResult`). */
  cooksInto?: string;
  /** A weapon (weapons.ts): held from the hotbar, or worn in the weapon slot. */
  weapon?: string;
  /** Worn in this equipment slot (weapons go in 'weapon' without saying so). */
  wear?: Exclude<EquipSlot, 'weapon'>;
  /** Worn: creature blows hurt this much less (0–1; worn pieces add up to ARMOR_MAX). */
  armor?: number;
  /** Worn: creatures notice you from this share of the usual distance (< 1 = quieter). */
  stealth?: number;
  /** Worn on the back: this many extra backpack slots. */
  slots?: number;
  /** Eating it grants this buff (buffs.ts). */
  buff?: string;
  /** Placed on the ground from the hotbar (left click) as this trap. */
  trap?: 'snare' | 'spike';
  /** Set down in the yard (left click) to hatch a pet. */
  egg?: true;
}

export const ITEMS = {
  raw_meat: {
    name: 'Raw meat',
    icon: '🥩',
    description: 'From a hunt. Cook it on the stove — raw it barely fills you.',
    maxStack: 10,
    hunger: 8,
    cooksInto: 'cooked_meat',
  },
  cooked_meat: {
    name: 'Cooked meat',
    icon: '🍖',
    description: 'A hearty meal.',
    maxStack: 10,
    hunger: 35,
  },
  berries: {
    name: 'Berries',
    icon: '🫐',
    description: 'A sweet snack from the bushes. Used in stove dishes.',
    maxStack: 20,
    hunger: 6,
  },
  wood: {
    name: 'Wood',
    icon: '🪵',
    description: 'Chopped from trees. For tools, traps and arrows.',
    maxStack: 20,
  },
  stone: {
    name: 'Stone',
    icon: '🪨',
    description: 'Mined from rocks. For spear tips, arrows and traps.',
    maxStack: 20,
  },
  spear: {
    name: 'Spear',
    icon: '🔱',
    description: 'Reaches farther and hits harder than fists.',
    maxStack: 1,
    weapon: 'spear',
  },
  bow: {
    name: 'Bow',
    icon: '🏹',
    description: 'Shoots arrows from your backpack. Aim a little high far away.',
    maxStack: 1,
    weapon: 'bow',
  },
  arrow: {
    name: 'Arrow',
    icon: '➶',
    description: 'Ammunition for the bow.',
    maxStack: 30,
  },
  mushroom: {
    name: 'Mushroom',
    icon: '🍄',
    description: 'Found in the woods. Grill it on the stove, or use it in dishes.',
    maxStack: 20,
    hunger: 4,
    cooksInto: 'grilled_mushroom',
  },
  hide: {
    name: 'Hide',
    icon: '🟫',
    description: 'From deer, boars and bears. For clothes, armor, bags and snares.',
    maxStack: 10,
  },
  antler: {
    name: 'Antler',
    icon: '🦌',
    description: 'From a deer. Makes a strong spear.',
    maxStack: 5,
  },
  bear_claw: {
    name: 'Bear claw',
    icon: '🐾',
    description: 'From a bear. For the warmest coat.',
    maxStack: 5,
  },
  stew: {
    name: 'Hunter’s stew',
    icon: '🍲',
    description: 'Warm stew: you heal much faster for a while.',
    maxStack: 5,
    hunger: 45,
    buff: 'warm',
  },
  mushroom_skewer: {
    name: 'Mushroom skewer',
    icon: '🍢',
    description: 'Light food: animals notice you later for a while.',
    maxStack: 5,
    hunger: 20,
    buff: 'keen',
  },
  grilled_mushroom: {
    name: 'Grilled mushroom',
    icon: '🥘',
    description: 'A quick snack from the pan.',
    maxStack: 20,
    hunger: 12,
  },
  berry_tart: {
    name: 'Berry tart',
    icon: '🥧',
    description: 'Sweet energy: stamina comes back faster for a while.',
    maxStack: 5,
    hunger: 25,
    buff: 'sweet',
  },
  hunters_feast: {
    name: 'Hunter’s feast',
    icon: '🍱',
    description: 'A big meal that fills you up and keeps you healing for a long while.',
    maxStack: 3,
    hunger: 80,
    buff: 'feast',
  },
  antler_spear: {
    name: 'Antler spear',
    icon: '🗡️',
    description: 'The best melee weapon: strong and quick.',
    maxStack: 1,
    weapon: 'antler_spear',
  },
  leather_cap: {
    name: 'Leather cap',
    icon: '🧢',
    description: 'Wear it on your head: blows hurt a little less.',
    maxStack: 1,
    wear: 'head',
    armor: 0.1,
  },
  leather_armor: {
    name: 'Leather armor',
    icon: '🦺',
    description: 'Wear it on your body: blows hurt less.',
    maxStack: 1,
    wear: 'body',
    armor: 0.25,
  },
  bear_coat: {
    name: 'Bear-hide coat',
    icon: '🧥',
    description: 'Wear it on your body: blows hurt much less.',
    maxStack: 1,
    wear: 'body',
    armor: 0.45,
  },
  soft_boots: {
    name: 'Soft boots',
    icon: '🥾',
    description: 'Quiet steps: animals notice you from closer.',
    maxStack: 1,
    wear: 'feet',
    stealth: 0.8,
  },
  satchel: {
    name: 'Satchel',
    icon: '👜',
    description: 'A small bag to wear on your back: room for more.',
    maxStack: 1,
    wear: 'back',
    slots: 5,
  },
  big_backpack: {
    name: 'Big backpack',
    icon: '🎒',
    description: 'A big bag to wear on your back, for long trips.',
    maxStack: 1,
    wear: 'back',
    slots: 10,
  },
  snare: {
    name: 'Snare',
    icon: '🪢',
    description: 'Hold it and click to set it. Catches small animals.',
    maxStack: 5,
    trap: 'snare',
  },
  spike_trap: {
    name: 'Spike trap',
    icon: '🔺',
    description: 'Hold it and click to set it. Hurts anything that steps on it.',
    maxStack: 3,
    trap: 'spike',
  },
  pet_egg: {
    name: 'Glowing egg',
    icon: '🥚',
    description: 'Hold it and click in the yard: something cute will hatch.',
    maxStack: 2,
    egg: true,
  },
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

/**
 * What [E] at the stove puts on the pans: the held item if it cooks, else raw meat (so the
 * mushrooms you were saving don't get grilled by accident). Null if there's nothing.
 */
export function stoveFood(p: {
  inventory: Iterable<{ itemId: string; qty: number }> & {
    at(i: number): { itemId: string; qty: number } | undefined;
  };
  selectedSlot: number;
}): ItemId | null {
  const held = p.inventory.at(p.selectedSlot);
  if (held && held.qty > 0 && isItemId(held.itemId) && cookResult(held.itemId)) return held.itemId;
  for (const s of p.inventory) if (s.itemId === 'raw_meat' && s.qty > 0) return 'raw_meat';
  return null;
}
