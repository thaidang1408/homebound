import type { Room } from '@colyseus/sdk';
import {
  CREATURES,
  CreatureMode,
  INTERACT_RANGE,
  INTERACTABLES,
  PET_RADIUS,
  isPetKind,
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
    if (!dead && isPetKind(c.kind)) return; // wild pets are befriended, not fought
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

/** The nearest thing on the ground (a trap, a dropped bag) in front of the player, within reach. */
export function findOnGround(
  things: { forEach(cb: (t: { x: number; z: number }, id: string) => void): void },
  x: number,
  z: number,
  yaw: number,
): string | null {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  let best: string | null = null;
  let bestDistance = Infinity;
  things.forEach((t, id) => {
    const toX = t.x - x;
    const toZ = t.z - z;
    const d = Math.hypot(toX, toZ) || 1;
    if (d > INTERACT_RANGE || d >= bestDistance) return;
    if (d > ALWAYS_FOCUS_DISTANCE && (toX * lookX + toZ * lookZ) / d < FACING_COS) return;
    best = id;
    bestDistance = d;
  });
  return best;
}

/**
 * The nearest pet in front of the player within reach: a player's pet or egg (`pets`), or a wild
 * one among the creatures. Pets are small and move, so the look cone is generous.
 */
export function findPet(room: Room<HomeState>, x: number, z: number, yaw: number): string | null {
  const lookX = -Math.sin(yaw);
  const lookZ = -Math.cos(yaw);
  let best: string | null = null;
  let bestDistance = Infinity;
  const consider = (id: string, px: number, pz: number, radius: number) => {
    const toX = px - x;
    const toZ = pz - z;
    const centre = Math.hypot(toX, toZ) || 1;
    const edge = centre - radius;
    if (edge > INTERACT_RANGE || edge >= bestDistance) return;
    if (edge > ALWAYS_FOCUS_DISTANCE && (toX * lookX + toZ * lookZ) / centre < FACING_COS) return;
    best = id;
    bestDistance = edge;
  };
  room.state.pets.forEach((p, id) => consider(id, p.x, p.z, PET_RADIUS));
  room.state.creatures.forEach((c, id) => {
    if (c.present && isPetKind(c.kind)) consider(id, c.x, c.z, CREATURES[c.kind].radius);
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
