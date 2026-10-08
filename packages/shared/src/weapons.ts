import { getItem, isItemId, type ItemId } from './items.js';

/**
 * Weapons are data (ADR-017). The held weapon is the hotbar item the player names when attacking;
 * an empty hand or a non-weapon item means fists.
 */
export interface MeleeWeapon {
  kind: 'melee';
  name: string;
  damage: number;
  /** From the player to the creature's edge (m). */
  range: number;
  cooldownMs: number;
}

export interface RangedWeapon {
  kind: 'ranged';
  name: string;
  damage: number;
  cooldownMs: number;
  /** Consumed from the backpack per shot. */
  ammo: ItemId;
  /** Launch speed (m/s); projectiles fall under PROJECTILE_GRAVITY. */
  speed: number;
}

export type WeaponDefinition = MeleeWeapon | RangedWeapon;

export const WEAPONS = {
  fists: { kind: 'melee', name: 'Fists', damage: 8, range: 1.8, cooldownMs: 450 },
  spear: { kind: 'melee', name: 'Spear', damage: 20, range: 2.6, cooldownMs: 700 },
  antler_spear: { kind: 'melee', name: 'Antler spear', damage: 30, range: 2.7, cooldownMs: 650 },
  bow: { kind: 'ranged', name: 'Bow', damage: 16, cooldownMs: 800, ammo: 'arrow', speed: 34 },
} as const satisfies Record<string, WeaponDefinition>;

export type WeaponId = keyof typeof WEAPONS;

export function isWeaponId(value: string): value is WeaponId {
  return Object.hasOwn(WEAPONS, value);
}

/** The weapon an item is (fists for anything that isn't one). */
export function weaponOf(itemId: string): WeaponId {
  if (!isItemId(itemId)) return 'fists';
  const weapon = getItem(itemId).weapon;
  return weapon && isWeaponId(weapon) ? weapon : 'fists';
}

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS[id];
}
