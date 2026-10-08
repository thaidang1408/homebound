import {
  CREATURES,
  CreatureMode,
  HATCH_MS,
  HEALTH_MAX,
  PETS,
  PETS_PER_PLAYER,
  PET_CATCH_UP_DISTANCE,
  PET_FOLLOW_DISTANCE,
  PET_GUARD_RADIUS,
  PET_KINDS,
  PET_RADIUS,
  PET_RUN_SPEED,
  PET_STUCK_MS,
  PET_WALK_SPEED,
  PetOrder,
  PetState,
  RESOURCE_NODES,
  WORLD_COLLIDERS,
  WORLD_RADIUS,
  ZONES,
  collides,
  dayPhase,
  getItem,
  isCreatureKind,
  isPetKind,
  resolveCircle,
  type CreatureDefinition,
  type CreatureState,
  type HomeState,
  type PetAction,
  type PetDefinition,
  type PetKind,
  type PlayerState,
  type Point,
} from '@homebound/shared';
import { itemAt, takeOne } from '../inventory/inventory.js';
import {
  butcherCreature,
  damageCreature,
  retireCreature,
  type HitOutcome,
  type Random,
} from './creatures.js';
import { harvest } from './harvest.js';
import { setHealth } from './needs.js';
import { trapSpot } from './traps.js';

/**
 * Pets (ADR-024): eggs hatch in the yard, wild pets are befriended with food, and every pet runs
 * one small loop: go where its order says (follow / stay / home), then use its ability
 * (fight, fetch, scout, heal, forage). Pets never get hurt.
 */

/** Where pets wait at home: the front yard, either side of the road. */
const HOME_SPOTS: readonly Point[] = [
  { x: -2.6, z: 7.5 },
  { x: 2.6, z: 7.5 },
  { x: -4.6, z: 9.5 },
  { x: 4.6, z: 9.5 },
];
/** Popping back to its owner: this far behind them. */
const BEHIND = 1.2;
/** Close enough to a carcass to butcher it. */
const FETCH_REACH = 0.9;
/** After a fetch or forage that couldn't fit in the backpack, wait before trying again. */
const RETRY_MS = 4000;
/** Heal sparkles every so often while healing. */
const HEAL_SHOW_MS = 2000;
/** Only these are foraged. */
const FORAGED = new Set(['bush', 'mushroom']);
/** Creatures in these modes are going after someone: fighters step in. */
const HUNTING: readonly string[] = [
  CreatureMode.Alert,
  CreatureMode.Chase,
  CreatureMode.Attack,
  CreatureMode.Hurt,
];

export function homeSpot(petId: string): Point {
  const n = Number(petId.slice('pet-'.length)) || 0;
  return HOME_SPOTS[n % HOME_SPOTS.length] ?? { x: 0, z: 8 };
}

/** Pets and eggs a player has. */
export function petsOf(state: HomeState, playerId: string): number {
  let n = 0;
  for (const pet of state.pets.values()) if (pet.owner === playerId) n++;
  return n;
}

export function petAct(pet: PetState, action: PetAction): void {
  pet.action = action;
  pet.actionSeq = (pet.actionSeq + 1) % 256;
}

function creatureDef(c: CreatureState): CreatureDefinition | undefined {
  return isCreatureKind(c.kind) ? CREATURES[c.kind] : undefined;
}

export type EggOutcome = 'placed' | 'not-an-egg' | 'too-many' | 'outside-the-yard' | 'blocked';

/** Sets the egg held in `slot` down a step ahead, somewhere in the yard (or the house) to hatch. */
export function placeEgg(
  state: HomeState,
  player: PlayerState,
  slot: number,
  ownerId: string,
  id: string,
): EggOutcome {
  const itemId = itemAt(player.inventory, slot);
  if (!itemId || !getItem(itemId).egg) return 'not-an-egg';
  if (petsOf(state, ownerId) >= PETS_PER_PLAYER) return 'too-many';
  const at = trapSpot(player);
  if (Math.hypot(at.x, at.z) > ZONES.yard.radius - PET_RADIUS) return 'outside-the-yard';
  if (collides(at, PET_RADIUS, WORLD_COLLIDERS)) return 'blocked';
  takeOne(player.inventory, slot);
  const egg = new PetState();
  egg.owner = ownerId;
  egg.x = at.x;
  egg.z = at.z;
  egg.yaw = player.yaw;
  state.pets.set(id, egg);
  return 'placed';
}

/** A surprise, but never a second one of a kind you already have. */
function hatchKind(state: HomeState, owner: string, random: Random): PetKind {
  const owned = new Set(
    [...state.pets.values()].filter((p) => p.owner === owner).map((p) => p.kind),
  );
  const fresh = PET_KINDS.filter((k) => !owned.has(k));
  const pool = fresh.length > 0 ? fresh : PET_KINDS;
  return pool[Math.floor(random() * pool.length)] ?? 'dragon';
}

function becomePet(pet: PetState, kind: PetKind): void {
  pet.kind = kind;
  pet.name = PETS[kind].name;
  pet.hatch = 1;
  pet.order = PetOrder.Follow;
}

