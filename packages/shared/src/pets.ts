import type { ItemId } from './items.js';

/**
 * Fantasy pets (Phase 11, ADR-024) are data: one definition per kind, one shared pet AI on the
 * server. A pet hatches from an egg found in a nest, or is befriended in the wild by feeding it
 * its favorite food (each kind also roams the world as a creature with the same id). Pets never
 * get hurt: kid-friendly, nothing to lose.
 */

export const PetOrder = {
  Follow: 'follow',
  Stay: 'stay',
  /** Back to its spot in the yard; at night the fighters guard it. */
  Home: 'home',
} as const;
export type PetOrder = (typeof PetOrder)[keyof typeof PetOrder];
export const PET_ORDERS: readonly PetOrder[] = Object.values(PetOrder);

/** What a pet visibly does (synced as `PetState.action` with a wrapping counter). */
export type PetAction = 'pat' | 'fire' | 'heal' | 'fetch' | 'forage' | 'hatch';

export interface PetDefinition {
  /** Default name, also the species name in prompts ("Baby dragon"). */
  name: string;
  icon: string;
  /** What it does for you, in player words (pet panel). */
  role: string;
  /** Wild ones become your friend after eating this from your hand `feeds` times. */
  food: ItemId;
  feeds: number;
  /** Floats through trees and walls. */
  ghostly: boolean;
  /** Breathes fire / headbutts creatures that hunt players (and that come near the yard at night). */
  fight?: { range: number; damage: number; cooldownMs: number };
  /** Butchers carcasses near its owner straight into their backpack. */
  fetch?: { range: number };
  /** Marks the nearest animal on its owner's compass. */
  scout?: { range: number };
  /** Heals players close to it. */
  heal?: { range: number; perSecond: number };
  /** Picks berries and mushrooms near it for its owner. */
  forage?: { range: number; cooldownMs: number };
}

export const PETS = {
  dragon: {
    name: 'Rồng con',
    icon: '🐉',
    role: 'Phun lửa vào con thú nào săn bạn, và canh sân nhà ban đêm.',
    food: 'cooked_meat',
    feeds: 3,
    ghostly: false,
    fight: { range: 7, damage: 10, cooldownMs: 1600 },
  },
  ghost: {
    name: 'Ma bé',
    icon: '👻',
    role: 'Bay xuyên tường, phát sáng trong đêm và đánh dấu con thú gần nhất lên la bàn.',
    food: 'mushroom',
    feeds: 3,
    ghostly: true,
    scout: { range: 45 },
  },
  dino: {
    name: 'Khủng long con',
    icon: '🦖',
    role: 'Húc con thú nào săn bạn và xẻ thịt con mồi giúp bạn.',
    food: 'raw_meat',
    feeds: 3,
    ghostly: false,
    fight: { range: 2.2, damage: 6, cooldownMs: 1200 },
    fetch: { range: 12 },
  },
  unicorn: {
    name: 'Kỳ lân con',
    icon: '🦄',
    role: 'Chữa lành cho bạn và người chơi cùng khi ở gần nó.',
    food: 'berries',
    feeds: 3,
    ghostly: false,
    heal: { range: 6, perSecond: 1.2 },
  },
  alien: {
    name: 'Alien tí hon',
    icon: '👽',
    role: 'Hái quả mọng và nấm quanh bạn rồi bỏ vào ba lô.',
    food: 'stone',
    feeds: 3,
    ghostly: false,
    forage: { range: 10, cooldownMs: 12_000 },
  },
} as const satisfies Record<string, PetDefinition>;

export type PetKind = keyof typeof PETS;
export const PET_KINDS = Object.keys(PETS) as PetKind[];

export function isPetKind(value: string): value is PetKind {
  return Object.hasOwn(PETS, value);
}

export function getPet(kind: PetKind): PetDefinition {
  return PETS[kind];
}
