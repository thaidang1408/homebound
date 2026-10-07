import {
  COOK_TIME_MS,
  StoveStatus,
  cookResult,
  isItemId,
  type HomeState,
  type ItemId,
  type PlayerState,
} from '@homebound/shared';
import { addItem, itemAt, takeOne } from '../inventory/inventory.js';

export type StoveOutcome = 'started' | 'collected' | 'busy' | 'nothing-to-cook' | 'inventory-full';

/** First inventory slot holding something cookable. Hotbar first, so it's predictable. */
function findCookable(player: PlayerState): number {
  for (let i = 0; i < player.inventory.length; i++) {
    const id = itemAt(player.inventory, i);
    if (id && cookResult(id)) return i;
  }
  return -1;
}

/**
 * One button: idle + cookable item → put it on the pan; done → take the result.
 * Either player can collect what the other cooked.
 */
export function useStove(state: HomeState, player: PlayerState, playerId: string): StoveOutcome {
  const stove = state.stove;

  if (stove.status === StoveStatus.Done) {
    if (!isItemId(stove.itemId)) return 'busy';
    if (addItem(player.inventory, stove.itemId, 1) > 0) return 'inventory-full';
    stove.status = StoveStatus.Idle;
    stove.itemId = '';
    stove.progress = 0;
    return 'collected';
  }
  if (stove.status === StoveStatus.Cooking) return 'busy';

  const slot = findCookable(player);
  const raw = slot >= 0 ? takeOne(player.inventory, slot) : null;
  if (!raw) return 'nothing-to-cook';
  stove.status = StoveStatus.Cooking;
  stove.itemId = raw;
  stove.progress = 0;
  stove.elapsedMs = 0;
  stove.cookedBy = playerId;
  return 'started';
}

/** Advances cooking. Returns the cook's playerId on the tick the food finishes, else null. */
export function tickStove(state: HomeState, dtMs: number): string | null {
  const stove = state.stove;
  if (stove.status !== StoveStatus.Cooking || !isItemId(stove.itemId)) return null;
  stove.elapsedMs += dtMs;
  stove.progress = Math.min(1, stove.elapsedMs / COOK_TIME_MS);
  if (stove.elapsedMs < COOK_TIME_MS) return null;
  const cooked: ItemId = cookResult(stove.itemId) ?? stove.itemId;
  stove.itemId = cooked;
  stove.status = StoveStatus.Done;
  return stove.cookedBy || null;
}
