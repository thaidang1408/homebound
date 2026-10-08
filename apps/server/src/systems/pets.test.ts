import { describe, expect, test } from 'vitest';
import {
  CREATURES,
  CreatureMode,
  HATCH_MS,
  HEALTH_MAX,
  HomeState,
  PETS,
  PET_FOLLOW_DISTANCE,
  PetState,
  PlayerState,
  RESOURCE_NODES,
  SIMULATION_TICK_MS,
  createRandom,
  type CreatureState,
  type PetKind,
} from '@homebound/shared';
import { addItem, countItem, createSlots } from '../inventory/inventory.js';
import { damageCreature, initCreatures, tickCreatures } from './creatures.js';
import { initResources } from './harvest.js';
import { setHealth } from './needs.js';
import { befriend, homeSpot, placeEgg, tickPets } from './pets.js';

const OWNER = 'owner-aaaaaaaaaaaaaaaa';
const DAY = 0.5;
/** An open spot east of the house, outside the yard and between the trees. */
const FIELD = { x: 26, z: 4 };

function setup() {
  const state = new HomeState();
  state.timeOfDay = DAY;
  const random = createRandom(11);
  initResources(state);
  initCreatures(state, random);
  // Every creature waits far away unless a test brings it over.
  for (const c of state.creatures.values()) Object.assign(c, { x: -50, z: 20, timerMs: 60_000 });
  const player = new PlayerState();
  player.inventory = createSlots(10);
  Object.assign(player, { x: 0, z: 2 });
  state.players.set('p1', player);
  let online = true;
  const ctx = { sessionOf: (id: string) => (id === OWNER && online ? 'p1' : ''), random };
  const run = (ms: number) => {
    const events = [];
    for (let t = 0; t < ms; t += SIMULATION_TICK_MS) {
      tickCreatures(state, SIMULATION_TICK_MS, random, t);
      events.push(...tickPets(state, SIMULATION_TICK_MS, ctx));
    }
    return events;
  };
  const pet = (kind: PetKind, at = FIELD) => {
    const p = new PetState();
    Object.assign(p, { kind, name: PETS[kind].name, owner: OWNER, hatch: 1, ...at });
    state.pets.set(`pet-${state.pets.size}`, p);
    return p;
  };
  const goOffline = () => {
    online = false;
  };
  return { state, player, run, pet, goOffline };
}

const creature = (state: HomeState, id: string) => state.creatures.get(id) as CreatureState;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('eggs', () => {
  test('set down in the yard only, at most two pets each, and they hatch into different kinds', () => {
    const { state, player, run } = setup();
    addItem(player.inventory, 'pet_egg', 2);
    addItem(player.inventory, 'pet_egg', 1); // a second stack
    Object.assign(player, { x: 0, z: 20, yaw: 0 }); // down the road, outside the yard
    expect(placeEgg(state, player, 0, OWNER, 'pet-0')).toBe('outside-the-yard');
    Object.assign(player, { x: 0, z: 9, yaw: 0 });
    expect(placeEgg(state, player, 0, OWNER, 'pet-0')).toBe('placed');
    Object.assign(player, { x: 3, z: 9 });
    expect(placeEgg(state, player, 0, OWNER, 'pet-1')).toBe('placed');
    expect(placeEgg(state, player, 1, OWNER, 'pet-2')).toBe('too-many');
    expect(countItem(player.inventory, 'pet_egg')).toBe(1);

    run(HATCH_MS - 1000);
    expect([...state.pets.values()].every((p) => p.kind === '' && p.hatch > 0.9)).toBe(true);
    const events = run(1100);
    expect(events.filter((e) => e.type === 'hatched')).toHaveLength(2);
    const kinds = [...state.pets.values()].map((p) => p.kind);
    expect(new Set(kinds).size).toBe(2);
  });
});

describe('following', () => {
  test('a pet trots over to its owner and stays close; one left far behind pops to their side', () => {
    const { player, run, pet } = setup();
    Object.assign(player, { x: FIELD.x - 8, z: FIELD.z });
    const dino = pet('dino');
    run(4000);
    expect(dist(dino, player)).toBeLessThan(PET_FOLLOW_DISTANCE + 0.3);
    Object.assign(player, { x: -26, z: 4 }); // ~50 m away in one go (a teleport, a respawn)
    run(200);
    expect(dist(dino, player)).toBeLessThan(2);
  });

  test('stay stays; with the owner offline the pet goes home to its spot', () => {
    const { state, player, run, pet, goOffline } = setup();
    Object.assign(player, { x: FIELD.x - 8, z: FIELD.z });
    const unicorn = pet('unicorn');
    unicorn.order = 'stay';
    run(2000);
    expect(dist(unicorn, FIELD)).toBeLessThan(0.01);
    goOffline();
    run(15_000);
    expect(dist(unicorn, homeSpot('pet-0'))).toBeLessThan(0.5);
    expect(unicorn.ownerSession).toBe('');
    expect(state.pets.size).toBe(1);
  });
});

