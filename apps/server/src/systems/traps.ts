import {
  MAX_TRAPS,
  SPIKE_TRAP_DAMAGE,
  TRAP_PLACE_DISTANCE,
  TRAP_RADIUS,
  TrapState,
  WORLD_COLLIDERS,
  WORLD_RADIUS,
  ZONES,
  collides,
  getItem,
  type HomeState,
  type ItemId,
  type PlayerState,
  type Point,
} from '@homebound/shared';
import { addItem, itemAt, spaceFor, takeOne } from '../inventory/inventory.js';
import { damageCreature, creaturesWithin, snareCreature, type HitOutcome } from './creatures.js';

const TRAP_ITEM: Record<string, ItemId> = { snare: 'snare', spike: 'spike_trap' };

/** Where a trap set by this player would land: on the ground a step ahead. */
export function trapSpot(player: PlayerState): Point {
  return {
    x: player.x - Math.sin(player.yaw) * TRAP_PLACE_DISTANCE,
    z: player.z - Math.cos(player.yaw) * TRAP_PLACE_DISTANCE,
  };
}

export type PlaceOutcome = 'placed' | 'not-a-trap' | 'too-many' | 'in-the-yard' | 'blocked';

/** Sets the trap held in `slot` ahead of the player. Creatures never enter the yard, so not there. */
export function placeTrap(
  state: HomeState,
  player: PlayerState,
  slot: number,
  ownerId: string,
  id: string,
): PlaceOutcome {
  const itemId = itemAt(player.inventory, slot);
  const kind = itemId ? getItem(itemId).trap : undefined;
  if (!kind) return 'not-a-trap';
  if (state.traps.size >= MAX_TRAPS) return 'too-many';
  const at = trapSpot(player);
  if (Math.hypot(at.x, at.z) < ZONES.yard.radius) return 'in-the-yard';
  if (Math.hypot(at.x, at.z) > WORLD_RADIUS - 1 || collides(at, TRAP_RADIUS, WORLD_COLLIDERS)) {
    return 'blocked';
  }
  takeOne(player.inventory, slot);
  const trap = new TrapState();
  trap.kind = kind;
  trap.x = at.x;
  trap.z = at.z;
  trap.owner = ownerId;
  state.traps.set(id, trap);
  return 'placed';
}

/** [E] on a trap: back into the backpack (sprung or not), ready to set again. */
export function pickUpTrap(state: HomeState, trapId: string, player: PlayerState): boolean {
  const trap = state.traps.get(trapId);
  const itemId = trap ? TRAP_ITEM[trap.kind] : undefined;
  if (!trap || !itemId || spaceFor(player.inventory, itemId) < 1) return false;
  addItem(player.inventory, itemId, 1);
  state.traps.delete(trapId);
  return true;
}

export interface TrapEvent {
  trapId: string;
  creatureId: string;
  /** Owner's playerId: gets the credit. */
  owner: string;
  outcome: HitOutcome;
}

/**
 * Armed traps go off under a creature: a snare catches what it can hold (rabbits), a spike trap
 * hurts anything once. Players never trigger them. `sessionOf` maps the owner to who the hurt
 * creature turns on ('' when they're offline).
 */
export function tickTraps(state: HomeState, sessionOf: (playerId: string) => string): TrapEvent[] {
  const events: TrapEvent[] = [];
  for (const [trapId, trap] of state.traps) {
    if (trap.sprung) continue;
    for (const creatureId of creaturesWithin(state, trap, TRAP_RADIUS)) {
      let outcome: HitOutcome = 'invalid';
      if (trap.kind === 'snare') {
        if (snareCreature(state, creatureId)) outcome = 'killed';
      } else {
        outcome = damageCreature(state, creatureId, sessionOf(trap.owner), trap, SPIKE_TRAP_DAMAGE);
      }
      if (outcome === 'invalid') continue; // a snare doesn't hold a boar: it walks on
      trap.sprung = true;
      events.push({ trapId, creatureId, owner: trap.owner, outcome });
      break;
    }
  }
  return events;
}
