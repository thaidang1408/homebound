import {
  DropState,
  MAX_DROPS,
  DROP_DISTANCE,
  WORLD_COLLIDERS,
  clampToWorld,
  collides,
  isItemId,
  type HomeState,
  type PlayerState,
} from '@homebound/shared';
import { addItem } from '../inventory/inventory.js';

/** A bag's footprint (for walls when it lands). */
const DROP_RADIUS = 0.2; // m

export type DropOutcome = 'dropped' | 'empty' | 'too-many';

/** Drops the whole stack in backpack slot `slot` a step ahead (at your feet if a wall is there). */
export function dropItem(
  state: HomeState,
  player: PlayerState,
  slot: number,
  id: string,
): DropOutcome {
  const stack = player.inventory.at(slot);
  if (!stack || stack.qty === 0 || !isItemId(stack.itemId)) return 'empty';
  if (state.drops.size >= MAX_DROPS) return 'too-many';
  const ahead = clampToWorld(
    player.x - Math.sin(player.yaw) * DROP_DISTANCE,
    player.z - Math.cos(player.yaw) * DROP_DISTANCE,
  );
  const at = collides(ahead, DROP_RADIUS, WORLD_COLLIDERS) ? player : ahead;
  const drop = new DropState();
  drop.itemId = stack.itemId;
  drop.qty = stack.qty;
  drop.x = at.x;
  drop.z = at.z;
  state.drops.set(id, drop);
  stack.itemId = '';
  stack.qty = 0;
  return 'dropped';
}

/** [E] on a bag: as much as fits goes into the backpack; the rest stays on the ground. */
export function pickUpDrop(state: HomeState, dropId: string, player: PlayerState): number {
  const drop = state.drops.get(dropId);
  if (!drop || !isItemId(drop.itemId)) return 0;
  const left = addItem(player.inventory, drop.itemId, drop.qty);
  const taken = drop.qty - left;
  if (left === 0) state.drops.delete(dropId);
  else drop.qty = left;
  return taken;
}
