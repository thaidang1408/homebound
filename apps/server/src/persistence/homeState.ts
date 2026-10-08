import {
  GoalState,
  HATCH_MS,
  PETS,
  PetState,
  RESOURCE_KINDS,
  StoveStatus,
  TrapState,
  findResourceNode,
  isItemId,
  isPetKind,
  levelForXp,
  type HomeState,
  type PlayerState,
} from '@homebound/shared';
import type { Slots } from '../inventory/inventory.js';
import { SAVE_VERSION, type HomeSave, type SavedPlayer, type SavedSlots } from './homeSaves.js';

/** Converts between live room state and save files. Pure: no I/O. */

function fullCharges(id: string): number {
  const node = findResourceNode(id);
  return node ? RESOURCE_KINDS[node.kind].charges : 0;
}

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
    health: Math.max(1, p.healthExact),
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
  p.healthExact = saved.health;
  p.health = Math.ceil(saved.health);
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
    timeOfDay: state.timeOfDay,
    chest: toSavedSlots(state.chest),
    stove: {
      status: stove.status,
      itemId: stove.itemId,
      elapsedMs: stove.elapsedMs,
      cookedBy: stove.cookedBy,
    },
    resources: Object.fromEntries(
      [...state.resources.entries()]
        .filter(([id, r]) => r.charges < fullCharges(id))
        .map(([id, r]) => [id, r.charges]),
    ),
    players,
    goals: [...state.goals].map((g) => ({ kind: g.kind, target: g.target, progress: g.progress })),
    today: {
      hunted: state.today.hunted,
      meals: state.today.meals,
      gathered: state.today.gathered,
      crafted: state.today.crafted,
      revives: state.today.revives,
    },
    traps: Object.fromEntries(
      [...state.traps.entries()].map(([id, t]) => [
        id,
        {
          kind: t.kind === 'spike' ? 'spike' : 'snare',
          x: t.x,
          z: t.z,
          sprung: t.sprung,
          owner: t.owner,
        },
      ]),
    ),
    pets: Object.fromEntries(
      [...state.pets.entries()].map(([id, p]) => [
        id,
        {
          kind: p.kind,
          name: p.name,
          owner: p.owner,
          order: p.order === 'stay' || p.order === 'home' ? p.order : 'follow',
          x: p.x,
          z: p.z,
          hatchMs: p.hatchMs,
        },
      ]),
    ),
  };
}

/** Loads the shared (non-player) parts of a save into a fresh room state. */
/** Call after initResources(): depleted nodes come back depleted (their regrow timer restarts). */
export function applyHome(state: HomeState, save: HomeSave): void {
  state.day = save.day;
  state.timeOfDay = save.timeOfDay;
  for (const [id, charges] of Object.entries(save.resources)) {
    const live = state.resources.get(id);
    const node = findResourceNode(id);
    if (!live || !node) continue;
    live.charges = charges;
    live.respawnMs = charges === 0 ? RESOURCE_KINDS[node.kind].respawnMs : 0;
  }
  applySlots(state.chest, save.chest);
  const { stove } = state;
  const hasFood = save.stove.itemId !== '';
  stove.status = hasFood ? save.stove.status : StoveStatus.Idle;
  stove.itemId = save.stove.itemId;
  stove.elapsedMs = hasFood ? save.stove.elapsedMs : 0;
  stove.cookedBy = save.stove.cookedBy;
  state.goals.clear();
  for (const saved of save.goals) {
    const g = new GoalState();
    g.kind = saved.kind;
    g.target = saved.target;
    g.progress = saved.progress;
    state.goals.push(g);
  }
  Object.assign(state.today, save.today);
  state.traps.clear();
  for (const [id, saved] of Object.entries(save.traps)) {
    const trap = new TrapState();
    Object.assign(trap, saved);
    state.traps.set(id, trap);
  }
  state.pets.clear();
  for (const [id, saved] of Object.entries(save.pets)) {
    const pet = new PetState();
    pet.kind = saved.kind;
    pet.owner = saved.owner;
    pet.order = saved.order;
    pet.x = saved.x;
    pet.z = saved.z;
    pet.hatchMs = saved.hatchMs;
    const kind = saved.kind;
    pet.hatch = isPetKind(kind) ? 1 : saved.hatchMs / HATCH_MS;
    pet.name = isPetKind(kind) ? saved.name || PETS[kind].name : '';
    state.pets.set(id, pet);
  }
}
