import { describe, expect, test } from 'vitest';
import {
  CREATURES,
  CreatureMode,
  HomeState,
  PlayerState,
  SIMULATION_TICK_MS,
  SPIKE_TRAP_DAMAGE,
  TrapState,
  armorOf,
  createRandom,
  ZONES,
  type CreatureState,
} from '@homebound/shared';
import { addItem, createSlots } from '../inventory/inventory.js';
import { damageCreature, initCreatures, stealthOf, tickCreatures } from './creatures.js';
import { eatFromSlot, tickNeeds } from './needs.js';
import { placeTrap, tickTraps } from './traps.js';

const DAY = 0.5;
/** An open spot east of the house, outside the yard and between the trees. */
const FIELD = { x: 26, z: 4 };

function setup(focus: string) {
  const state = new HomeState();
  state.timeOfDay = DAY;
  const random = createRandom(7);
  initCreatures(state, random);
  const player = new PlayerState();
  player.inventory = createSlots(10);
  Object.assign(player, { x: 0, z: 0 });
  state.players.set('p1', player);
  // Everyone but the creature under test waits far away on the other side of the world.
  for (const [id, c] of state.creatures) if (id !== focus) Object.assign(c, { x: -50, z: 20 });
  const c = state.creatures.get(focus) as CreatureState;
  Object.assign(c, { ...FIELD, present: true, mode: CreatureMode.Idle, timerMs: 60_000 });
  let now = 0;
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += SIMULATION_TICK_MS) {
      now += SIMULATION_TICK_MS;
      tickCreatures(state, SIMULATION_TICK_MS, random, now);
    }
  };
  return { state, player, c, run, now: () => now };
}

describe('skittish animals', () => {
  test('a deer bolts from a player walking up, and never attacks', () => {
    const { player, c, run } = setup('deer-0');
    Object.assign(player, { x: FIELD.x - 10, z: FIELD.z });
    run(600);
    expect(c.mode).toBe(CreatureMode.Flee);
    const start = Math.hypot(c.x - player.x, c.z - player.z);
    run(1500);
    expect(Math.hypot(c.x - player.x, c.z - player.z)).toBeGreaterThan(start + 5);
  });

  test('sneaking (crouched) gets twice as close before it notices', () => {
    const { player, c, run } = setup('deer-0');
    const range = CREATURES.deer.detectRange;
    Object.assign(player, { x: FIELD.x - range * 0.7, z: FIELD.z, crouching: true });
    run(1000);
    expect(c.mode).toBe(CreatureMode.Idle); // didn't see you
    player.crouching = false;
    run(600);
    expect(c.mode).not.toBe(CreatureMode.Idle);
  });

  test('noise and buffs change how noticeable you are', () => {
    const p = new PlayerState();
    expect(stealthOf(p, 0)).toBe(1);
    p.noisyAt = 0;
    expect(stealthOf(p, 100)).toBeGreaterThan(1); // just sprinted
    p.crouching = true;
    p.buff = 'keen';
    expect(stealthOf(p, 100)).toBeCloseTo(0.5 * 0.7);
  });

  test('a hit rabbit flinches, then runs instead of fighting', () => {
    const { state, player, c, run } = setup('rabbit-0');
    // At home in the grove (outside it, its leash would pull it straight back).
    Object.assign(c, { ...ZONES.grove.center });
    Object.assign(player, { x: c.x + 3, z: c.z });
    expect(damageCreature(state, 'rabbit-0', 'p1', player, 1)).toBe('hit');
    run(CREATURES.rabbit.hurtMs + 200);
    expect(c.mode).toBe(CreatureMode.Flee);
  });
});

describe('traps', () => {
  /** Stands the player so the trap lands on FIELD (they face −X, 1.6 m ahead). */
  function aim(player: PlayerState) {
    Object.assign(player, { x: FIELD.x + 1.6, z: FIELD.z, yaw: Math.PI / 2 });
  }

  test('a snare catches a rabbit that steps in, not a boar', () => {
    const { state, player, c } = setup('rabbit-0');
    addItem(player.inventory, 'snare', 2);
    aim(player);
    expect(placeTrap(state, player, 0, 'owner-1', 'trap-0')).toBe('placed');
    const boar = state.creatures.get('boar-0') as CreatureState;
    Object.assign(boar, { ...FIELD, present: true, mode: CreatureMode.Idle, health: 40 });
    Object.assign(c, { x: -50, z: 20 });
    expect(tickTraps(state, () => '')).toEqual([]); // the boar walks on
    Object.assign(c, { ...FIELD });
    const [event] = tickTraps(state, () => '');
    expect(event).toMatchObject({ creatureId: 'rabbit-0', outcome: 'killed', owner: 'owner-1' });
    expect(c.mode).toBe(CreatureMode.Dead);
    expect((state.traps.get('trap-0') as TrapState).sprung).toBe(true);
    expect(tickTraps(state, () => '')).toEqual([]); // sprung: nothing more
  });

  test('a spike trap hurts the first creature over it once', () => {
    const { state, player, c } = setup('bear-0');
    addItem(player.inventory, 'spike_trap', 1);
    aim(player);
    placeTrap(state, player, 0, 'owner-1', 'trap-0');
    const [event] = tickTraps(state, () => 'p1');
    expect(event?.outcome).toBe('hit');
    expect(c.health).toBe(CREATURES.bear.maxHealth - SPIKE_TRAP_DAMAGE);
    expect(c.target).toBe('p1'); // turns on whoever set it
  });

  test('no traps in the yard (nothing comes there)', () => {
    const { state, player } = setup('rabbit-0');
    addItem(player.inventory, 'snare', 1);
    Object.assign(player, { x: 3, z: 8, yaw: 0 });
    expect(placeTrap(state, player, 0, 'owner-1', 'trap-0')).toBe('in-the-yard');
    expect(state.traps.size).toBe(0);
  });
});

describe('gear and food', () => {
  test('the best armor carried counts', () => {
    const slots = createSlots(10);
    expect(armorOf(slots)).toBe(0);
    addItem(slots, 'leather_armor', 1);
    addItem(slots, 'bear_coat', 1);
    expect(armorOf(slots)).toBe(0.45);
  });

  test('stew gives a warm buff that speeds up healing, then wears off', () => {
    const state = new HomeState();
    const p = new PlayerState();
    p.inventory = createSlots(10);
    p.healthExact = 50;
    state.players.set('p1', p);
    addItem(p.inventory, 'stew', 1);
    expect(eatFromSlot(p, 0)).toBe(true);
    expect(p.buff).toBe('warm');
    tickNeeds(state, 10);
    const plain = new PlayerState();
    plain.healthExact = 50;
    const s2 = new HomeState();
    s2.players.set('p2', plain);
    tickNeeds(s2, 10);
    expect(p.healthExact - 50).toBeGreaterThan((plain.healthExact - 50) * 4);
    tickNeeds(state, 200);
    expect(p.buff).toBe('');
  });
});
