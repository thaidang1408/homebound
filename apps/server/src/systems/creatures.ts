import {
  BUFFS,
  CREATURES,
  CreatureMode,
  NOISE_MS,
  PETS,
  LANTERN_OFFSET,
  LANTERN_SAFE_RADIUS,
  findLandmark,
  STEALTH_CROUCH,
  STEALTH_NOISY,
  isBuffId,
  CreatureState,
  CREATURE_HIT_HEIGHT,
  INTERACT_TOLERANCE,
  WORLD_COLLIDERS,
  WORLD_RADIUS,
  ZONES,
  creatureIds,
  dayPhase,
  isCreatureKind,
  resolveCircle,
  terrainHeight,
  type CreatureDefinition,
  type HomeState,
  type ItemId,
  type PlayerState,
  type Point,
} from '@homebound/shared';
import { addItem, itemAt, spaceFor } from '../inventory/inventory.js';

/**
 * Creature AI (ADR-016): one finite state machine for every kind, tuned by its definition.
 * idle ⇄ patrol → alert → chase → attack → chase … ; any hit → hurt → chase; 0 health → dead.
 * The yard around the house is a safe zone: creatures never enter it and ignore players inside.
 */

export type Random = () => number;

/** Server-side slack on the player's strike range (latency between client and server poses). */
const STRIKE_TOLERANCE = INTERACT_TOLERANCE;
/** A wind-up still lands if the target stepped only this far out of reach meanwhile. */
const ATTACK_TOLERANCE = 0.4;
/** Patrol goal counts as reached within this distance. */
const ARRIVE_DISTANCE = 0.5;
const SAFE_RADIUS = ZONES.yard.radius;

function defOf(c: CreatureState): CreatureDefinition | undefined {
  return isCreatureKind(c.kind) ? CREATURES[c.kind] : undefined;
}

const between = (random: Random, [min, max]: readonly [number, number]) =>
  min + random() * (max - min);

/** A free spot within `radius` of the creature's zone centre (its spawn area by default). */
function randomPointInZone(
  def: CreatureDefinition,
  random: Random,
  radius: number = ZONES[def.zone].radius,
): Point {
  const zone = ZONES[def.zone];
  for (let attempt = 0; ; attempt++) {
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * radius;
    const p = { x: zone.center.x + Math.cos(angle) * r, z: zone.center.z + Math.sin(angle) * r };
    const free = resolveCircle(p, def.radius, WORLD_COLLIDERS);
    if ((free.x === p.x && free.z === p.z) || attempt > 10) return free;
  }
}

/** Keeps a creature on walkable ground: out of trees, the yard, and its leash circle. */
function constrain(def: CreatureDefinition, p: Point): Point {
  const zone = ZONES[def.zone].center;
  let { x, z } = resolveCircle(p, def.radius, WORLD_COLLIDERS);
  const fromZone = Math.hypot(x - zone.x, z - zone.z);
  if (fromZone > def.leashRadius) {
    x = zone.x + ((x - zone.x) / fromZone) * def.leashRadius;
    z = zone.z + ((z - zone.z) / fromZone) * def.leashRadius;
  }
  const fromHome = Math.hypot(x, z);
  const minHome = SAFE_RADIUS + def.radius;
  if (fromHome < minHome && fromHome > 0) {
    x = (x / fromHome) * minHome;
    z = (z / fromHome) * minHome;
  }
  const maxWorld = WORLD_RADIUS - def.radius;
  if (Math.hypot(x, z) > maxWorld) {
    const k = maxWorld / Math.hypot(x, z);
    x *= k;
    z *= k;
  }
  return { x, z };
}

/** yaw 0 looks toward −Z (same convention as players). */
function face(c: CreatureState, to: Point): void {
  c.yaw = Math.atan2(-(to.x - c.x), -(to.z - c.z));
}

/** Headings tried, in order, when the straight line is blocked (radians off the goal direction). */
const FEELERS = [0, 0.6, -0.6, 1.2, -1.2, 1.75, -1.75];
/** A heading is good enough once it makes this share of the step. */
const GOOD_PROGRESS = 0.6;

/**
 * Steps toward `to`. If a tree or rock blocks the straight line, it tries headings fanning out to
 * either side and takes the first that really moves (simple feelers, no pathfinding), so a
 * charging creature goes around an obstacle instead of grinding into it.
 */
