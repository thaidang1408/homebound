import {
  COOK_TIME_MS,
  STOVE_PANS,
  StoveState,
  StoveStatus,
  cookResult,
  isItemId,
  stoveFood,
  type HomeState,
  type ItemId,
  type PlayerState,
} from '@homebound/shared';
import { addItem, countItem, removeItem } from '../inventory/inventory.js';

export type StoveOutcome = 'started' | 'collected' | 'busy' | 'nothing-to-cook' | 'inventory-full';

export function createPans(state: HomeState): void {
  state.pans.clear();
  for (let i = 0; i < STOVE_PANS; i++) state.pans.push(new StoveState());
}

function clearPan(pan: StoveState): void {
  pan.status = StoveStatus.Idle;
  pan.itemId = '';
  pan.progress = 0;
  pan.elapsedMs = 0;
}

/**
 * One button (ADR-027): anything done → take it all; else fill every free pan with the food you
 * hold (or raw meat), one each. Either player can collect what the other cooked.
 */
export function useStove(state: HomeState, player: PlayerState, playerId: string): StoveOutcome {
  const done = state.pans.filter((p) => p.status === StoveStatus.Done);
  if (done.length > 0) {
    let took = 0;
    for (const pan of done) {
      if (!isItemId(pan.itemId) || addItem(player.inventory, pan.itemId, 1) > 0) continue;
      clearPan(pan);
      took++;
    }
    return took > 0 ? 'collected' : 'inventory-full';
  }
  const free = state.pans.filter((p) => p.status === StoveStatus.Idle);
  if (free.length === 0) return 'busy';
  const food = stoveFood(player);
  if (!food) return 'nothing-to-cook';
  const n = Math.min(free.length, countItem(player.inventory, food));
  removeItem(player.inventory, food, n);
  for (const pan of free.slice(0, n)) {
    pan.status = StoveStatus.Cooking;
    pan.itemId = food;
    pan.progress = 0;
    pan.elapsedMs = 0;
    pan.cookedBy = playerId;
  }
  return 'started';
}

/** Advances cooking. Returns the cook's playerId for every pan that finished this tick. */
export function tickStove(state: HomeState, dtMs: number): string[] {
  const finished: string[] = [];
  for (const pan of state.pans) {
    if (pan.status !== StoveStatus.Cooking || !isItemId(pan.itemId)) continue;
    pan.elapsedMs += dtMs;
    pan.progress = Math.min(1, pan.elapsedMs / COOK_TIME_MS);
    if (pan.elapsedMs < COOK_TIME_MS) continue;
    const cooked: ItemId = cookResult(pan.itemId) ?? pan.itemId;
    pan.itemId = cooked;
    pan.status = StoveStatus.Done;
    if (pan.cookedBy) finished.push(pan.cookedBy);
  }
  return finished;
}
