import type { Room } from '@colyseus/sdk';
import {
  CREATURES,
  CreatureMode,
  INTERACT_RANGE,
  INTERACTABLES,
  boxCenter,
  distanceToBox,
  findResourceNode,
  isCreatureKind,
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

/** Striking needs real aim (≈ 30° half-angle), unlike using furniture. */
const AIM_COS = 0.87;

/**
 * The nearest creature in front of the player whose body is within `range`: a live one to strike
 * (`dead` false) or a carcass to butcher (`dead` true). Positions are the synced server ones.
 */
export function findCreature(
  room: Room<HomeState>,
  x: number,
  z: number,
  yaw: number,
  range: number,
  dead: boolean,
): string | null {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  let best: string | null = null;
  let bestDistance = Infinity;
  room.state.creatures.forEach((c, id) => {
    if (!c.present || (c.mode === CreatureMode.Dead) !== dead || !isCreatureKind(c.kind)) return;
    const toX = c.x - x;
    const toZ = c.z - z;
    const centre = Math.hypot(toX, toZ) || 1;
    const edge = centre - CREATURES[c.kind].radius;
    if (edge > range || edge >= bestDistance) return;
    // Carcasses and bodies right in front of you fill the view: a rough look is enough.
    const facing = (toX * lookX + toZ * lookZ) / centre;
    if (facing < (dead || edge < ALWAYS_FOCUS_DISTANCE ? FACING_COS : AIM_COS)) return;
    best = id;
    bestDistance = edge;
  });
  return best;
}

/** A downed partner close enough to revive (no aiming needed: you kneel next to them). */
export function findDownedPartner(room: Room<HomeState>, x: number, z: number): string | null {
  let found: string | null = null;
  room.state.players.forEach((p, id) => {
    if (id === room.sessionId || !p.downed) return;
    if (Math.hypot(p.x - x, p.z - z) <= INTERACT_RANGE + ALWAYS_FOCUS_DISTANCE) found = id;
  });
  return found;
}
