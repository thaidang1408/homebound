import type { ItemId } from '../items.js';

/** Harvestable node kinds. Data-driven: add a kind here and to the world generator. */
export interface ResourceKindDefinition {
  drop: ItemId;
  /** Items per harvest. */
  qty: number;
  /** Harvests before the node is depleted. */
  charges: number;
  respawnMs: number;
  /** Prompt verb: "[E] Chop wood". */
  verb: string;
  /** Collision footprint half-size (0 = you can walk through it). */
  colliderHalf: number;
  /** Interaction footprint half-size. */
  reachHalf: number;
}

export const RESOURCE_KINDS = {
  tree: {
    drop: 'wood',
    qty: 1,
    charges: 4,
    respawnMs: 5 * 60_000,
    verb: 'Chop',
    colliderHalf: 0.3,
    reachHalf: 0.4,
  },
  rock: {
    drop: 'stone',
    qty: 1,
    charges: 3,
    respawnMs: 6 * 60_000,
    verb: 'Mine',
    colliderHalf: 0.55,
    reachHalf: 0.65,
  },
  bush: {
    drop: 'berries',
    qty: 2,
    charges: 2,
    respawnMs: 3 * 60_000,
    verb: 'Pick',
    colliderHalf: 0,
    reachHalf: 0.6,
  },
} as const satisfies Record<string, ResourceKindDefinition>;

export type ResourceKind = keyof typeof RESOURCE_KINDS;

/** Minimum time between two harvests by the same player. */
export const HARVEST_COOLDOWN_MS = 600;
