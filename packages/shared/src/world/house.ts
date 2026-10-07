import type { Box, Point } from './collision.js';

/**
 * The home layout (metres, house centred on the origin, front door facing +Z).
 * Single source of truth: the client renders it, client and server collide against it,
 * the server validates interaction distance with it.
 *
 *            north (-Z)
 *   ┌───────────┬───────────┐
 *   │  KITCHEN  │  BEDROOM  │
 *   │ stove     │  bed      │
 *   ├──┐ ┌──────┴──────┐ ┌──┤   ← doorways at x = ±3.5
 *   │chest  LIVING ROOM  workbench
 *   └──────────┐ ┌──────────┘   ← front door at x = 0
 *            south (+Z)
 */

export const HOUSE_HALF_WIDTH = 6; // x
export const HOUSE_HALF_DEPTH = 5; // z
export const WALL_HEIGHT = 2.6;
export const WALL_THICKNESS = 0.2;
export const DOOR_HALF = 0.7;

/** Wall running along X at depth z. */
function wallX(z: number, x1: number, x2: number): Box {
  const h = WALL_THICKNESS / 2;
  return { minX: x1, maxX: x2, minZ: z - h, maxZ: z + h };
}

/** Wall running along Z at x. */
function wallZ(x: number, z1: number, z2: number): Box {
  const h = WALL_THICKNESS / 2;
  return { minX: x - h, maxX: x + h, minZ: z1, maxZ: z2 };
}

const W = HOUSE_HALF_WIDTH;
const D = HOUSE_HALF_DEPTH;
const ROOM_DOOR_X = 3.5;

/** Doorway centres (gaps in the walls below). The client draws lintels above them. */
export const DOORWAYS: readonly Point[] = [
  { x: 0, z: D },
  { x: -ROOM_DOOR_X, z: 0 },
  { x: ROOM_DOOR_X, z: 0 },
];

export const HOUSE_WALLS: readonly Box[] = [
  wallX(-D, -W, W), // north
  wallZ(-W, -D, D), // west
  wallZ(W, -D, D), // east
  wallX(D, -W, -DOOR_HALF), // south, left of the front door
  wallX(D, DOOR_HALF, W), // south, right of the front door
  wallX(0, -W, -ROOM_DOOR_X - DOOR_HALF), // living ↔ kitchen/bedroom wall, three pieces
  wallX(0, -ROOM_DOOR_X + DOOR_HALF, ROOM_DOOR_X - DOOR_HALF),
  wallX(0, ROOM_DOOR_X + DOOR_HALF, W),
  wallZ(0, -D, 0), // kitchen ↔ bedroom
];

export type InteractableKind = 'stove' | 'chest' | 'bed' | 'workbench';

export interface FurnitureDefinition {
  id: string;
  kind: InteractableKind | 'decor';
  /** Footprint, also the collider. */
  box: Box;
  height: number;
}

export const FURNITURE: readonly FurnitureDefinition[] = [
  {
    id: 'stove',
    kind: 'stove',
    box: { minX: -5.7, maxX: -4.7, minZ: -4.85, maxZ: -4.05 },
    height: 0.9,
  },
  {
    id: 'kitchen-table',
    kind: 'decor',
    box: { minX: -3.2, maxX: -1.8, minZ: -3, maxZ: -2 },
    height: 0.75,
  },
  { id: 'bed', kind: 'bed', box: { minX: 3.4, maxX: 5.6, minZ: -4.85, maxZ: -2.45 }, height: 0.55 },
  {
    id: 'chest',
    kind: 'chest',
    box: { minX: -5.75, maxX: -4.85, minZ: 2.6, maxZ: 3.4 },
    height: 0.7,
  },
  {
    id: 'workbench',
    kind: 'workbench',
    box: { minX: 4.65, maxX: 5.8, minZ: 2.4, maxZ: 3.6 },
    height: 0.9,
  },
  {
    id: 'sofa',
    kind: 'decor',
    box: { minX: -1.4, maxX: 1.4, minZ: 0.45, maxZ: 1.25 },
    height: 0.8,
  },
];

/** Everything a player can't walk through. */
export const HOUSE_COLLIDERS: readonly Box[] = [...HOUSE_WALLS, ...FURNITURE.map((f) => f.box)];

export function boxCenter(b: Box): Point {
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
}

/** Distance from a point to the nearest edge of a box (0 inside). Interaction uses this. */
export function distanceToBox(p: Point, b: Box): number {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
  return Math.hypot(dx, dz);
}

export function findFurniture(id: string): FurnitureDefinition | undefined {
  return FURNITURE.find((f) => f.id === id);
}

/** Where each slot lies in the double bed, and where they stand up again. */
export const BED_SPOTS: readonly { sleep: Point; wake: Point }[] = [
  { sleep: { x: 4, z: -3.9 }, wake: { x: 2.9, z: -3.4 } },
  { sleep: { x: 5, z: -3.9 }, wake: { x: 2.9, z: -1.8 } },
];
