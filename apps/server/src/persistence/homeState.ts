import {
  DropState,
  GoalState,
  HATCH_MS,
  MarkerState,
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
import { fitBackpack } from '../inventory/equipment.js';
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
    equipment: toSavedSlots(p.equipment),
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
  applySlots(p.equipment, saved.equipment);
  fitBackpack(p); // a bag on your back: more slots
  applySlots(p.inventory, saved.inventory);
}

export function buildSave(
  state: HomeState,
  code: string,
  createdAt: string,
  players: Record<string, SavedPlayer>,
): HomeSave {
  return {
    version: SAVE_VERSION,
    code,
    createdAt,
    updatedAt: new Date().toISOString(),
    day: state.day,
    timeOfDay: state.timeOfDay,
    chest: toSavedSlots(state.chest),
    pans: [...state.pans].map((p) => ({
      status: p.status,
      itemId: p.itemId,
      elapsedMs: p.elapsedMs,
      cookedBy: p.cookedBy,
    })),
    drops: Object.fromEntries(
      [...state.drops.entries()].flatMap(([id, d]) =>
        isItemId(d.itemId) ? [[id, { itemId: d.itemId, qty: d.qty, x: d.x, z: d.z }]] : [],
      ),
    ),
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
    explored: [...state.explored.keys()].map(Number),
    discovered: [...state.discovered.keys()],
    caches: [...state.caches.keys()],
    markers: [...state.markers.values()].map((m) => ({ x: m.x, z: m.z })),
    quest: { chapter: state.quest.chapter, step: state.quest.step, progress: state.quest.progress },
    lanterns: [...state.lanterns.keys()],
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
  // Call after createPans().
  state.pans.forEach((pan, i) => {
    const saved = save.pans[i];
    const hasFood = !!saved?.itemId;
    pan.status = hasFood ? saved.status : StoveStatus.Idle;
    pan.itemId = saved?.itemId ?? '';
    pan.elapsedMs = hasFood ? saved.elapsedMs : 0;
    pan.cookedBy = saved?.cookedBy ?? '';
  });
  state.drops.clear();
  for (const [id, saved] of Object.entries(save.drops)) {
    const drop = new DropState();
    Object.assign(drop, saved);
    state.drops.set(id, drop);
  }
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
  state.explored.clear();
  for (const i of save.explored) state.explored.set(String(i), true);
  state.discovered.clear();
  for (const id of save.discovered) state.discovered.set(id, true);
  state.caches.clear();
  for (const id of save.caches) state.caches.set(id, true);
  Object.assign(state.quest, save.quest);
  state.lanterns.clear();
  for (const id of save.lanterns) state.lanterns.set(id, true);
  state.markers.clear();
  save.markers.forEach((m, i) => {
    const marker = new MarkerState();
    Object.assign(marker, m);
    state.markers.set(`mark-${i}`, marker); // re-keyed in order: new ids continue at the size
  });
}
