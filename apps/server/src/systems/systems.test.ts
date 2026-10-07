import { describe, expect, test } from 'vitest';
import {
  BED_SPOTS,
  COOK_TIME_MS,
  HUNGER_DECAY_PER_SECOND,
  HUNGER_START,
  HomeState,
  PlayerState,
  StoveStatus,
} from '@homebound/shared';
import { addItem, countItem, createSlots } from '../inventory/inventory.js';
import { eatFromSlot, tickNeeds } from './needs.js';
import { everyoneAsleep, startNewDay, toggleSleep } from './sleep.js';
import { tickStove, useStove } from './stove.js';

function setup() {
  const state = new HomeState();
  state.chest = createSlots(4);
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
  test('raw meat → cooking → cooked meat, collected by the other player', () => {
    const { state, a, b } = setup();
    addItem(a.inventory, 'raw_meat', 2);

    expect(useStove(state, a)).toBe('started');
    expect(countItem(a.inventory, 'raw_meat')).toBe(1);
    expect(useStove(state, b)).toBe('busy');

    tickStove(state, COOK_TIME_MS / 2);
    expect(state.stove.progress).toBeCloseTo(0.5, 1);
    tickStove(state, COOK_TIME_MS / 2);
    expect(state.stove.status).toBe(StoveStatus.Done);

    expect(useStove(state, b)).toBe('collected');
    expect(countItem(b.inventory, 'cooked_meat')).toBe(1);
    expect(state.stove.status).toBe(StoveStatus.Idle);
  });

  test('needs something cookable', () => {
    const { state, a } = setup();
    addItem(a.inventory, 'cooked_meat', 1);
    expect(useStove(state, a)).toBe('nothing-to-cook');
  });

  test('a full inventory leaves the food on the stove', () => {
    const { state, a, b } = setup();
    addItem(a.inventory, 'raw_meat', 1);
    useStove(state, a);
    tickStove(state, COOK_TIME_MS);
    for (let i = 0; i < 5; i++) addItem(b.inventory, 'raw_meat', 10);
    expect(useStove(state, b)).toBe('inventory-full');
    expect(state.stove.status).toBe(StoveStatus.Done);
  });
});

describe('sleep', () => {
  test('lying down moves you to your side of the bed, getting up beside it', () => {
    const { a } = setup();
    expect(toggleSleep(a)).toEqual(BED_SPOTS[0]?.sleep);
    expect(a.sleeping).toBe(true);
    expect(toggleSleep(a)).toEqual(BED_SPOTS[0]?.wake);
  });

  test('a new day needs both players asleep and connected', () => {
    const { state, a, b } = setup();
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
