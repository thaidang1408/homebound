import { describe, expect, test } from 'vitest';
import {
  CHAPTERS,
  CreatureMode,
  HomeState,
  LANTERN_OFFSET,
  PetState,
  PlayerState,
  SIMULATION_TICK_MS,
  createRandom,
  domLine,
  findLandmark,
  type CreatureState,
} from '@homebound/shared';
import { addItem, countItem, createSlots } from '../inventory/inventory.js';
import { initCreatures, tickCreatures } from './creatures.js';
import { currentStep, lightLantern, questEvent, talk, tickQuests } from './quests.js';

function setup() {
  const state = new HomeState();
  const player = new PlayerState();
  player.inventory = createSlots(10);
  state.players.set('p1', player);
  return { state, player };
}

describe('the story', () => {
  test('chapter 1 plays start to finish', () => {
    const { state, player } = setup();
    expect(currentStep(state)?.kind).toBe('talk');
    expect(talk(state, player).outcome).toBe('advanced'); // Đốm wakes up

    expect(talk(state, player).outcome).toBe('missing-items');
    addItem(player.inventory, 'wood', 6);
    addItem(player.inventory, 'mushroom', 2);
    expect(talk(state, player).outcome).toBe('advanced');
    expect(countItem(player.inventory, 'wood')).toBe(1); // the rest was handed over
    expect(countItem(player.inventory, 'mushroom')).toBe(0);

    expect(tickQuests(state).finished).toBeNull(); // not found yet
    state.discovered.set('giant-tree', true);
    expect(tickQuests(state).finished?.kind).toBe('visit');

    expect(lightLantern(state, 'cave').finished).toBeNull(); // not this one yet
    expect(lightLantern(state, 'giant-tree').finished?.kind).toBe('light');
    expect(state.lanterns.has('giant-tree')).toBe(true);

    const end = talk(state, player);
    expect(end.chapterDone).toBe(0);
    expect(state.quest.chapter).toBe(1);
    expect(state.quest.step).toBe(0);
  });

  test('hunt steps count only the asked-for animal; craft steps only the asked-for recipe', () => {
    const { state } = setup();
    state.quest.chapter = 1; // Echoes in the Hills: craft a spear, then hunt 2 boars
    expect(questEvent(state, { kind: 'craft', recipe: 'bow' }).finished).toBeNull();
    expect(questEvent(state, { kind: 'craft', recipe: 'spear' }).finished?.kind).toBe('craft');
    expect(questEvent(state, { kind: 'hunt', creature: 'wolf' }).finished).toBeNull();
    expect(state.quest.progress).toBe(0);
    expect(questEvent(state, { kind: 'hunt', creature: 'boar' }).finished).toBeNull();
    expect(state.quest.progress).toBe(1);
    expect(questEvent(state, { kind: 'hunt', creature: 'boar' }).finished?.kind).toBe('hunt');
  });

  test('a pet (not an egg) finishes the "make a friend" step', () => {
    const { state } = setup();
    state.quest.chapter = 2;
    const egg = new PetState();
    state.pets.set('pet-0', egg);
    expect(tickQuests(state).finished).toBeNull();
    egg.kind = 'dragon';
    expect(tickQuests(state).finished?.kind).toBe('tame');
  });

  test('after the last chapter nothing more happens', () => {
    const { state, player } = setup();
    state.quest.chapter = CHAPTERS.length;
    expect(currentStep(state)).toBeNull();
    expect(talk(state, player).outcome).toBe('nothing');
    expect(questEvent(state, { kind: 'hunt', creature: 'bear' }).finished).toBeNull();
  });

  test('every chapter ends at a lantern that exists, and every visit/light names a landmark', () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.steps.some((s) => s.kind === 'light')).toBe(true);
      for (const s of chapter.steps) {
        if (s.kind === 'visit' || s.kind === 'light')
          expect(findLandmark(s.landmark)).toBeDefined();
      }
    }
  });
});

describe("Đốm's lines", () => {
  test('the opening, then the line that closed each step, and the farewell at the end', () => {
    expect(domLine(0, 0)).toBe(CHAPTERS[0]?.intro);
    expect(domLine(0, 1)).toBe(CHAPTERS[0]?.steps[0]?.done);
    expect(domLine(1, 0)).toContain(CHAPTERS[0]?.steps.at(-1)?.done ?? '?');
    expect(domLine(1, 0)).toContain(CHAPTERS[1]?.intro ?? '?');
    expect(domLine(CHAPTERS.length, 0)).toBe(CHAPTERS.at(-1)?.steps.at(-1)?.done);
  });
});

describe('lit lanterns', () => {
  test('a wolf ignores a player standing near a lit great lantern', () => {
    const { state, player } = setup();
    state.timeOfDay = 0.95;
    const random = createRandom(5);
    initCreatures(state, random);
    const tree = findLandmark('giant-tree');
    if (!tree) throw new Error('no tree');
    const lantern = { x: tree.x + LANTERN_OFFSET.x, z: tree.z + LANTERN_OFFSET.z };
    Object.assign(player, lantern);
    for (const c of state.creatures.values()) Object.assign(c, { x: 50, z: 50, timerMs: 60_000 });
    const wolf = state.creatures.get('wolf-0') as CreatureState;
    // The wolves' woods reach right up to the Giant Tree.
    Object.assign(wolf, { x: lantern.x + 4, z: lantern.z, present: true, mode: CreatureMode.Idle });
    state.lanterns.set('giant-tree', true);
    tickCreatures(state, SIMULATION_TICK_MS, random, 0);
    expect(wolf.target).toBe('');
    state.lanterns.clear(); // unlit: the same wolf notices you
    Object.assign(wolf, { x: lantern.x + 4, z: lantern.z, mode: CreatureMode.Idle });
    tickCreatures(state, SIMULATION_TICK_MS, random, 0);
    expect(wolf.target).toBe('p1');
  });
});