describe('abilities', () => {
  test('a baby dragon breathes fire at a boar hunting its owner, and the kill is credited', () => {
    const { state, player, run, pet } = setup();
    Object.assign(player, FIELD);
    pet('dragon', { x: FIELD.x - 1, z: FIELD.z });
    const boar = creature(state, 'boar-0');
    Object.assign(boar, { x: FIELD.x + 5, z: FIELD.z, present: true, mode: CreatureMode.Idle });
    const events = run(12_000);
    const hits = events.filter((e) => e.type === 'hit');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.some((e) => e.type === 'hit' && e.outcome === 'killed' && e.owner === OWNER)).toBe(
      true,
    );
  });

  test('at night a dragon at home goes out to meet a wolf prowling by the yard', () => {
    const { state, run, pet, goOffline } = setup();
    state.timeOfDay = 0.95;
    goOffline();
    const dragon = pet('dragon', homeSpot('pet-0'));
    const wolf = creature(state, 'wolf-0');
    Object.assign(wolf, { x: 0, z: 17, present: true, mode: CreatureMode.Idle, timerMs: 60_000 });
    const events = run(4000);
    expect(events.some((e) => e.type === 'hit')).toBe(true);
    expect(dragon.ownerSession).toBe('');
  });

  test('a unicorn foal heals players close to it', () => {
    const { player, run, pet } = setup();
    Object.assign(player, FIELD);
    setHealth(player, 40);
    pet('unicorn', { x: FIELD.x + 1, z: FIELD.z });
    run(5000);
    expect(player.health).toBeGreaterThan(44);
    expect(player.health).toBeLessThanOrEqual(HEALTH_MAX);
  });

  test('a baby dino butchers a carcass near its owner straight into their backpack', () => {
    const { state, player, run, pet } = setup();
    Object.assign(player, FIELD);
    pet('dino', { x: FIELD.x - 1, z: FIELD.z });
    const boar = creature(state, 'boar-0');
    Object.assign(boar, { x: FIELD.x + 6, z: FIELD.z + 2, present: true, health: 0 });
    boar.mode = CreatureMode.Dead;
    run(5000);
    expect(boar.present).toBe(false);
    expect(countItem(player.inventory, 'raw_meat')).toBeGreaterThanOrEqual(2);
  });

  test('a little ghost marks the nearest animal for its owner', () => {
    const { state, player, run, pet } = setup();
    Object.assign(player, FIELD);
    const ghost = pet('ghost', { x: FIELD.x - 1, z: FIELD.z });
    const deer = creature(state, 'deer-0');
    Object.assign(deer, { x: FIELD.x + 20, z: FIELD.z, present: true, mode: CreatureMode.Idle });
    run(200);
    expect(ghost.mark).toBe('deer-0');
  });

  test('a tiny alien beams up berries from a bush near it', () => {
    const { state, player, run, pet } = setup();
    const bush = RESOURCE_NODES.find((n) => n.kind === 'bush' && Math.hypot(n.x, n.z) > 16);
    if (!bush) throw new Error('no bush');
    Object.assign(player, { x: bush.x + 1.5, z: bush.z });
    pet('alien', { x: bush.x - 1, z: bush.z });
    run(1000);
    expect(countItem(player.inventory, 'berries')).toBe(2);
    expect(state.resources.get(bush.id)?.charges).toBe(1);
  });
});

describe('wild pets', () => {
  test('feeding its favorite food three times makes it your pet; wrong food does nothing', () => {
    const { state, player, run } = setup();
    const wild = creature(state, 'dragon-0');
    Object.assign(wild, { ...FIELD, present: true, mode: CreatureMode.Idle, timerMs: 60_000 });
    Object.assign(player, { x: FIELD.x - 1, z: FIELD.z });
    addItem(player.inventory, 'berries', 3);
    expect(befriend(state, 'dragon-0', player, OWNER, 'pet-0')).toBe('wrong-food');
    player.inventory.forEach((s) => Object.assign(s, { itemId: '', qty: 0 }));
    addItem(player.inventory, 'cooked_meat', 3);
    expect(befriend(state, 'dragon-0', player, OWNER, 'pet-0')).toBe('fed');
    expect(befriend(state, 'dragon-0', player, OWNER, 'pet-0')).toBe('fed');
    expect(wild.trust).toBe(2);
    expect(befriend(state, 'dragon-0', player, OWNER, 'pet-0')).toBe('befriended');
    expect(state.pets.get('pet-0')?.kind).toBe('dragon');
    expect(state.pets.get('pet-0')?.owner).toBe(OWNER);
    expect(wild.present).toBe(false);
    run(CREATURES.dragon.respawnMs + 200);
    expect(wild.present).toBe(true); // another one turns up for the partner
    expect(wild.trust).toBe(0);
  });

  test("can't be hurt, and comes over (instead of running) to someone holding its food", () => {
    const { state, player, run } = setup();
    const wild = creature(state, 'unicorn-0');
    const clearing = { x: 0, z: 42 }; // its home: it never strays far from there
    Object.assign(wild, { ...clearing, present: true, mode: CreatureMode.Idle, timerMs: 60_000 });
    expect(damageCreature(state, 'unicorn-0', 'p1', player, 50)).toBe('invalid');
    addItem(player.inventory, 'berries', 1);
    Object.assign(player, { x: 0, z: 36 });
    run(5000);
    expect(wild.mode).not.toBe(CreatureMode.Flee);
    expect(dist(wild, player)).toBeLessThan(2);
    player.selectedSlot = 3; // empty hands: it gets shy again
    run(1200);
    expect(wild.mode).toBe(CreatureMode.Flee);
  });
});
