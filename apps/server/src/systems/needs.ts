import {
  BUFFS,
  HEALTH_MAX,
  HEALTH_REGEN_PER_SECOND,
  HUNGER_DECAY_PER_SECOND,
  STARVING_DAMAGE_PER_SECOND,
  HUNGER_MAX,
  getItem,
  isBuffId,
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
 * Hunger drains over time (paused while asleep or downed). Fed players slowly heal; starving ones
 * slowly lose health. Returns the sessionIds whose health just reached 0.
 */
export function tickNeeds(state: HomeState, dtSeconds: number): string[] {
  const fell: string[] = [];
  for (const [id, player] of state.players) {
    tickBuff(player, dtSeconds * 1000);
    if (player.downed) continue;
    if (player.hungerExact > 0) {
      const buff = isBuffId(player.buff) ? BUFFS[player.buff] : undefined;
      const regen = buff && 'regen' in buff ? buff.regen : 1;
      setHealth(player, player.healthExact + HEALTH_REGEN_PER_SECOND * regen * dtSeconds);
    } else if (hurtPlayer(player, STARVING_DAMAGE_PER_SECOND * dtSeconds)) {
      fell.push(id);
    }
    if (player.sleeping) continue;
    setHunger(player, player.hungerExact - HUNGER_DECAY_PER_SECOND * dtSeconds);
  }
  return fell;
}

/** A food buff runs down in real time (asleep or not); `buffLeft` is what the HUD shows. */
function tickBuff(player: PlayerState, dtMs: number): void {
  if (!player.buff) return;
  player.buffMs = Math.max(0, player.buffMs - dtMs);
  player.buffLeft = Math.ceil(player.buffMs / 1000);
  if (player.buffMs === 0) player.buff = '';
}

/** Eats one item from an inventory slot. Returns false if the slot isn't edible food. */
export function eatFromSlot(player: PlayerState, slot: number): boolean {
  const id = itemAt(player.inventory, slot);
  const def = id ? getItem(id) : undefined;
  if (def?.hunger === undefined) return false;
  takeOne(player.inventory, slot);
  setHunger(player, player.hungerExact + def.hunger);
  // A dish with a buff replaces whatever buff you had.
  if (def.buff && isBuffId(def.buff)) {
    player.buff = def.buff;
    player.buffMs = BUFFS[def.buff].durationMs;
    player.buffLeft = Math.ceil(player.buffMs / 1000);
  }
  return true;
}
