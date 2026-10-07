import {
  HUNGER_DECAY_PER_SECOND,
  HUNGER_MAX,
  getItem,
  type HomeState,
  type PlayerState,
} from '@homebound/shared';
import { itemAt, takeOne } from '../inventory/inventory.js';

function setHunger(player: PlayerState, value: number): void {
  player.hungerExact = Math.max(0, Math.min(HUNGER_MAX, value));
  player.hunger = Math.ceil(player.hungerExact);
}

/** Hunger drains over time, paused while asleep. Starving has no penalty until Phase 5. */
export function tickNeeds(state: HomeState, dtSeconds: number): void {
  for (const player of state.players.values()) {
    if (player.sleeping) continue;
    setHunger(player, player.hungerExact - HUNGER_DECAY_PER_SECOND * dtSeconds);
  }
}

/** Eats one item from an inventory slot. Returns false if the slot isn't edible food. */
export function eatFromSlot(player: PlayerState, slot: number): boolean {
  const id = itemAt(player.inventory, slot);
  const hunger = id ? getItem(id).hunger : undefined;
  if (hunger === undefined) return false;
  takeOne(player.inventory, slot);
  setHunger(player, player.hungerExact + hunger);
  return true;
}
