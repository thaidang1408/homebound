import { WORLD_RADIUS } from '../constants.js';

/** Inside this radius the ground is perfectly flat (house, yard). */
const FLAT_RADIUS = 13;
/** Rolling hills start blending in over this distance. */
const BLEND = 10;
/** The rim of the world rises into hills that frame the playable area. */
const RIM_START = WORLD_RADIUS - 8;
const RIM_HEIGHT = 7;
const HILL_HEIGHT = 1.2;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Ground height in metres. Pure and cheap (a few sines, no noise library) so client and server
 * agree and it can run per vertex. The yard is flat; the rim rises.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hills =
    Math.sin(x * 0.11) * Math.cos(z * 0.09) +
    0.5 * Math.sin(x * 0.23 + 1.3) * Math.sin(z * 0.19 + 0.7);
  const rolling = HILL_HEIGHT * hills * smoothstep(FLAT_RADIUS, FLAT_RADIUS + BLEND, r);
  const rim = RIM_HEIGHT * smoothstep(RIM_START, WORLD_RADIUS + 4, r);
  return rolling + rim;
}
