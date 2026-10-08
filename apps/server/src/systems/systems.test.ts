import { describe, expect, test } from 'vitest';
import {
  BED_SPOTS,
  COOK_TIME_MS,
  HUNGER_DECAY_PER_SECOND,
  HUNGER_START,
  HomeState,
  HARVEST_COOLDOWN_MS,
  PlayerState,
  RESOURCE_KINDS,
  RESOURCE_NODES,
  StoveStatus,
  WAKE_UP_TIME,
} from '@homebound/shared';
import { addItem, countItem, createSlots } from '../inventory/inventory.js';
import { eatFromSlot, tickNeeds } from './needs.js';
import { canToggleSleep, everyoneAsleep, startNewDay, toggleSleep } from './sleep.js';
import { harvest, initResources, tickResources } from './harvest.js';
import { tickClock } from './clock.js';
import { createPans, tickStove, useStove } from './stove.js';

function setup() {
  const state = new HomeState();
  state.chest = createSlots(4);
  createPans(state);
  const players = [1, 2].map((slot) => {
    const p = new PlayerState();
    p.slot = slot;
    p.inventory = createSlots(5);
    state.players.set(`p${slot}`, p);
    return p;
  });
  const [a, b] = players as [PlayerState, PlayerState];
  return { state, a, b };
}

describe('needs', () => {
  test('hunger drains with time and is shown rounded up', () => {
    const { state, a } = setup();
    tickNeeds(state, 10);
    expect(a.hungerExact).toBeCloseTo(HUNGER_START - HUNGER_DECAY_PER_SECOND * 10);
    expect(a.hunger).toBe(Math.ceil(a.hungerExact));
  });

  test('hunger pauses while asleep and never goes below zero', () => {
    const { state, a, b } = setup();
    b.sleeping = true;
    tickNeeds(state, 1e6);
    expect(a.hunger).toBe(0);
    expect(b.hunger).toBe(HUNGER_START);
  });

  test('eating consumes one item and restores hunger, capped at max', () => {
    const { state, a } = setup();
    tickNeeds(state, 600); // -50
    addItem(a.inventory, 'cooked_meat', 2);
    expect(eatFromSlot(a, 0)).toBe(true);
    expect(a.hunger).toBe(Math.ceil(HUNGER_START - 50 + 35));
    expect(countItem(a.inventory, 'cooked_meat')).toBe(1);
    eatFromSlot(a, 0);
    expect(a.hunger).toBe(100);
  });

  test('empty slots cannot be eaten', () => {
    const { a } = setup();
    expect(eatFromSlot(a, 0)).toBe(false);
    expect(eatFromSlot(a, 42)).toBe(false);
  });
});

describe('stove', () => {
  const pan = (state: HomeState, i: number) => state.pans.at(i);

  test('raw meat → cooking → cooked meat, collected by the other player', () => {
    const { state, a, b } = setup();
    addItem(a.inventory, 'raw_meat', 1);

    expect(useStove(state, a, 'player-a')).toBe('started');
    expect(countItem(a.inventory, 'raw_meat')).toBe(0);
    tickStove(state, COOK_TIME_MS / 2);
    expect(pan(state, 0)?.progress).toBeCloseTo(0.5, 1);
    expect(tickStove(state, COOK_TIME_MS / 2)).toEqual(['player-a']); // the cook gets the XP
    expect(pan(state, 0)?.status).toBe(StoveStatus.Done);

    expect(useStove(state, b, 'player-b')).toBe('collected');
    expect(countItem(b.inventory, 'cooked_meat')).toBe(1);
    expect(pan(state, 0)?.status).toBe(StoveStatus.Idle);
  });

  test('cooks on every free pan at once; then the stove is busy', () => {
    const { state, a, b } = setup();
    addItem(a.inventory, 'raw_meat', 5);
    expect(useStove(state, a, 'player-a')).toBe('started');
    expect(countItem(a.inventory, 'raw_meat')).toBe(2);
    expect([...state.pans].every((p) => p.status === StoveStatus.Cooking)).toBe(true);
    expect(useStove(state, b, 'player-b')).toBe('busy');
    expect(tickStove(state, COOK_TIME_MS)).toEqual(['player-a', 'player-a', 'player-a']);
    expect(useStove(state, b, 'player-b')).toBe('collected');
    expect(countItem(b.inventory, 'cooked_meat')).toBe(3);
  });

  test('grills the held mushroom, but never mushrooms you aren’t holding', () => {
    const { state, a } = setup();
    addItem(a.inventory, 'mushroom', 2); // slot 0
    a.selectedSlot = 1;
    expect(useStove(state, a, 'player-a')).toBe('nothing-to-cook');
    a.selectedSlot = 0;
    expect(useStove(state, a, 'player-a')).toBe('started');
    tickStove(state, COOK_TIME_MS);
    useStove(state, a, 'player-a');
    expect(countItem(a.inventory, 'grilled_mushroom')).toBe(2);
  });

  test('needs something cookable', () => {
    const { state, a } = setup();
    addItem(a.inventory, 'cooked_meat', 1);
    expect(useStove(state, a, 'player-a')).toBe('nothing-to-cook');
  });

  test('a full inventory leaves the food on the stove', () => {
    const { state, a, b } = setup();
    addItem(a.inventory, 'raw_meat', 1);
    useStove(state, a, 'player-a');
    tickStove(state, COOK_TIME_MS);
    for (let i = 0; i < 5; i++) addItem(b.inventory, 'raw_meat', 10);
    expect(useStove(state, b, 'player-b')).toBe('inventory-full');
    expect(pan(state, 0)?.status).toBe(StoveStatus.Done);
  });
});

