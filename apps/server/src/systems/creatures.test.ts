import { describe, expect, test } from 'vitest';
import {
  CREATURES,
  CreatureMode,
  HomeState,
  PlayerState,
  RESOURCE_NODES,
  SIMULATION_TICK_MS,
  WEAPONS,
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

const BOAR = CREATURES.boar;
const FISTS = WEAPONS.fists;
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
    const boars = [...state.creatures.values()].filter((c) => c.kind === 'boar');
    expect(boars).toHaveLength(BOAR.count);
    for (const c of boars) {
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

  test('by day one boar hunts you at a time; at night two do', () => {
    const { state, player, boar, run } = setup();
    const other = state.creatures.get('boar-1') as CreatureState;
    Object.assign(other, { x: boar.x, z: boar.z + 1.5 });
    stand(player, boar, 4);
    run(SIMULATION_TICK_MS);
    const hunting = [boar, other].filter((c) => c.target === 'p1');
    expect(hunting).toHaveLength(BOAR.maxAttackers[0]);

    for (const c of [boar, other]) Object.assign(c, { mode: CreatureMode.Idle, target: '' });
    state.timeOfDay = NIGHT;
    run(SIMULATION_TICK_MS);
    expect([boar, other].filter((c) => c.target === 'p1')).toHaveLength(BOAR.maxAttackers[1]);
  });

  test('goes around a tree in its way instead of grinding into it', () => {
    const { player, boar, run } = setup();
    const tree = RESOURCE_NODES.filter((n) => n.kind === 'tree' && n.collider).sort(
      (a, b) =>
        Math.hypot(a.x - MEADOW.x, a.z - MEADOW.z) - Math.hypot(b.x - MEADOW.x, b.z - MEADOW.z),
    )[0];
    if (!tree) throw new Error('no tree near the meadow');
    // Boar on one side of the trunk, the player straight behind it on the other.
    Object.assign(boar, { x: tree.x - 2, z: tree.z, mode: CreatureMode.Chase, target: 'p1' });
    Object.assign(player, { x: tree.x + 2.5, z: tree.z });
    let reached = false;
    for (let t = 0; t < 4000 && !reached; t += SIMULATION_TICK_MS) {
      run(SIMULATION_TICK_MS);
      reached = boar.mode === CreatureMode.Attack;
    }
    expect(reached).toBe(true);
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
    expect(strikeCreature(state, 'boar-0', { sessionId: 'p1', player }, FISTS)).toBe('hit');
    expect(boar.mode).toBe(CreatureMode.Hurt);
    expect(boar.health).toBe(BOAR.maxHealth - FISTS.damage);
    expect(boar.x).toBeGreaterThan(before); // pushed away from the player (east)
    run(BOAR.hurtMs + 2 * SIMULATION_TICK_MS);
    expect(boar.mode).toBe(CreatureMode.Attack);
    strikeCreature(state, 'boar-0', { sessionId: 'p1', player }, FISTS);
    expect(boar.mode).toBe(CreatureMode.Attack);
  });

  test('out of reach strikes are refused', () => {
    const { player, boar, state } = setup();
    stand(player, boar, 5);
    expect(strikeCreature(state, 'boar-0', { sessionId: 'p1', player }, FISTS)).toBe(
      'out-of-reach',
    );
    expect(boar.health).toBe(BOAR.maxHealth);
  });

  test('dies, is butchered for meat, then a fresh one respawns', () => {
    const { player, boar, state, random, run } = setup();
    const hitsToKill = Math.ceil(BOAR.maxHealth / FISTS.damage);
    let outcome = '';
    for (let i = 0; i < hitsToKill; i++) {
      stand(player, boar, 1);
      outcome = strikeCreature(state, 'boar-0', { sessionId: 'p1', player }, FISTS);
    }
    expect(outcome).toBe('killed');
    expect(boar.mode).toBe(CreatureMode.Dead);
    expect(strikeCreature(state, 'boar-0', { sessionId: 'p1', player }, FISTS)).toBe('invalid');

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
