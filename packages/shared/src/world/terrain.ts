import { HOME_RADIUS, WORLD_RADIUS } from '../constants.js';
import { BIOMES, LAKE, WILDS_START, type BiomeId } from './biomes.js';

/** Inside this radius the ground is perfectly flat (house, yard). */
const FLAT_RADIUS = 13;
/** Rolling hills start blending in over this distance. */
const BLEND = 10;
/** The ridge around the home valley: where it starts, peaks and ends, and how high it is. */
const RIDGE = { from: HOME_RADIUS - 8, peak: HOME_RADIUS + 1, to: HOME_RADIUS + 8, height: 6 };
/** Four low passes through the ridge (N, E, S, W), where the trails lead out. */
const PASS_HALF_WIDTH = 0.2; // radians
const PASS_DEPTH = 0.85; // share of the ridge removed
/** The rim of the world rises into hills that frame the playable area. */
const RIM_START = WORLD_RADIUS - 10;
const RIM_HEIGHT = 10;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The compass direction each wild biome is centred on (bearing, 0 = north). */
const WILD_BEARINGS: readonly [BiomeId, number][] = [
  ['forest', 0],
  ['hills', Math.PI / 2],
  ['lake', Math.PI],
  ['ruins', -Math.PI / 2],
];

/**
 * How much of each biome a point is (weights summing to 1): smooth across borders so hills and
 * ground colors never jump. The valley inside the ridge, the wilds by direction outside it.
 */
export function biomeMix(x: number, z: number): Record<BiomeId, number> {
  const r = Math.hypot(x, z);
  const wild = smoothstep(WILDS_START - 6, WILDS_START + 2, r);
  const bearing = Math.atan2(x, -z);
  const mix: Record<BiomeId, number> = { valley: 1 - wild, forest: 0, hills: 0, lake: 0, ruins: 0 };
  let total = 0;
  const weights = WILD_BEARINGS.map(([, b]) => Math.max(0, Math.cos(bearing - b)) ** 4);
  for (const w of weights) total += w;
  WILD_BEARINGS.forEach(([id], i) => {
    mix[id] = (wild * (weights[i] ?? 0)) / (total || 1);
  });
  return mix;
}

function ridge(x: number, z: number, r: number): number {
  const up = smoothstep(RIDGE.from, RIDGE.peak, r) * (1 - smoothstep(RIDGE.peak, RIDGE.to, r));
  // Angle to the nearest of the four passes (every quarter turn from north).
  const quarter = Math.PI / 2;
  const m = ((Math.atan2(x, -z) % quarter) + quarter) % quarter;
  const pass = 1 - smoothstep(0, PASS_HALF_WIDTH, Math.min(m, quarter - m));
  return RIDGE.height * up * (1 - PASS_DEPTH * pass);
}

/**
 * Ground height in metres. Pure and cheap (a few sines, no noise library) so client and server
 * agree and it can run per vertex. The yard is flat; a ridge rings the valley; the wilds roll as
 * hard as their biome says; the lake is a shallow bowl; the rim rises.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hills =
    Math.sin(x * 0.11) * Math.cos(z * 0.09) +
    0.5 * Math.sin(x * 0.23 + 1.3) * Math.sin(z * 0.19 + 0.7);
  const mix = biomeMix(x, z);
  let amplitude = 0;
  for (const id of Object.keys(mix) as BiomeId[]) amplitude += mix[id] * BIOMES[id].hills;
  const rolling = amplitude * hills * smoothstep(FLAT_RADIUS, FLAT_RADIUS + BLEND, r);
  const fromLake = Math.hypot(x - LAKE.center.x, z - LAKE.center.z);
  const lake = -LAKE.depth * (1 - smoothstep(LAKE.radius * 0.5, LAKE.radius + 3, fromLake));
  const rim = RIM_HEIGHT * smoothstep(RIM_START, WORLD_RADIUS + 2, r);
  // The lake shore is calm water-meadow: hills flatten toward it.
  const calm = 0.3 + 0.7 * smoothstep(LAKE.radius, LAKE.radius + 8, fromLake);
  return rolling * calm + ridge(x, z, r) + lake + rim;
}
