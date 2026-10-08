import { HOME_RADIUS } from '../constants.js';
import type { Point } from './collision.js';

/**
 * Biomes (Phase 12, ADR-025). The home valley is the original world, unchanged; past the ridge
 * that rings it, four wilds by compass direction. Data only: colors, hills and how thickly things
 * grow. Both sides use `biomeAt`.
 */

export interface BiomeDefinition {
  name: string;
  /** Ground colors (vertex-colored terrain): base and darker facets. */
  ground: string;
  groundDark: string;
  /** Tints multiplied onto trees' leaves and rocks here. */
  leafTint: string;
  rockTint: string;
  /** Rolling hill height (m). */
  hills: number;
  /** Chance a spot gets a tree / rock / bush when the wilds are generated. */
  trees: number;
  rocks: number;
  bushes: number;
}

export const BIOMES = {
  valley: {
    name: 'Home valley',
    ground: '#6d9a4f',
    groundDark: '#4f7a3a',
    leafTint: '#ffffff',
    rockTint: '#ffffff',
    hills: 1.2,
    trees: 0,
    rocks: 0,
    bushes: 0,
  },
  forest: {
    name: 'Deep Forest',
    ground: '#4e7a43',
    groundDark: '#36592f',
    leafTint: '#8fb7a0',
    rockTint: '#d6dccf',
    hills: 1.6,
    trees: 0.7,
    rocks: 0.04,
    bushes: 0.08,
  },
  hills: {
    name: 'Rocky Hills',
    ground: '#8e9a62',
    groundDark: '#6f7a4b',
    leafTint: '#e8e2a8',
    rockTint: '#f2e6d0',
    hills: 4,
    trees: 0.1,
    rocks: 0.3,
    bushes: 0.08,
  },
  lake: {
    name: 'Misty Lake',
    ground: '#78a86a',
    groundDark: '#5b8c55',
    leafTint: '#c9f0e0',
    rockTint: '#e3eef2',
    hills: 0.8,
    trees: 0.18,
    rocks: 0.04,
    bushes: 0.16,
  },
  ruins: {
    name: 'Old Ruins',
    ground: '#8a9470',
    groundDark: '#6c7457',
    leafTint: '#d8c9a0',
    rockTint: '#d9d2c4',
    hills: 1.4,
    trees: 0.2,
    rocks: 0.14,
    bushes: 0.1,
  },
} as const satisfies Record<string, BiomeDefinition>;

export type BiomeId = keyof typeof BIOMES;

/** Past the home valley's ridge the wilds begin. */
export const WILDS_START = HOME_RADIUS + 6;

/** The lake in the south: a shallow bowl you can wade through. */
export const LAKE = { center: { x: 0, z: 84 }, radius: 13, depth: 1.1 } as const;

/** Which biome a point is in: the valley inside the ridge, else by compass direction. */
export function biomeAt(x: number, z: number): BiomeId {
  if (Math.hypot(x, z) < WILDS_START) return 'valley';
  // Bearing: 0 = north (−Z), clockwise toward east (+X).
  const bearing = Math.atan2(x, -z);
  const quarter = Math.PI / 4;
  if (Math.abs(bearing) < quarter) return 'forest';
  if (bearing >= quarter && bearing < 3 * quarter) return 'hills';
  if (bearing <= -quarter && bearing > -3 * quarter) return 'ruins';
  return 'lake';
}

export const inLake = (p: Point) =>
  Math.hypot(p.x - LAKE.center.x, p.z - LAKE.center.z) < LAKE.radius;
