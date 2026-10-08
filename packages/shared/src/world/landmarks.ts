import { WORLD_RADIUS } from '../constants.js';
import type { LootEntry } from '../creatures.js';
import type { Box, Point } from './collision.js';

/**
 * Landmarks of the wilds (Phase 12, ADR-025): places you can see from afar and want to reach.
 * Each is data: where it is, what you can't walk through, its loot cache (refilled every morning)
 * and its waystone. Walking close discovers it for the whole home.
 */

export type LandmarkKind = 'giant_tree' | 'cave' | 'camp' | 'watchtower' | 'shrine';

export interface LandmarkDefinition {
  id: string;
  kind: LandmarkKind;
  name: string;
  icon: string;
  x: number;
  z: number;
  colliders: readonly Box[];
  /** A chest of loot, refilled every morning. */
  cache?: { at: Point; loot: readonly LootEntry[] };
  /** Discovering the landmark lights its waystone: travel between lit ones. */
  waystone: Point;
}

/** Walk this close to a landmark to discover it. */
export const DISCOVER_RANGE = 14; // m
/** The home waystone, in the front yard. Always lit. */
export const HOME_WAYSTONE = { id: 'waystone-home', name: 'Home', at: { x: 7, z: 7 } } as const;
/** From the top of the watchtower you can see (and map) this far. */
export const TOWER_VIEW = 75; // m

const box = (x: number, z: number, halfX: number, halfZ = halfX): Box => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
});

export const LANDMARKS: readonly LandmarkDefinition[] = [
  {
    id: 'giant-tree',
    kind: 'giant_tree',
    name: 'The Giant Tree',
    icon: '🌳',
    x: 0,
    z: -82,
    colliders: [box(0, -82, 1.3)],
    cache: {
      at: { x: 2.6, z: -79.4 },
      loot: [
        { itemId: 'mushroom', min: 2, max: 4 },
        { itemId: 'berries', min: 3, max: 5 },
        { itemId: 'pet_egg', min: 0, max: 1 },
      ],
    },
    waystone: { x: -3, z: -76 },
  },
  {
    id: 'cave',
    kind: 'cave',
    name: 'Echo Cave',
    icon: '🪨',
    x: 82,
    z: 4,
    // A rock mound open to the west (toward home): back wall and two sides.
    colliders: [box(85.4, 4, 0.8, 4), box(82, 7.6, 3.4, 0.8), box(82, 0.4, 3.4, 0.8)],
    cache: {
      at: { x: 83.6, z: 4 },
      loot: [
        { itemId: 'stone', min: 3, max: 5 },
        { itemId: 'arrow', min: 4, max: 8 },
        { itemId: 'bear_claw', min: 0, max: 1 },
      ],
    },
    waystone: { x: 75, z: 4 },
  },
  {
    id: 'camp',
    kind: 'camp',
    name: 'Abandoned Camp',
    icon: '⛺',
    x: 14,
    z: 68,
    colliders: [box(15.2, 69.6, 1.3, 1.2)],
    cache: {
      at: { x: 11.6, z: 68.4 },
      loot: [
        { itemId: 'cooked_meat', min: 2, max: 3 },
        { itemId: 'arrow', min: 5, max: 8 },
        { itemId: 'snare', min: 1, max: 1 },
      ],
    },
    waystone: { x: 9, z: 63 },
  },
  {
    id: 'watchtower',
    kind: 'watchtower',
    name: 'Old Watchtower',
    icon: '🗼',
    x: -80,
    z: -6,
    // Four posts; you can stand under it (and climb it with [E]).
    colliders: [
      box(-81.3, -7.3, 0.25),
      box(-78.7, -7.3, 0.25),
      box(-81.3, -4.7, 0.25),
      box(-78.7, -4.7, 0.25),
    ],
    cache: {
      at: { x: -77, z: -3 },
      loot: [
        { itemId: 'arrow', min: 6, max: 10 },
        { itemId: 'hide', min: 1, max: 2 },
        { itemId: 'spike_trap', min: 0, max: 1 },
      ],
    },
    waystone: { x: -73, z: -6 },
  },
  {
    id: 'shrine',
    kind: 'shrine',
    name: 'Spirit Shrine',
    icon: '✨',
    x: 50,
    z: -66,
    colliders: [box(50, -66, 0.6)],
    waystone: { x: 45, z: -61 },
  },
];

const byId = new Map(LANDMARKS.map((l) => [l.id, l]));
export const findLandmark = (id: string) => byId.get(id);

/** Interactable ids for a landmark's parts. */
export const cacheId = (l: LandmarkDefinition) => `cache-${l.id}`;
export const waystoneId = (l: LandmarkDefinition) => `waystone-${l.id}`;

/** Every waystone: home first, then one per landmark (`landmark` is the one that lights it). */
export const WAYSTONES: readonly { id: string; name: string; at: Point; landmark: string }[] = [
  { ...HOME_WAYSTONE, landmark: '' },
  ...LANDMARKS.map((l) => ({ id: waystoneId(l), name: l.name, at: l.waystone, landmark: l.id })),
];
export const findWaystone = (id: string) => WAYSTONES.find((w) => w.id === id);

/** Landmark colliders, plus the waystones (a stone you walk around). */
export const LANDMARK_COLLIDERS: readonly Box[] = [
  ...LANDMARKS.flatMap((l) => l.colliders),
  ...WAYSTONES.map((w) => box(w.at.x, w.at.z, 0.35)),
];

// --- The shared map's fog of war ---

/** The map is a grid of square cells; a cell is revealed for both once either player is near. */
export const MAP_CELL = 8; // m
export const REVEAL_RADIUS = 22; // m
export const MAP_CELLS = Math.ceil((WORLD_RADIUS * 2) / MAP_CELL);

/** Centre of map cell `i` (row-major from the north-west corner). */
export function cellCenter(i: number): Point {
  const col = i % MAP_CELLS;
  const row = Math.floor(i / MAP_CELLS);
  return { x: -WORLD_RADIUS + (col + 0.5) * MAP_CELL, z: -WORLD_RADIUS + (row + 0.5) * MAP_CELL };
}

export const isMapCell = (i: number) => Number.isInteger(i) && i >= 0 && i < MAP_CELLS * MAP_CELLS;

/** Cells whose centre lies within `radius` of a point (inside the world). */
export function cellsAround(p: Point, radius: number): number[] {
  const out: number[] = [];
  const span = Math.ceil(radius / MAP_CELL) + 1;
  const col0 = Math.floor((p.x + WORLD_RADIUS) / MAP_CELL);
  const row0 = Math.floor((p.z + WORLD_RADIUS) / MAP_CELL);
  for (let row = row0 - span; row <= row0 + span; row++) {
    for (let col = col0 - span; col <= col0 + span; col++) {
      if (row < 0 || col < 0 || row >= MAP_CELLS || col >= MAP_CELLS) continue;
      const i = row * MAP_CELLS + col;
      const c = cellCenter(i);
      if (Math.hypot(c.x - p.x, c.z - p.z) <= radius) out.push(i);
    }
  }
  return out;
}