export type BefriendOutcome = 'fed' | 'befriended' | 'wrong-food' | 'too-many' | 'invalid';

/**
 * [E] on a wild pet while holding its favorite food: it eats one from your hand. Fed `feeds` times
 * by the same player, it becomes their pet (`petId`) and leaves the wild.
 */
export function befriend(
  state: HomeState,
  creatureId: string,
  player: PlayerState,
  playerId: string,
  petId: string,
): BefriendOutcome {
  const c = state.creatures.get(creatureId);
  const kind = c ? creatureDef(c)?.tame : undefined;
  if (!c || !kind || !c.present || c.mode === CreatureMode.Flee) return 'invalid';
  if (petsOf(state, playerId) >= PETS_PER_PLAYER) return 'too-many';
  const def: PetDefinition = PETS[kind];
  if (itemAt(player.inventory, player.selectedSlot) !== def.food) return 'wrong-food';
  takeOne(player.inventory, player.selectedSlot);
  if (c.trustBy !== playerId) {
    c.trustBy = playerId; // someone else's feeding doesn't count toward yours
    c.trust = 0;
  }
  c.trust += 1;
  if (c.trust < def.feeds) return 'fed';

  const pet = new PetState();
  becomePet(pet, kind);
  pet.owner = playerId;
  pet.x = c.x;
  pet.z = c.z;
  pet.yaw = c.yaw;
  petAct(pet, 'pat');
  state.pets.set(petId, pet);
  retireCreature(state, creatureId);
  return 'befriended';
}

export type PetEvent =
  | { type: 'hatched'; petId: string }
  /** A fighter's blow; `owner` (playerId) gets the credit for a kill. */
  | { type: 'hit'; petId: string; owner: string; creatureId: string; outcome: HitOutcome };

export interface PetContext {
  /** The sessionId of a playerId in the home ('' when offline). */
  sessionOf(playerId: string): string;
  random: Random;
}

const face = (pet: PetState, to: Point) => {
  pet.yaw = Math.atan2(-(to.x - pet.x), -(to.z - pet.z));
};

function popTo(pet: PetState, owner: PlayerState): void {
  const spot = {
    x: owner.x + Math.sin(owner.yaw) * BEHIND,
    z: owner.z + Math.cos(owner.yaw) * BEHIND,
  };
  const free =
    !collides(spot, PET_RADIUS, WORLD_COLLIDERS) && Math.hypot(spot.x, spot.z) < WORLD_RADIUS;
  pet.x = free ? spot.x : owner.x;
  pet.z = free ? spot.z : owner.z;
  pet.stuckMs = 0;
}

/** Walks (or runs, when far) toward `goal`, stopping `stopAt` short. Returns true once there. */
function walkToward(pet: PetState, def: PetDefinition, goal: Point, stopAt: number, dtMs: number) {
  const dx = goal.x - pet.x;
  const dz = goal.z - pet.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopAt) {
    pet.stuckMs = 0;
    return true;
  }
  const speed = d > stopAt + 3 ? PET_RUN_SPEED : PET_WALK_SPEED;
  const step = Math.min((speed * dtMs) / 1000, d - stopAt);
  const next = { x: pet.x + (dx / d) * step, z: pet.z + (dz / d) * step };
  const free = def.ghostly ? next : resolveCircle(next, PET_RADIUS, WORLD_COLLIDERS);
  const moved = Math.hypot(free.x - pet.x, free.z - pet.z);
  pet.stuckMs = moved < step * 0.3 ? pet.stuckMs + dtMs : 0;
  face(pet, goal);
  pet.x = free.x;
  pet.z = free.z;
  return false;
}

/** The nearest creature matching `ok` within `range` of `from`. */
function nearestCreature(
  state: HomeState,
  from: Point,
  range: number,
  ok: (c: CreatureState, def: CreatureDefinition) => boolean,
): [string, CreatureState] | null {
  let best: [string, CreatureState] | null = null;
  let bestDistance = range;
  for (const [id, c] of state.creatures) {
    const def = creatureDef(c);
    if (!def || !c.present || !ok(c, def)) continue;
    const d = Math.hypot(c.x - from.x, c.z - from.z);
    if (d <= bestDistance) {
      best = [id, c];
      bestDistance = d;
    }
  }
  return best;
}

const alive = (c: CreatureState) => c.mode !== CreatureMode.Dead;

