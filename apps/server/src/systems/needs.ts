import {
  HEALTH_MAX,
  HEALTH_REGEN_PER_SECOND,
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

export function setHealth(player: PlayerState, value: number): void {
  player.healthExact = Math.max(0, Math.min(HEALTH_MAX, value));
  player.health = Math.ceil(player.healthExact);
}

/** Returns true if this blow took the player's last health. */
export function hurtPlayer(player: PlayerState, damage: number): boolean {
  if (player.health === 0) return false;
  setHealth(player, player.healthExact - damage);
  return player.health === 0;
}

/**
 * Hunger drains over time, paused while asleep. Health slowly regenerates while fed.
 * Starving has no penalty until Phase 5.
 */
export function tickNeeds(state: HomeState, dtSeconds: number): void {
  for (const player of state.players.values()) {
    if (player.hungerExact > 0 && player.health > 0) {
      setHealth(player, player.healthExact + HEALTH_REGEN_PER_SECOND * dtSeconds);
    }
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
