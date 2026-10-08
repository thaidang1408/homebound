import { HOME_RADIUS, WORLD_RADIUS } from '../constants.js';
import { createRandom } from '../random.js';
import { BIOMES, biomeAt, inLake } from './biomes.js';
import type { Box, Point } from './collision.js';
import { LANDMARKS, WAYSTONES } from './landmarks.js';
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
  /** Deep woods behind the house, where wolves den (spawning only; trees are generated as usual). */
  forest: { center: { x: 0, z: -38 }, radius: 12 },
  /** North-west deep woods: the bear's den (spawning only, like the forest). */
  den: { center: { x: -30, z: -30 }, radius: 7 },
  /** North-east rocks where a baby dragon suns itself (spawning only). */
  crag: { center: { x: 34, z: -34 }, radius: 7 },
  /** A quiet south-west hollow where something small and green landed (spawning only). */
  hollow: { center: { x: -36, z: 30 }, radius: 7 },
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

const CAPS: Record<ResourceKind, number> = { tree: 110, rock: 26, bush: 24, mushroom: 0, nest: 0 };
const MIN_SPACING = 2.4;
const INNER = ZONES.yard.radius;
/** The home valley's generation is fixed: it ignored the wilds when they were added (Phase 12). */
const OUTER = HOME_RADIUS - 4;

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
  const counts: Record<ResourceKind, number> = { tree: 0, rock: 0, bush: 0, mushroom: 0, nest: 0 };

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

