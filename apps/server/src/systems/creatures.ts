import {
  CREATURES,
  CreatureMode,
  CreatureState,
  INTERACT_TOLERANCE,
  UNARMED_ATTACK,
  WORLD_COLLIDERS,
  WORLD_RADIUS,
  ZONES,
  creatureIds,
  dayPhase,
  isCreatureKind,
  resolveCircle,
  type CreatureDefinition,
  type HomeState,
  type ItemId,
  type PlayerState,
  type Point,
} from '@homebound/shared';
import { addItem, spaceFor } from '../inventory/inventory.js';

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

function randomPointInZone(def: CreatureDefinition, random: Random): Point {
  const zone = ZONES[def.zone];
  for (let attempt = 0; ; attempt++) {
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * zone.radius;
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

function moveToward(c: CreatureState, def: CreatureDefinition, to: Point, step: number): void {
  const dx = to.x - c.x;
  const dz = to.z - c.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return;
  face(c, to);
  const k = Math.min(step, dist) / dist;
  const next = constrain(def, { x: c.x + dx * k, z: c.z + dz * k });
  c.x = next.x;
  c.z = next.z;
}

/** A player a creature may notice and chase: awake, conscious, outside the safe yard. */
function isPrey(p: PlayerState): boolean {
  return p.connected && !p.sleeping && p.health > 0 && Math.hypot(p.x, p.z) > SAFE_RADIUS;
}

/** Edge-to-centre distance: how far the player is from the creature's body. */
function reach(c: CreatureState, def: CreatureDefinition, p: Point): number {
  return Math.hypot(p.x - c.x, p.z - c.z) - def.radius;
}

function spot(state: HomeState, c: CreatureState, def: CreatureDefinition): string {
  const night = dayPhase(state.timeOfDay) === 'night';
  const range = def.detectRange * (night ? def.nightDetectMultiplier : 1);
  const zone = ZONES[def.zone].center;
  let best = '';
  let bestDistance = range;
  for (const [id, p] of state.players) {
    if (!isPrey(p) || Math.hypot(p.x - zone.x, p.z - zone.z) > def.leashRadius) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d <= bestDistance) {
      best = id;
      bestDistance = d;
    }
  }
  return best;
}

function setMode(c: CreatureState, mode: CreatureMode, timerMs = 0): void {
  c.mode = mode;
  c.timerMs = timerMs;
}

function startPatrol(c: CreatureState, def: CreatureDefinition, random: Random): void {
  const goal = randomPointInZone(def, random);
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
    state.creatures.set(id, c);
  }
}

/** A creature landed a blow on a player. */
export interface CreatureHit {
  sessionId: string;
  damage: number;
}

/** Advances every creature by one server tick. Returns the hits on players (the room applies them). */
export function tickCreatures(state: HomeState, dtMs: number, random: Random): CreatureHit[] {
  const hits: CreatureHit[] = [];
  for (const c of state.creatures.values()) {
    const def = defOf(c);
    if (!def) continue;
    const before = c.timerMs;
    c.timerMs -= dtMs;
    const expired = c.timerMs <= 0;
    const dt = dtMs / 1000;

    if (!c.present) {
      if (expired) spawn(c, def, random);
      continue;
    }

    const target = c.target ? state.players.get(c.target) : undefined;
    const zone = ZONES[def.zone].center;
    const lost =
      !target ||
      !isPrey(target) ||
      Math.hypot(target.x - c.x, target.z - c.z) > def.giveUpRange ||
      Math.hypot(target.x - zone.x, target.z - zone.z) > def.leashRadius;

    switch (c.mode) {
      case CreatureMode.Dead:
        break;

      case CreatureMode.Idle:
      case CreatureMode.Patrol: {
        const seen = spot(state, c, def);
        if (seen) {
          c.target = seen;
          const p = state.players.get(seen);
          if (p) face(c, p);
          setMode(c, CreatureMode.Alert, def.alertMs);
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
          face(c, target);
          if (expired) setMode(c, CreatureMode.Chase);
        }
        break;

      case CreatureMode.Hurt:
        if (expired) {
          if (lost) startPatrol(c, def, random);
          else setMode(c, CreatureMode.Chase);
        }
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

export type StrikeOutcome = 'hit' | 'killed' | 'out-of-reach' | 'invalid';

/**
 * A player hits a creature with bare hands. Hits during a wind-up don't interrupt it (no
 * stun-lock); otherwise the creature flinches, is knocked back and turns on its attacker.
 */
export function strikeCreature(
  state: HomeState,
  creatureId: string,
  attacker: { sessionId: string; player: PlayerState },
): StrikeOutcome {
  const c = state.creatures.get(creatureId);
  const def = c ? defOf(c) : undefined;
  if (!c || !def || !c.present || c.mode === CreatureMode.Dead) return 'invalid';
  const { player } = attacker;
  if (reach(c, def, player) > UNARMED_ATTACK.range + STRIKE_TOLERANCE) return 'out-of-reach';

  c.health = Math.max(0, c.health - UNARMED_ATTACK.damage);
  if (c.health === 0) {
    c.target = '';
    setMode(c, CreatureMode.Dead);
    return 'killed';
  }
  c.target = attacker.sessionId;
  if (c.mode !== CreatureMode.Attack) {
    const d = Math.hypot(c.x - player.x, c.z - player.z) || 1;
    const pushed = constrain(def, {
      x: c.x + ((c.x - player.x) / d) * def.knockback,
      z: c.z + ((c.z - player.z) / d) * def.knockback,
    });
    c.x = pushed.x;
    c.z = pushed.z;
    face(c, player);
    setMode(c, CreatureMode.Hurt, def.hurtMs);
  }
  return 'hit';
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
