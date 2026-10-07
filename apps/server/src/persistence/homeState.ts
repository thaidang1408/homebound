import {
  StoveStatus,
  isItemId,
  levelForXp,
  type HomeState,
  type PlayerState,
} from '@homebound/shared';
import type { Slots } from '../inventory/inventory.js';
import { SAVE_VERSION, type HomeSave, type SavedPlayer, type SavedSlots } from './homeSaves.js';

/** Converts between live room state and save files. Pure: no I/O. */

export function toSavedSlots(slots: Slots): SavedSlots {
  return [...slots].map((s) =>
    s.qty > 0 && isItemId(s.itemId) ? { itemId: s.itemId, qty: s.qty } : null,
  );
}

export function applySlots(slots: Slots, saved: SavedSlots): void {
  slots.forEach((stack, i) => {
    const s = saved[i];
    stack.itemId = s?.itemId ?? '';
    stack.qty = s?.qty ?? 0;
  });
}

export function snapshotPlayer(p: PlayerState): SavedPlayer {
  return {
    name: p.name,
    hunger: p.hungerExact,
    xp: p.xp,
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    inventory: toSavedSlots(p.inventory),
  };
}

/** Restores a returning player. Position/name are only restored when given (spawn otherwise). */
export function applyPlayer(p: PlayerState, saved: SavedPlayer): void {
  p.hungerExact = saved.hunger;
  p.hunger = Math.ceil(saved.hunger);
  p.xp = saved.xp;
  p.level = levelForXp(saved.xp).level;
  p.x = saved.x;
  p.z = saved.z;
  p.yaw = saved.yaw;
  applySlots(p.inventory, saved.inventory);
}

export function buildSave(
  state: HomeState,
  code: string,
  createdAt: string,
  players: Record<string, SavedPlayer>,
): HomeSave {
  const { stove } = state;
  return {
    version: SAVE_VERSION,
    code,
    createdAt,
    updatedAt: new Date().toISOString(),
    day: state.day,
    chest: toSavedSlots(state.chest),
    stove: {
      status: stove.status,
      itemId: stove.itemId,
      elapsedMs: stove.elapsedMs,
      cookedBy: stove.cookedBy,
    },
    players,
  };
}

/** Loads the shared (non-player) parts of a save into a fresh room state. */
export function applyHome(state: HomeState, save: HomeSave): void {
  state.day = save.day;
  applySlots(state.chest, save.chest);
  const { stove } = state;
  const hasFood = save.stove.itemId !== '';
  stove.status = hasFood ? save.stove.status : StoveStatus.Idle;
  stove.itemId = save.stove.itemId;
  stove.elapsedMs = hasFood ? save.stove.elapsedMs : 0;
  stove.cookedBy = save.stove.cookedBy;
}