/** Mushroom patches under the northern trees. A separate seed, so trees and rocks stay put. */
const MUSHROOM_SEED = WORLD_SEED + 1;
const MUSHROOM_COUNT = 14;
function generateMushrooms(existing: ResourceNodeDefinition[]): ResourceNodeDefinition[] {
  const random = createRandom(MUSHROOM_SEED);
  const out: ResourceNodeDefinition[] = [];
  const def = RESOURCE_KINDS.mushroom;
  for (let attempt = 0; attempt < 2000 && out.length < MUSHROOM_COUNT; attempt++) {
    const angle = Math.PI + random() * Math.PI; // the northern half (−Z)
    const r = INNER + 6 + random() * (OUTER - INNER - 8);
    const p = { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
    if ([...existing, ...out].some((n) => Math.hypot(n.x - p.x, n.z - p.z) < MIN_SPACING)) continue;
    out.push({
      id: `mushroom-${out.length}`,
      kind: 'mushroom',
      x: p.x,
      z: p.z,
      scale: 0.85 + random() * 0.3,
      rotation: random() * Math.PI * 2,
      reach: square(p, def.reachHalf),
      collider: null,
    });
  }
  return out;
}

/**
 * Egg nests (Phase 11): one near each far corner, nudged outward from its anchor until it's clear
 * of other nodes. Placed after everything else, so nothing that was there before moves.
 */
const NEST_ANCHORS: readonly Point[] = [
  { x: 28, z: -28 },
  { x: -26, z: 34 },
  { x: 14, z: 46 },
  { x: -40, z: -14 },
];
const NEST_CLEARANCE = 2;
function generateNests(existing: ResourceNodeDefinition[]): ResourceNodeDefinition[] {
  const def = RESOURCE_KINDS.nest;
  return NEST_ANCHORS.map((anchor, i) => {
    let p = anchor;
    for (let step = 0; step < 40; step++) {
      const a = step * 2.4; // golden-angle-ish spiral around the anchor
      const r = step * 0.5;
      p = { x: anchor.x + Math.cos(a) * r, z: anchor.z + Math.sin(a) * r };
      if (!existing.some((n) => Math.hypot(n.x - p.x, n.z - p.z) < NEST_CLEARANCE)) break;
    }
    return {
      id: `nest-${i}`,
      kind: 'nest',
      x: p.x,
      z: p.z,
      scale: 1,
      rotation: i * 1.3,
      reach: square(p, def.reachHalf),
      collider: null,
    };
  });
}

/**
 * Trails from the ridge's four passes to the landmarks: kept clear of trees and drawn on the
 * ground, so the way out is easy to find.
 */
export const TRAILS: readonly (readonly [Point, Point])[] = [
  [{ x: 0, z: -HOME_RADIUS + 2 }, LANDMARKS[0]?.waystone ?? { x: 0, z: -76 }],
  [{ x: HOME_RADIUS - 2, z: 0 }, LANDMARKS[1]?.waystone ?? { x: 75, z: 4 }],
  [{ x: 0, z: ROAD.toZ }, LANDMARKS[2]?.waystone ?? { x: 9, z: 63 }],
  [{ x: -HOME_RADIUS + 2, z: 0 }, LANDMARKS[3]?.waystone ?? { x: -73, z: -6 }],
];
export const TRAIL_HALF_WIDTH = 1.2;

/** Distance from a point to a segment. */
function toSegment(p: Point, [a, b]: readonly [Point, Point]): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

export const trailDistance = (p: Point) => Math.min(...TRAILS.map((s) => toSegment(p, s)));

/** Keep this clear around landmarks and waystones. */
const LANDMARK_CLEARANCE = 7;
const WAYSTONE_CLEARANCE = 2.5;
const WILDS_SEED = WORLD_SEED + 2;
const WILD_CAPS: Record<ResourceKind, number> = {
  tree: 300,
  rock: 70,
  bush: 50,
  mushroom: 16,
  nest: 0,
};
/** Mushrooms only grow in the Deep Forest's shade. */
const FOREST_MUSHROOMS = 0.04;

/**
 * The wilds past the ridge (Phase 12): one more pass with its own seed, each biome as thick as
 * its definition says. Ids continue after the valley's, so nothing that existed changes.
 */
function generateWilds(existing: ResourceNodeDefinition[]): ResourceNodeDefinition[] {
  const random = createRandom(WILDS_SEED);
  const out: ResourceNodeDefinition[] = [];
  const counts: Record<ResourceKind, number> = { tree: 0, rock: 0, bush: 0, mushroom: 0, nest: 0 };
  const next: Record<ResourceKind, number> = { tree: 0, rock: 0, bush: 0, mushroom: 0, nest: 0 };
  for (const n of existing) next[n.kind] += 1;
  const inner = HOME_RADIUS + 2;
  const outer = WORLD_RADIUS - 5;
  for (let attempt = 0; attempt < 9000; attempt++) {
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(inner ** 2 + random() * (outer ** 2 - inner ** 2));
    const p = { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
    const roll = random();
    const scale = 0.85 + random() * 0.5;
    const rotation = random() * Math.PI * 2;
    const biome = BIOMES[biomeAt(p.x, p.z)];
    let kind: ResourceKind | null =
      roll < biome.trees
        ? 'tree'
        : roll < biome.trees + biome.rocks
          ? 'rock'
          : roll < biome.trees + biome.rocks + biome.bushes
            ? 'bush'
            : null;
    if (!kind && biomeAt(p.x, p.z) === 'forest' && roll > 1 - FOREST_MUSHROOMS) kind = 'mushroom';
    if (!kind || counts[kind] >= WILD_CAPS[kind] || inLake(p)) continue;
    if (trailDistance(p) < TRAIL_HALF_WIDTH + 1.4) continue;
    if (LANDMARKS.some((l) => Math.hypot(l.x - p.x, l.z - p.z) < LANDMARK_CLEARANCE)) continue;
    if (WAYSTONES.some((w) => Math.hypot(w.at.x - p.x, w.at.z - p.z) < WAYSTONE_CLEARANCE))
      continue;
    if ([...existing, ...out].some((n) => Math.hypot(n.x - p.x, n.z - p.z) < MIN_SPACING)) continue;
    const def = RESOURCE_KINDS[kind];
    out.push({
      id: `${kind}-${next[kind]}`,
      kind,
      x: p.x,
      z: p.z,
      scale,
      rotation,
      reach: square(p, def.reachHalf * scale),
      collider: def.colliderHalf > 0 ? square(p, def.colliderHalf * scale) : null,
    });
    counts[kind] += 1;
    next[kind] += 1;
  }
  return out;
}

const MAIN_NODES = generate();
const WITH_MUSHROOMS = [...MAIN_NODES, ...generateMushrooms(MAIN_NODES)];
const VALLEY = [...WITH_MUSHROOMS, ...generateNests(WITH_MUSHROOMS)];
export const RESOURCE_NODES: readonly ResourceNodeDefinition[] = [
  ...VALLEY,
  ...generateWilds(VALLEY),
];

const nodesById = new Map(RESOURCE_NODES.map((n) => [n.id, n]));

export function findResourceNode(id: string): ResourceNodeDefinition | undefined {
  return nodesById.get(id);
}