function moveToward(c: CreatureState, def: CreatureDefinition, to: Point, step: number): void {
  const dx = to.x - c.x;
  const dz = to.z - c.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return;
  const length = Math.min(step, dist);
  const base = Math.atan2(dz, dx);
  let best = { x: c.x, z: c.z };
  let bestProgress = -1;
  for (const offset of FEELERS) {
    const a = base + offset;
    const next = constrain(def, {
      x: c.x + Math.cos(a) * length,
      z: c.z + Math.sin(a) * length,
    });
    const progress = Math.hypot(next.x - c.x, next.z - c.z);
    if (progress > bestProgress) {
      best = next;
      bestProgress = progress;
    }
    if (progress >= length * GOOD_PROGRESS) break;
  }
  if (bestProgress > 1e-6) face(c, { x: c.x + (best.x - c.x) * 10, z: c.z + (best.z - c.z) * 10 });
  else face(c, to);
  c.x = best.x;
  c.z = best.z;
}

/** A player a creature may notice and chase: awake, conscious, outside the safe yard. */
function isPrey(state: HomeState, p: PlayerState): boolean {
  return (
    p.connected &&
    !p.sleeping &&
    p.health > 0 &&
    Math.hypot(p.x, p.z) > SAFE_RADIUS &&
    !nearLitLantern(state, p)
  );
}

/** A lit great lantern (Phase 13) keeps the night creatures off you. */
function nearLitLantern(state: HomeState, p: Point): boolean {
  for (const id of state.lanterns.keys()) {
    const l = findLandmark(id);
    if (!l) continue;
    const at = { x: l.x + LANTERN_OFFSET.x, z: l.z + LANTERN_OFFSET.z };
    if (Math.hypot(p.x - at.x, p.z - at.z) < LANTERN_SAFE_RADIUS) return true;
  }
  return false;
}

/** Edge-to-centre distance: how far the player is from the creature's body. */
function reach(c: CreatureState, def: CreatureDefinition, p: Point): number {
  return Math.hypot(p.x - c.x, p.z - c.z) - def.radius;
}

/**
 * How far away a creature notices this player, relative to its detect range: sneaking halves it,
 * having just sprinted makes you louder, the "light-footed" buff helps (Phase 10).
 */
export function stealthOf(p: PlayerState, now: number): number {
  const movement = p.crouching ? STEALTH_CROUCH : now - p.noisyAt < NOISE_MS ? STEALTH_NOISY : 1;
  const buff = isBuffId(p.buff) ? BUFFS[p.buff] : undefined;
  return movement * (buff && 'stealth' in buff ? buff.stealth : 1);
}

/** A player holding a wild pet's favorite food: it doesn't run, it comes over (Phase 11). */
function offersFood(def: CreatureDefinition, p: PlayerState): boolean {
  return !!def.tame && itemAt(p.inventory, p.selectedSlot) === PETS[def.tame].food;
}

/** Wild pets walk up to someone offering food; it stops this close (within reach of [E]). */
const FRIENDLY_DISTANCE = 1.4;
/** …and notices the food from this many times its detection range. */
const FOOD_SCENT = 2;

