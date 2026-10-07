import { FURNITURE, INTERACT_RANGE, boxCenter, distanceToBox } from '@homebound/shared';

/** Within this distance you can use something even if you're not looking straight at it. */
const ALWAYS_FOCUS_DISTANCE = 0.5; // m
/** cos of the half-angle of the "looking at it" cone (≈ 55°). */
const FACING_COS = 0.57;

const INTERACTABLES = FURNITURE.filter((f) => f.kind !== 'decor');

/**
 * The furniture the player is close to and facing, nearest first. Pure and allocation-light so it
 * can run every frame. yaw 0 looks toward −Z.
 */
export function findFocus(x: number, z: number, yaw: number): string | null {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const f of INTERACTABLES) {
    const distance = distanceToBox({ x, z }, f.box);
    if (distance > INTERACT_RANGE || distance >= bestDistance) continue;
    const c = boxCenter(f.box);
    const toX = c.x - x;
    const toZ = c.z - z;
    const len = Math.hypot(toX, toZ) || 1;
    const facing = (toX * lookX + toZ * lookZ) / len;
    if (distance > ALWAYS_FOCUS_DISTANCE && facing < FACING_COS) continue;
    best = f.id;
    bestDistance = distance;
  }
  return best;
}
