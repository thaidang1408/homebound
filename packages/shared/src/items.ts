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
    name: 'Thịt sống',
    icon: '🥩',
    description: 'Có được khi đi săn. Nấu trên bếp — ăn sống thì chẳng no mấy.',
    maxStack: 10,
    hunger: 8,
    cooksInto: 'cooked_meat',
  },
  cooked_meat: {
    name: 'Thịt chín',
    icon: '🍖',
    description: 'Một bữa ăn no nê.',
    maxStack: 10,
    hunger: 35,
  },
  berries: {
    name: 'Quả mọng',
    icon: '🫐',
    description: 'Món ăn vặt ngọt từ bụi cây. Dùng để nấu món trên bếp.',
    maxStack: 20,
    hunger: 6,
  },
  wood: {
    name: 'Gỗ',
    icon: '🪵',
    description: 'Chặt từ cây. Để làm dụng cụ, bẫy và mũi tên.',
    maxStack: 20,
  },
  stone: {
    name: 'Đá',
    icon: '🪨',
    description: 'Đập từ tảng đá. Để làm mũi giáo, mũi tên và bẫy.',
    maxStack: 20,
  },
  spear: {
    name: 'Giáo',
    icon: '🔱',
    description: 'Đánh xa hơn và mạnh hơn tay không.',
    maxStack: 1,
    weapon: 'spear',
  },
  bow: {
    name: 'Cung',
    icon: '🏹',
    description: 'Bắn mũi tên trong ba lô. Ở xa thì ngắm cao lên một chút.',
    maxStack: 1,
    weapon: 'bow',
  },
  arrow: {
    name: 'Mũi tên',
    icon: '➶',
    description: 'Đạn cho cây cung.',
    maxStack: 30,
  },
  mushroom: {
    name: 'Nấm',
    icon: '🍄',
    description: 'Mọc trong rừng. Cầm trên tay để nướng ở bếp, hoặc dùng nấu món.',
    maxStack: 20,
    hunger: 4,
    cooksInto: 'grilled_mushroom',
  },
  hide: {
    name: 'Da thú',
    icon: '🟫',
    description: 'Từ nai, heo rừng và gấu. Để may quần áo, giáp, túi và bẫy dây.',
    maxStack: 10,
  },
  antler: {
    name: 'Gạc nai',
    icon: '🦌',
    description: 'Từ con nai. Làm được cây giáo rất mạnh.',
    maxStack: 5,
  },
  bear_claw: {
    name: 'Vuốt gấu',
    icon: '🐾',
    description: 'Từ con gấu. Để may chiếc áo ấm nhất.',
    maxStack: 5,
  },
  stew: {
    name: 'Món hầm thợ săn',
    icon: '🍲',
    description: 'Món hầm nóng: hồi máu nhanh hơn nhiều trong một lúc.',
    maxStack: 5,
    hunger: 45,
    buff: 'warm',
  },
  mushroom_skewer: {
    name: 'Xiên nấm',
    icon: '🍢',
    description: 'Món ăn nhẹ: thú phát hiện bạn muộn hơn trong một lúc.',
    maxStack: 5,
    hunger: 20,
    buff: 'keen',
  },
  grilled_mushroom: {
    name: 'Nấm nướng',
    icon: '🥘',
    description: 'Món ăn nhanh từ chảo.',
    maxStack: 20,
    hunger: 12,
  },
  berry_tart: {
    name: 'Bánh quả mọng',
    icon: '🥧',
    description: 'Năng lượng ngọt ngào: thể lực hồi nhanh hơn trong một lúc.',
    maxStack: 5,
    hunger: 25,
    buff: 'sweet',
  },
  hunters_feast: {
    name: 'Tiệc thợ săn',
    icon: '🍱',
    description: 'Bữa thật to: no căng bụng và hồi máu rất lâu.',
    maxStack: 3,
    hunger: 80,
    buff: 'feast',
  },
  antler_spear: {
    name: 'Giáo gạc nai',
    icon: '🗡️',
    description: 'Vũ khí cận chiến tốt nhất: mạnh và nhanh.',
    maxStack: 1,
    weapon: 'antler_spear',
  },
  leather_cap: {
    name: 'Mũ da',
    icon: '🧢',
    description: 'Đội lên đầu: bị đánh đỡ đau hơn một chút.',
    maxStack: 1,
    wear: 'head',
    armor: 0.1,
  },
  leather_armor: {
    name: 'Áo giáp da',
    icon: '🦺',
    description: 'Mặc vào người: bị đánh đỡ đau hơn.',
    maxStack: 1,
    wear: 'body',
    armor: 0.25,
  },
  bear_coat: {
    name: 'Áo lông gấu',
    icon: '🧥',
    description: 'Mặc vào người: bị đánh đỡ đau hơn rất nhiều.',
    maxStack: 1,
    wear: 'body',
    armor: 0.45,
  },
  soft_boots: {
    name: 'Giày mềm',
    icon: '🥾',
    description: 'Bước chân êm: thú phải lại gần hơn mới thấy bạn.',
    maxStack: 1,
    wear: 'feet',
    stealth: 0.8,
  },
  satchel: {
    name: 'Túi đeo',
    icon: '👜',
    description: 'Túi nhỏ đeo sau lưng: đựng được nhiều hơn.',
    maxStack: 1,
    wear: 'back',
    slots: 5,
  },
  big_backpack: {
    name: 'Ba lô lớn',
    icon: '🎒',
    description: 'Ba lô to đeo sau lưng, cho những chuyến đi xa.',
    maxStack: 1,
    wear: 'back',
    slots: 10,
  },
  snare: {
    name: 'Bẫy dây',
    icon: '🪢',
    description: 'Cầm trên tay và bấm chuột để đặt. Bắt được thú nhỏ.',
    maxStack: 5,
    trap: 'snare',
  },
  spike_trap: {
    name: 'Bẫy chông',
    icon: '🔺',
    description: 'Cầm trên tay và bấm chuột để đặt. Con nào giẫm lên sẽ bị thương.',
    maxStack: 3,
    trap: 'spike',
  },
  pet_egg: {
    name: 'Trứng phát sáng',
    icon: '🥚',
    description: 'Cầm trên tay và bấm chuột ở sân nhà: một bé xinh xắn sẽ nở ra.',
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