function friendOf(state: HomeState, c: CreatureState, def: CreatureDefinition): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDistance = def.detectRange * FOOD_SCENT;
  for (const p of state.players.values()) {
    if (!p.connected || p.sleeping || p.health === 0 || !offersFood(def, p)) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

const HUNTING: readonly string[] = [
  CreatureMode.Alert,
  CreatureMode.Chase,
  CreatureMode.Attack,
  CreatureMode.Hurt,
];

/** Creatures of `kind` currently going after player `sessionId`. */
function huntersOf(state: HomeState, kind: string, sessionId: string): number {
  let n = 0;
  for (const other of state.creatures.values()) {
    if (other.kind === kind && other.target === sessionId && HUNTING.includes(other.mode)) n++;
  }
  return n;
}

function spot(state: HomeState, c: CreatureState, def: CreatureDefinition, now: number): string {
  const night = dayPhase(state.timeOfDay) === 'night';
  const range = def.detectRange * (night ? def.nightDetectMultiplier : 1);
  const skittish = def.temperament === 'skittish';
  const maxHunters = def.maxAttackers[night ? 1 : 0];
  const zone = ZONES[def.zone].center;
  let best = '';
  let bestShare = 1; // distance / own detection range: the most noticeable player wins
  for (const [id, p] of state.players) {
    if (!isPrey(state, p) || offersFood(def, p)) continue;
    // Hunters keep to their territory; anything that spooks prey counts, wherever it stands.
    if (!skittish && Math.hypot(p.x - zone.x, p.z - zone.z) > def.leashRadius) continue;
    if (!skittish && huntersOf(state, c.kind, id) >= maxHunters) continue;
    const share = Math.hypot(p.x - c.x, p.z - c.z) / (range * stealthOf(p, now));
    if (share <= bestShare) {
      best = id;
      bestShare = share;
    }
  }
  return best;
}

function setMode(c: CreatureState, mode: CreatureMode, timerMs = 0): void {
  c.mode = mode;
  c.timerMs = timerMs;
}

function startPatrol(c: CreatureState, def: CreatureDefinition, random: Random): void {
  // constrain() keeps far goals out of the yard and the world's edge.
  const goal = constrain(def, randomPointInZone(def, random, def.roamRadius));
  c.goalX = goal.x;
  c.goalZ = goal.z;
  c.target = '';
  setMode(c, CreatureMode.Patrol);
}

function spawn(c: CreatureState, def: CreatureDefinition, random: Random): void {
  const p = randomPointInZone(def, random);
  c.x = p.x;
  c.z = p.z;
  c.yaw = random() * Math.PI * 2;
  c.health = def.maxHealth;
  c.present = true;
  c.target = '';
  setMode(c, CreatureMode.Idle, between(random, def.idleMs));
}

export function initCreatures(state: HomeState, random: Random): void {
  for (const { id, kind } of creatureIds()) {
    const c = new CreatureState();
    c.kind = kind;
    spawn(c, CREATURES[kind], random);
    if (!isActive(state, CREATURES[kind])) {
      c.present = false; // night creatures wait for dusk, then appear at once
      c.timerMs = 0;
    }
    state.creatures.set(id, c);
  }
}

/** Night creatures leave once nobody is this close (they don't pop out of sight in front of you). */
const VANISH_DISTANCE = 25;

function isActive(state: HomeState, def: CreatureDefinition): boolean {
  return def.activeAt === 'always' || dayPhase(state.timeOfDay) === 'night';
}

/** Off-hours: run from the nearest player, then disappear into the woods when unseen. */
function retreat(state: HomeState, c: CreatureState, def: CreatureDefinition, dt: number): void {
  let nearest: PlayerState | undefined;
  let distance = Infinity;
  for (const p of state.players.values()) {
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < distance) {
      nearest = p;
      distance = d;
    }
  }
  if (!nearest || distance > VANISH_DISTANCE) {
    c.present = false;
    c.target = '';
    setMode(c, CreatureMode.Idle);
    return;
  }
  if (c.mode === CreatureMode.Dead) return; // a carcass stays until it's out of sight
  c.target = '';
  c.mode = CreatureMode.Chase; // reads as running
  const away = { x: c.x + (c.x - nearest.x), z: c.z + (c.z - nearest.z) };
  moveToward(c, def, away, def.runSpeed * dt);
}

/** A creature landed a blow on a player. */
export interface CreatureHit {
  sessionId: string;
  damage: number;
}

/** Run straight away from `from` (the feelers steer around trees). */
function bolt(c: CreatureState, def: CreatureDefinition, from: Point, dt: number): void {
  moveToward(c, def, { x: c.x + (c.x - from.x), z: c.z + (c.z - from.z) }, def.runSpeed * dt);
}

/**
 * Advances every creature by one server tick. Returns the hits on players (the room applies them).
 * `now` is the room clock (players' noise is timestamped with it).
 */