describe('sleep', () => {
  test('lying down moves you to your side of the bed, getting up beside it', () => {
    const { a } = setup();
    expect(toggleSleep(a)).toEqual(BED_SPOTS[0]?.sleep);
    expect(a.sleeping).toBe(true);
    expect(toggleSleep(a)).toEqual(BED_SPOTS[0]?.wake);
  });

  test('you can only go to bed in the evening or at night', () => {
    const { state, a } = setup();
    state.timeOfDay = 0.5;
    expect(canToggleSleep(state, a)).toBe(false);
    state.timeOfDay = 0.8;
    expect(canToggleSleep(state, a)).toBe(true);
    toggleSleep(a);
    state.timeOfDay = 0.5;
    expect(canToggleSleep(state, a)).toBe(true); // getting up is always fine
  });

  test('sleeping after midnight wakes at dawn without skipping a day', () => {
    const { state, a, b } = setup();
    state.day = 3;
    state.timeOfDay = 0.1;
    toggleSleep(a);
    toggleSleep(b);
    startNewDay(state);
    expect(state.day).toBe(3);
    expect(state.timeOfDay).toBeCloseTo(WAKE_UP_TIME, 3);
  });

  test('a new day needs both players asleep and connected', () => {
    const { state, a, b } = setup();
    state.timeOfDay = 0.8;
    toggleSleep(a);
    expect(everyoneAsleep(state)).toBe(false);
    toggleSleep(b);
    b.connected = false;
    expect(everyoneAsleep(state)).toBe(false);
    b.connected = true;
    expect(everyoneAsleep(state)).toBe(true);

    startNewDay(state);
    expect(state.day).toBe(2);
    expect(a.sleeping || b.sleeping).toBe(false);
  });
});

describe('harvesting', () => {
  const tree = RESOURCE_NODES.find((n) => n.kind === 'tree');
  if (!tree) throw new Error('no tree in layout');
  const def = RESOURCE_KINDS.tree;

  test('gives wood, uses charges, respects the cooldown', () => {
    const { state, a } = setup();
    initResources(state);
    expect(harvest(state, a, tree, 1000, 0)).toBe('harvested');
    expect(countItem(a.inventory, 'wood')).toBe(def.qty);
    expect(harvest(state, a, tree, 1000 + HARVEST_COOLDOWN_MS - 1, 1000)).toBe('cooldown');
    expect(state.resources.get(tree.id)?.charges).toBe(def.charges - 1);
  });

  test('a depleted node grows back after its respawn time', () => {
    const { state, a } = setup();
    initResources(state);
    let t = 0;
    for (let i = 0; i < def.charges; i++) {
      t += HARVEST_COOLDOWN_MS;
      harvest(state, a, tree, t, t - HARVEST_COOLDOWN_MS);
    }
    expect(harvest(state, a, tree, t + 10_000, 0)).toBe('depleted');
    tickResources(state, def.respawnMs - 1);
    expect(state.resources.get(tree.id)?.charges).toBe(0);
    tickResources(state, 1);
    expect(state.resources.get(tree.id)?.charges).toBe(def.charges);
  });

  test('a full backpack harvests nothing', () => {
    const { state, a } = setup();
    initResources(state);
    for (let i = 0; i < 5; i++) addItem(a.inventory, 'stone', 20);
    expect(harvest(state, a, tree, 1000, 0)).toBe('inventory-full');
    expect(state.resources.get(tree.id)?.charges).toBe(def.charges);
  });
});

describe('world clock', () => {
  test('passing midnight starts the next day', () => {
    const { state } = setup();
    state.timeOfDay = 0.999;
    expect(tickClock(state, 60_000)).toBe(true);
    expect(state.day).toBe(2);
    expect(tickClock(state, 1000)).toBe(false);
  });
});
