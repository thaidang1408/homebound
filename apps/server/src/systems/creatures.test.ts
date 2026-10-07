import { describe, expect, test } from 'vitest';
import {
  CREATURES,
  CreatureMode,
  HEALTH_MAX,
  HEALTH_REGEN_PER_SECOND,
  HomeState,
  PlayerState,
  SIMULATION_TICK_MS,
  UNARMED_ATTACK,
  WORLD_COLLIDERS,
  ZONES,
  collides,
  createRandom,
  type CreatureState,
} from '@homebound/shared';
import { countItem, createSlots } from '../inventory/inventory.js';
import {
  butcherCreature,
  initCreatures,
  strikeCreature,
  tickCreatures,
  type CreatureHit,
} from './creatures.js';
import { hurtPlayer, tickNeeds } from './needs.js';

const BOAR = CREATURES.boar;
const MEADOW = ZONES.meadow.center;
const DAY = 0.5;
const NIGHT = 0.95;

function setup() {
  const state = new HomeState();
  state.timeOfDay = DAY;
  const random = createRandom(42);
  initCreatures(state, random);
  const player = new PlayerState();
  player.inventory = createSlots(5);
  player.x = 0;
  player.z = 0; // safe at home
  state.players.set('p1', player);
  const boar = state.creatures.get('boar-0') as CreatureState;
  // Only boar-0 matters: park the others far away in the meadow, out of sight.
  for (const [id, c] of state.creatures) if (id !== 'boar-0') Object.assign(c, { x: 44, z: -14 });
  Object.assign(boar, { x: MEADOW.x, z: MEADOW.z });
  const run = (ms: number): CreatureHit[] => {
    const hits: CreatureHit[] = [];
    for (let t = 0; t < ms; t += SIMULATION_TICK_MS) {
      hits.push(...tickCreatures(state, SIMULATION_TICK_MS, random));
    }
    return hits;
  };
  return { state, random, player, boar, run };
}

/** Put the player `distance` m west of the boar (toward home, still outside the yard). */
function stand(player: PlayerState, boar: CreatureState, distance: number) {
  player.x = boar.x - distance;
  player.z = boar.z;
}