/** Advances every pet and egg by one server tick. */
export function tickPets(state: HomeState, dtMs: number, ctx: PetContext): PetEvent[] {
  const events: PetEvent[] = [];
  const night = dayPhase(state.timeOfDay) === 'night';
  for (const [id, pet] of state.pets) {
    pet.ownerSession = ctx.sessionOf(pet.owner);
    if (!isPetKind(pet.kind)) {
      pet.hatchMs = Math.min(HATCH_MS, pet.hatchMs + dtMs);
      pet.hatch = pet.hatchMs / HATCH_MS;
      if (pet.hatchMs >= HATCH_MS) {
        becomePet(pet, hatchKind(state, pet.owner, ctx.random));
        petAct(pet, 'hatch');
        events.push({ type: 'hatched', petId: id });
      }
      continue;
    }
    const def: PetDefinition = PETS[pet.kind];
    const owner = pet.ownerSession ? state.players.get(pet.ownerSession) : undefined;
    pet.cooldownMs = Math.max(0, pet.cooldownMs - dtMs);
    // An owner who's offline or in bed: the pet waits at home (and guards it at night).
    const order = !owner || !owner.connected || owner.sleeping ? PetOrder.Home : pet.order;
    const following = order === PetOrder.Follow && owner ? owner : null;

    // --- where to go ---
    let goal: Point | null = following ?? (order === PetOrder.Home ? homeSpot(id) : null);
    let stopAt = following ? PET_FOLLOW_DISTANCE : 0.2;
    let carcass = '';
    if (def.fetch && following && pet.cooldownMs === 0) {
      const found = nearestCreature(state, following, def.fetch.range, (c) => !alive(c));
      if (found) {
        [carcass] = found;
        goal = found[1];
        stopAt = FETCH_REACH;
      }
    }
    // Fighters at home at night go out to meet anything prowling around the yard.
    let prowler: [string, CreatureState] | null = null;
    if (def.fight && order === PetOrder.Home && night) {
      prowler = nearestCreature(
        state,
        { x: 0, z: 0 },
        PET_GUARD_RADIUS,
        (c, d) => d.temperament === 'hostile' && alive(c),
      );
      if (prowler) {
        goal = prowler[1];
        stopAt = def.fight.range * 0.8;
      }
    }

    if (goal) {
      const far = !!following && Math.hypot(goal.x - pet.x, goal.z - pet.z) > PET_CATCH_UP_DISTANCE;
      const arrived = !far && walkToward(pet, def, goal, stopAt, dtMs);
      if (following && (far || pet.stuckMs > PET_STUCK_MS)) popTo(pet, following);
      else if (!following && pet.stuckMs > PET_STUCK_MS && !prowler) {
        Object.assign(pet, { ...homeSpot(id), stuckMs: 0 });
      }
      if (arrived && following && !carcass) face(pet, following); // looks up at you
      if (arrived && carcass && following) {
        if (butcherCreature(state, carcass, following, ctx.random) === 'butchered') {
          petAct(pet, 'fetch');
        } else pet.cooldownMs = RETRY_MS; // backpack full
      }
    }

    // --- abilities ---
    if (def.fight && pet.cooldownMs === 0) {
      const { range, damage, cooldownMs } = def.fight;
      const foe = nearestCreature(
        state,
        pet,
        range,
        (c, d) =>
          d.temperament === 'hostile' &&
          alive(c) &&
          (HUNTING.includes(c.mode) || (order === PetOrder.Home && night)),
      );
      if (foe) {
        const [creatureId, c] = foe;
        face(pet, c);
        const outcome = damageCreature(state, creatureId, pet.ownerSession, pet, damage);
        petAct(pet, 'fire');
        pet.cooldownMs = cooldownMs;
        events.push({ type: 'hit', petId: id, owner: pet.owner, creatureId, outcome });
      }
    }
    if (def.scout) {
      const from = owner ?? pet;
      const prey = owner
        ? nearestCreature(state, from, def.scout.range, (c, d) => !d.tame && alive(c))
        : null;
      pet.mark = prey?.[0] ?? '';
    }
    if (def.heal) {
      let healed = false;
      for (const p of state.players.values()) {
        if (!p.connected || p.downed || p.healthExact >= HEALTH_MAX) continue;
        if (Math.hypot(p.x - pet.x, p.z - pet.z) > def.heal.range) continue;
        setHealth(p, p.healthExact + (def.heal.perSecond * dtMs) / 1000);
        healed = true;
      }
      if (healed && pet.cooldownMs === 0) {
        petAct(pet, 'heal');
        pet.cooldownMs = HEAL_SHOW_MS;
      }
    }
    if (def.forage && following && pet.cooldownMs === 0) {
      const { range, cooldownMs } = def.forage;
      const node = RESOURCE_NODES.find(
        (n) =>
          FORAGED.has(n.kind) &&
          (state.resources.get(n.id)?.charges ?? 0) > 0 &&
          Math.hypot(n.x - pet.x, n.z - pet.z) <= range,
      );
      // A tractor beam: no walking over, no harvest cooldown of its own.
      const got = node && harvest(state, following, node, 0, -Infinity) === 'harvested';
      if (got) petAct(pet, 'forage');
      pet.cooldownMs = got ? cooldownMs : RETRY_MS;
    }
  }
  return events;
}

/** An order from the owner. Returns false if it isn't theirs or isn't hatched. */
export function orderPet(
  state: HomeState,
  petId: string,
  playerId: string,
  order: PetOrder,
): boolean {
  const pet = state.pets.get(petId);
  if (!pet || pet.owner !== playerId || !isPetKind(pet.kind)) return false;
  pet.order = order;
  pet.stuckMs = 0;
  return true;
}