export function tickCreatures(
  state: HomeState,
  dtMs: number,
  random: Random,
  now = 0,
): CreatureHit[] {
  const hits: CreatureHit[] = [];
  for (const c of state.creatures.values()) {
    const def = defOf(c);
    if (!def) continue;
    const before = c.timerMs;
    c.timerMs -= dtMs;
    const expired = c.timerMs <= 0;
    const dt = dtMs / 1000;

    const active = isActive(state, def);
    if (!c.present) {
      if (expired && active) spawn(c, def, random);
      continue;
    }
    if (!active) {
      retreat(state, c, def, dtMs / 1000);
      continue;
    }

    const target = c.target ? state.players.get(c.target) : undefined;
    const zone = ZONES[def.zone].center;
    const lost =
      !target ||
      !isPrey(state, target) ||
      Math.hypot(target.x - c.x, target.z - c.z) > def.giveUpRange ||
      // Hunters give up at the edge of their territory; prey keeps running from the scare.
      (def.temperament === 'hostile' &&
        Math.hypot(target.x - zone.x, target.z - zone.z) > def.leashRadius);

    switch (c.mode) {
      case CreatureMode.Dead:
        break;

      case CreatureMode.Idle:
      case CreatureMode.Patrol: {
        const seen = spot(state, c, def, now);
        const friend = !seen && def.tame ? friendOf(state, c, def) : null;
        if (seen) {
          c.target = seen;
          const p = state.players.get(seen);
          if (p) face(c, p);
          setMode(c, CreatureMode.Alert, def.alertMs);
        } else if (friend) {
          setMode(c, CreatureMode.Idle, between(random, def.idleMs));
          if (Math.hypot(friend.x - c.x, friend.z - c.z) > FRIENDLY_DISTANCE) {
            moveToward(c, def, friend, def.walkSpeed * dt);
          } else face(c, friend);
        } else if (c.mode === CreatureMode.Idle) {
          if (expired) startPatrol(c, def, random);
        } else {
          const goal = { x: c.goalX, z: c.goalZ };
          moveToward(c, def, goal, def.walkSpeed * dt);
          if (Math.hypot(goal.x - c.x, goal.z - c.z) < ARRIVE_DISTANCE) {
            setMode(c, CreatureMode.Idle, between(random, def.idleMs));
          }
        }
        break;
      }

      case CreatureMode.Alert:
        if (lost) startPatrol(c, def, random);
        else {
          face(c, target); // ears up, staring: the moment to freeze or shoot
          if (expired) setMode(c, onTheMove(def));
        }
        break;

      case CreatureMode.Hurt:
        if (expired) {
          if (lost) startPatrol(c, def, random);
          else setMode(c, onTheMove(def));
        }
        break;

      case CreatureMode.Flee:
        if (lost) startPatrol(c, def, random);
        else bolt(c, def, target, dt);
        break;

      case CreatureMode.Chase:
        if (lost) startPatrol(c, def, random);
        else if (reach(c, def, target) <= def.attackRange) {
          face(c, target);
          setMode(c, CreatureMode.Attack, def.attackWindupMs + def.attackRecoverMs);
        } else moveToward(c, def, target, def.runSpeed * dt);
        break;

      case CreatureMode.Attack: {
        // The strike lands the moment the wind-up ends, if the target is still close.
        const strikesNow = before > def.attackRecoverMs && c.timerMs <= def.attackRecoverMs;
        if (strikesNow && target && !lost) {
          if (reach(c, def, target) <= def.attackRange + ATTACK_TOLERANCE) {
            hits.push({ sessionId: c.target, damage: def.attackDamage });
          }
        } else if (!strikesNow && c.timerMs > def.attackRecoverMs && target) face(c, target);
        if (expired) {
          if (lost) startPatrol(c, def, random);
          else setMode(c, CreatureMode.Chase);
        }
        break;
      }
    }
  }
  return hits;
}

/** After a scare or a hit: hunters chase, prey runs. */
function onTheMove(def: CreatureDefinition): CreatureMode {
  return def.temperament === 'skittish' ? CreatureMode.Flee : CreatureMode.Chase;
}

/** A snare closes on a creature that can be snared: it's caught (a carcass to butcher). */
export function snareCreature(state: HomeState, creatureId: string): boolean {
  const c = state.creatures.get(creatureId);
  const def = c ? defOf(c) : undefined;
  if (!c || !def?.snareable || !c.present || c.mode === CreatureMode.Dead) return false;
  c.health = 0;
  c.target = '';
  setMode(c, CreatureMode.Dead);
  return true;
}

/** A befriended wild pet leaves the world (it's someone's pet now); another turns up later. */
export function retireCreature(state: HomeState, creatureId: string): void {
  const c = state.creatures.get(creatureId);
  const def = c ? defOf(c) : undefined;
  if (!c || !def) return;
  c.present = false;
  c.target = '';
  c.trust = 0;
  c.trustBy = '';
  setMode(c, CreatureMode.Idle, def.respawnMs);
}

/** Live creatures whose body overlaps a circle (traps). */
export function creaturesWithin(state: HomeState, p: Point, radius: number): string[] {
  const out: string[] = [];
  for (const [id, c] of state.creatures) {
    const def = defOf(c);
    if (!def || !c.present || c.mode === CreatureMode.Dead) continue;
    if (Math.hypot(p.x - c.x, p.z - c.z) <= radius + def.radius) out.push(id);
  }
  return out;
}

