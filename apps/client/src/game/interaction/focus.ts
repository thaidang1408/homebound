import type { Room } from '@colyseus/sdk';
import {
  INTERACT_RANGE,
  INTERACTABLES,
  boxCenter,
  distanceToBox,
  findResourceNode,
  type HomeState,
} from '@homebound/shared';

/** Within this distance you can use something even if you're not looking straight at it. */
const ALWAYS_FOCUS_DISTANCE = 0.5; // m
/** cos of the half-angle of the "looking at it" cone (≈ 55°). */
const FACING_COS = 0.57;

/** Depleted resource nodes can't be focused (nothing to harvest); furniture always can. */
export function isAvailable(room: Room<HomeState>, id: string): boolean {
  if (!findResourceNode(id)) return true;
  return (room.state.resources.get(id)?.charges ?? 0) > 0;
}

/**
 * The interactable the player is close to and facing, nearest first. Pure and allocation-light so
 * it can run every frame. yaw 0 looks toward −Z.
 */
export function findFocus(
  x: number,
  z: number,
  yaw: number,
  available: (id: string) => boolean,
): string | null {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const target of INTERACTABLES) {
    const distance = distanceToBox({ x, z }, target.box);
    if (distance > INTERACT_RANGE || distance >= bestDistance) continue;
    const c = boxCenter(target.box);
    const toX = c.x - x;
    const toZ = c.z - z;
    const len = Math.hypot(toX, toZ) || 1;
    const facing = (toX * lookX + toZ * lookZ) / len;
    if (distance > ALWAYS_FOCUS_DISTANCE && facing < FACING_COS) continue;
    if (!available(target.id)) continue;
    best = target.id;
    bestDistance = distance;
  }
  return best;
}
