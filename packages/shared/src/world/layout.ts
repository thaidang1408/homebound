import { WORLD_RADIUS } from '../constants.js';
import { createRandom } from '../random.js';
import type { Box, Point } from './collision.js';
import { RESOURCE_KINDS, type ResourceKind } from './resources.js';

/**
 * The outdoor world, generated from a fixed seed (identical on client and server):
 *
 *                 north: dense forest behind the house
 *   west: GROVE (rocks, berries)   HOUSE   east: MEADOW (open, hunting later)
 *                 south: the ROAD from the front door to a forest clearing
 */
export const WORLD_SEED = 20261007;

/** Named areas, also used later for creature spawns (Phase 4). */
export const ZONES = {
  yard: { center: { x: 0, z: 0 }, radius: 13 },
  grove: { center: { x: -30, z: 4 }, radius: 16 },
  meadow: { center: { x: 30, z: -2 }, radius: 15 },
  clearing: { center: { x: 0, z: 42 }, radius: 7 },
} as const satisfies Record<string, { center: Point; radius: number }>;

/** The dirt road from the front door south to the clearing. */
export const ROAD = { halfWidth: 1.4, fromZ: 5, toZ: ZONES.clearing.center.z } as const;

export interface ResourceNodeDefinition {
  id: string;
  kind: ResourceKind;
  x: number;
  z: number;
  /** Visual variety only (0.8–1.25). */
  scale: number;
  rotation: number;
  /** Interaction footprint. */
  reach: Box;
  /** Collision footprint, or null if you can walk through it. */
  collider: Box | null;
}

const CAPS: Record<ResourceKind, number> = { tree: 110, rock: 26, bush: 24 };
const MIN_SPACING = 2.4;
const INNER = ZONES.yard.radius;
const OUTER = WORLD_RADIUS - 4;

const inside = (p: Point, zone: { center: Point; radius: number }) =>
  Math.hypot(p.x - zone.center.x, p.z - zone.center.z) < zone.radius;

function onRoad(p: Point): boolean {
  return Math.abs(p.x) < ROAD.halfWidth + 1.6 && p.z > ROAD.fromZ - 1 && p.z < ROAD.toZ + 2;
}

function pickKind(p: Point, roll: number): ResourceKind | null {
  if (inside(p, ZONES.clearing)) return null;
  if (inside(p, ZONES.meadow)) return roll < 0.08 ? 'tree' : roll < 0.14 ? 'bush' : null;
  if (inside(p, ZONES.grove)) return roll < 0.35 ? 'rock' : roll < 0.7 ? 'bush' : 'tree';
  return roll < 0.86 ? 'tree' : roll < 0.94 ? 'bush' : 'rock';
}

function square(c: Point, half: number): Box {
  return { minX: c.x - half, maxX: c.x + half, minZ: c.z - half, maxZ: c.z + half };
}

function generate(): ResourceNodeDefinition[] {
  const random = createRandom(WORLD_SEED);
  const nodes: ResourceNodeDefinition[] = [];
  const counts: Record<ResourceKind, number> = { tree: 0, rock: 0, bush: 0 };

  for (let attempt = 0; attempt < 4000; attempt++) {
    // Uniform over the ring between the yard and the rim.
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(INNER ** 2 + random() * (OUTER ** 2 - INNER ** 2));
    const p = { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
    const kind = pickKind(p, random());
    const scale = 0.8 + random() * 0.45;
    const rotation = random() * Math.PI * 2;
    if (!kind || counts[kind] >= CAPS[kind] || onRoad(p)) continue;
    if (nodes.some((n) => Math.hypot(n.x - p.x, n.z - p.z) < MIN_SPACING)) continue;

    const def = RESOURCE_KINDS[kind];
    nodes.push({
      id: `${kind}-${counts[kind]}`,
      kind,
      x: p.x,
      z: p.z,
      scale,
      rotation,
      reach: square(p, def.reachHalf * scale),
      collider: def.colliderHalf > 0 ? square(p, def.colliderHalf * scale) : null,
    });
    counts[kind] += 1;
  }
  return nodes;
}

export const RESOURCE_NODES: readonly ResourceNodeDefinition[] = generate();

const nodesById = new Map(RESOURCE_NODES.map((n) => [n.id, n]));

export function findResourceNode(id: string): ResourceNodeDefinition | undefined {
  return nodesById.get(id);
}