export type HitOutcome = 'hit' | 'killed' | 'invalid';

/**
 * Damages a creature from a blow coming from `from` (a player or an arrow). Hits during a wind-up
 * don't interrupt it (no stun-lock); otherwise the creature flinches, is knocked back and turns on
 * the attacker.
 */
export function damageCreature(
  state: HomeState,
  creatureId: string,
  attackerId: string,
  from: Point,
  damage: number,
): HitOutcome {
  const c = state.creatures.get(creatureId);
  const def = c ? defOf(c) : undefined;
  // Wild pets can't be hurt: you make friends with them.
  if (!c || !def || def.tame || !c.present || c.mode === CreatureMode.Dead) return 'invalid';

  c.health = Math.max(0, c.health - damage);
  if (c.health === 0) {
    c.target = '';
    setMode(c, CreatureMode.Dead);
    return 'killed';
  }
  c.target = attackerId;
  if (c.mode !== CreatureMode.Attack) {
    const d = Math.hypot(c.x - from.x, c.z - from.z) || 1;
    const pushed = constrain(def, {
      x: c.x + ((c.x - from.x) / d) * def.knockback,
      z: c.z + ((c.z - from.z) / d) * def.knockback,
    });
    c.x = pushed.x;
    c.z = pushed.z;
    // Shot from afar it turns toward the shooter, not the arrow.
    const attacker = state.players.get(attackerId);
    face(c, attacker ?? from);
    setMode(c, CreatureMode.Hurt, def.hurtMs);
  }
  return 'hit';
}

export type StrikeOutcome = HitOutcome | 'out-of-reach';

/** A melee blow: the creature's body must be within `range` of the player. */
export function strikeCreature(
  state: HomeState,
  creatureId: string,
  attacker: { sessionId: string; player: PlayerState },
  weapon: { damage: number; range: number },
): StrikeOutcome {
  if (creatureReach(state, creatureId, attacker.player) > weapon.range + STRIKE_TOLERANCE) {
    return state.creatures.has(creatureId) ? 'out-of-reach' : 'invalid';
  }
  return damageCreature(state, creatureId, attacker.sessionId, attacker.player, weapon.damage);
}

/** Where a creature's body is, if `p` hits the vertical cylinder of a live creature. */
export function creatureAt(state: HomeState, p: { x: number; y: number; z: number }): string {
  for (const [id, c] of state.creatures) {
    const def = defOf(c);
    if (!def || def.tame || !c.present || c.mode === CreatureMode.Dead) continue; // arrows pass wild pets
    if (Math.hypot(p.x - c.x, p.z - c.z) > def.radius) continue;
    const ground = terrainHeight(c.x, c.z);
    if (p.y >= ground && p.y <= ground + CREATURE_HIT_HEIGHT) return id;
  }
  return '';
}

export type ButcherOutcome = 'butchered' | 'inventory-full' | 'invalid';

/** Takes the loot from a carcass (all or nothing); the carcass disappears and respawns later. */
export function butcherCreature(
  state: HomeState,
  creatureId: string,
  player: PlayerState,
  random: Random,
): ButcherOutcome {
  const c = state.creatures.get(creatureId);
  const def = c ? defOf(c) : undefined;
  if (!c || !def || !c.present || c.mode !== CreatureMode.Dead) return 'invalid';

  const drops = new Map<ItemId, number>();
  for (const entry of def.loot) {
    const qty = entry.min + Math.floor(random() * (entry.max - entry.min + 1));
    drops.set(entry.itemId, (drops.get(entry.itemId) ?? 0) + qty);
  }
  for (const [itemId, qty] of drops) {
    if (spaceFor(player.inventory, itemId) < qty) return 'inventory-full';
  }
  for (const [itemId, qty] of drops) addItem(player.inventory, itemId, qty);
  c.present = false;
  setMode(c, CreatureMode.Dead, def.respawnMs);
  return 'butchered';
}

/** Where a creature is, for interaction range checks. */
export function creatureReach(state: HomeState, creatureId: string, p: Point): number {
  const c = state.creatures.get(creatureId);
  const def = c ? defOf(c) : undefined;
  return c && def ? reach(c, def, p) : Infinity;
}