describe('creatures', () => {
  test('spawn in their zone at full health, out of trees and the yard', () => {
    const state = new HomeState();
    initCreatures(state, createRandom(7));
    expect(state.creatures.size).toBe(BOAR.count);
    for (const c of state.creatures.values()) {
      expect(c.health).toBe(BOAR.maxHealth);
      expect(Math.hypot(c.x - MEADOW.x, c.z - MEADOW.z)).toBeLessThanOrEqual(ZONES.meadow.radius);
      expect(Math.hypot(c.x, c.z)).toBeGreaterThan(ZONES.yard.radius);
      expect(collides(c, BOAR.radius - 0.01, WORLD_COLLIDERS)).toBe(false);
    }
  });

  test('spots a player, telegraphs, chases and strikes after the wind-up', () => {
    const { player, boar, run } = setup();
    stand(player, boar, BOAR.detectRange - 1);
    run(SIMULATION_TICK_MS);
    expect(boar.mode).toBe(CreatureMode.Alert);
    expect(boar.target).toBe('p1');
    run(BOAR.alertMs);
    expect(boar.mode).toBe(CreatureMode.Chase);
    for (let i = 0; i < 30 && boar.mode === CreatureMode.Chase; i++) run(SIMULATION_TICK_MS);
    expect(boar.mode).toBe(CreatureMode.Attack);
    expect(Math.hypot(player.x - boar.x, player.z - boar.z)).toBeLessThan(BOAR.detectRange - 1);
    const hits = run(BOAR.attackWindupMs);
    expect(hits).toEqual([{ sessionId: 'p1', damage: BOAR.attackDamage }]);
  });

  test('stepping back during the wind-up dodges the strike', () => {
    const { player, boar, run } = setup();
    stand(player, boar, 1);
    run(BOAR.alertMs + 2 * SIMULATION_TICK_MS);
    expect(boar.mode).toBe(CreatureMode.Attack);
    stand(player, boar, 4);
    expect(run(BOAR.attackWindupMs)).toEqual([]);
  });

  test('ignores players far away, and sees farther at night', () => {
    const { state, player, boar, run } = setup();
    stand(player, boar, BOAR.detectRange + 2);
    run(500);
    expect(boar.target).toBe('');
    state.timeOfDay = NIGHT;
    run(SIMULATION_TICK_MS);
    expect(boar.target).toBe('p1');
  });

  test('never enters the yard and gives up on a player who reaches it', () => {
    const { player, boar, run } = setup();
    stand(player, boar, 7);
    run(BOAR.alertMs + 2 * SIMULATION_TICK_MS);
    expect(boar.mode).toBe(CreatureMode.Chase);
    player.x = 0;
    player.z = 0;
    run(10_000);
    expect(boar.mode).not.toBe(CreatureMode.Chase);
    expect(Math.hypot(boar.x, boar.z)).toBeGreaterThan(ZONES.yard.radius);
  });

  test('a hit flinches and knocks it back; a hit during the wind-up does not interrupt it', () => {
    const { player, boar, run, state } = setup();
    stand(player, boar, 1);
    const before = boar.x;
    expect(strikeCreature(state, 'boar-0', { sessionId: 'p1', player })).toBe('hit');
    expect(boar.mode).toBe(CreatureMode.Hurt);
    expect(boar.health).toBe(BOAR.maxHealth - UNARMED_ATTACK.damage);
    expect(boar.x).toBeGreaterThan(before); // pushed away from the player (east)
    run(BOAR.hurtMs + 2 * SIMULATION_TICK_MS);
    expect(boar.mode).toBe(CreatureMode.Attack);
    strikeCreature(state, 'boar-0', { sessionId: 'p1', player });
    expect(boar.mode).toBe(CreatureMode.Attack);
  });

  test('out of reach strikes are refused', () => {
    const { player, boar, state } = setup();
    stand(player, boar, 5);
    expect(strikeCreature(state, 'boar-0', { sessionId: 'p1', player })).toBe('out-of-reach');
    expect(boar.health).toBe(BOAR.maxHealth);
  });

  test('dies, is butchered for meat, then a fresh one respawns', () => {
    const { player, boar, state, random, run } = setup();
    const hitsToKill = Math.ceil(BOAR.maxHealth / UNARMED_ATTACK.damage);
    let outcome = '';
    for (let i = 0; i < hitsToKill; i++) {
      stand(player, boar, 1);
      outcome = strikeCreature(state, 'boar-0', { sessionId: 'p1', player });
    }
    expect(outcome).toBe('killed');
    expect(boar.mode).toBe(CreatureMode.Dead);
    expect(strikeCreature(state, 'boar-0', { sessionId: 'p1', player })).toBe('invalid');

    expect(butcherCreature(state, 'boar-0', player, random)).toBe('butchered');
    const meat = countItem(player.inventory, 'raw_meat');
    expect(meat).toBeGreaterThanOrEqual(2);
    expect(meat).toBeLessThanOrEqual(3);
    expect(boar.present).toBe(false);
    expect(butcherCreature(state, 'boar-0', player, random)).toBe('invalid');

    run(BOAR.respawnMs + SIMULATION_TICK_MS);
    expect(boar.present).toBe(true);
    expect(boar.health).toBe(BOAR.maxHealth);
  });

  test('a full backpack leaves the carcass untouched', () => {
    const { player, boar, state, random } = setup();
    boar.health = 0;
    boar.mode = CreatureMode.Dead;
    for (const s of player.inventory) Object.assign(s, { itemId: 'stone', qty: 10 });
    expect(butcherCreature(state, 'boar-0', player, random)).toBe('inventory-full');
    expect(boar.present).toBe(true);
  });
});

describe('health', () => {
  test('regenerates while fed, not while starving', () => {
    const state = new HomeState();
    const p = new PlayerState();
    state.players.set('p1', p);
    hurtPlayer(p, 30);
    tickNeeds(state, 10);
    expect(p.healthExact).toBeCloseTo(HEALTH_MAX - 30 + HEALTH_REGEN_PER_SECOND * 10);
    p.hungerExact = 0;
    const now = p.healthExact;
    tickNeeds(state, 10);
    expect(p.healthExact).toBe(now);
  });

  test('the last blow reports a blackout once', () => {
    const p = new PlayerState();
    expect(hurtPlayer(p, HEALTH_MAX - 1)).toBe(false);
    expect(hurtPlayer(p, 5)).toBe(true);
    expect(p.health).toBe(0);
    expect(hurtPlayer(p, 5)).toBe(false);
  });
});
