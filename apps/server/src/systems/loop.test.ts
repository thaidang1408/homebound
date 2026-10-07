import { describe, expect, test } from 'vitest';
import {
  CREATURES,
  GOALS,
  GOALS_PER_DAY,
  HomeState,
  PlayerState,
  SIMULATION_TICK_MS,
  ZONES,
  createRandom,
  pickGoals,
  type CreatureState,
} from '@homebound/shared';
import { createSlots } from '../inventory/inventory.js';
import { initCreatures, tickCreatures } from './creatures.js';
import { closeDay, goalSeed, progressGoal, setGoals } from './goals.js';

const NOON = 0.5;
const NIGHT = 0.9;

describe('daily goals', () => {
  test('each day gets distinct goals; the same home and day always get the same ones', () => {
    for (let day = 1; day <= 20; day++) {
      const goals = pickGoals(goalSeed('ABC23'), day);
      expect(goals).toHaveLength(GOALS_PER_DAY);
      expect(new Set(goals.map((g) => g.kind)).size).toBe(GOALS_PER_DAY);
      for (const g of goals) {
        const [min, max] = GOALS[g.kind].target;
        expect(g.target).toBeGreaterThanOrEqual(min);
        expect(g.target).toBeLessThanOrEqual(max);
      }
      expect(pickGoals(goalSeed('ABC23'), day)).toEqual(goals);
    }
    const days = Array.from({ length: 10 }, (_, d) =>
      JSON.stringify(pickGoals(goalSeed('ABC23'), d)),
    );
    expect(new Set(days).size).toBeGreaterThan(1); // not the same goals every day
  });

  test('progress completes a goal exactly once, capped at its target', () => {
    const state = new HomeState();
    setGoals(state, 1);
    const goal = state.goals.at(0);
    if (!goal) throw new Error('no goal');
    goal.kind = 'cook';
    goal.target = 2;
    expect(progressGoal(state, 'cook')).toBe(0);
    expect(progressGoal(state, 'cook', 5)).toBe(1);
    expect(goal.progress).toBe(2);
    expect(progressGoal(state, 'cook')).toBe(0);
  });

  test('closing a day summarises it and clears the stats', () => {
    const state = new HomeState();
    setGoals(state, 1);
    state.today.hunted = 2;
    state.today.meals = 3;
    const first = state.goals.at(0);
    if (first) first.progress = first.target;
    expect(closeDay(state, 4)).toMatchObject({
      day: 4,
      hunted: 2,
      meals: 3,
      goalsDone: 1,
      goalsTotal: GOALS_PER_DAY,
    });
    expect(state.today.hunted).toBe(0);
  });
});

describe('wolves', () => {
  function setup(time: number) {
    const state = new HomeState();
    state.timeOfDay = time;
    const random = createRandom(3);
    initCreatures(state, random);
    const wolves = [...state.creatures.entries()]
      .filter(([, c]) => c.kind === 'wolf')
      .map(([, c]) => c);
    const run = (ms: number) => {
      for (let t = 0; t < ms; t += SIMULATION_TICK_MS)
        tickCreatures(state, SIMULATION_TICK_MS, random);
    };
    return { state, wolves, run };
  }

  test('stay in their den by day and come out at night', () => {
    const { state, wolves, run } = setup(NOON);
    expect(wolves).toHaveLength(CREATURES.wolf.count);
    expect(wolves.every((w) => !w.present)).toBe(true);
    state.timeOfDay = NIGHT;
    run(SIMULATION_TICK_MS);
    expect(wolves.every((w) => w.present)).toBe(true);
    const den = ZONES.forest;
    for (const w of wolves) {
      expect(Math.hypot(w.x - den.center.x, w.z - den.center.z)).toBeLessThanOrEqual(
        den.radius + 1,
      );
    }
  });

  test('at dawn they run from you and vanish once out of sight', () => {
    const { state, wolves, run } = setup(NIGHT);
    const wolf = wolves[0] as CreatureState;
    const player = new PlayerState();
    player.inventory = createSlots(1);
    Object.assign(player, { x: wolf.x + 3, z: wolf.z });
    state.players.set('p1', player);

    state.timeOfDay = NOON;
    const before = wolf.x;
    run(SIMULATION_TICK_MS);
    expect(wolf.present).toBe(true); // you are watching
    expect(wolf.x).toBeLessThan(before); // running away (west, away from you)
    player.x = 1000;
    run(SIMULATION_TICK_MS);
    expect(wolf.present).toBe(false);
  });
});
