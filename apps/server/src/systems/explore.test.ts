import { describe, expect, test } from 'vitest';
import {
  HEALTH_MAX,
  HOME_WAYSTONE,
  HomeState,
  LANDMARKS,
  MAX_MAP_MARKERS,
  PlayerState,
  TOWER_VIEW,
  cellsAround,
  createRandom,
  findLandmark,
  waystoneId,
} from '@homebound/shared';
import { countItem, createSlots } from '../inventory/inventory.js';
import { climbTower, openCache, pray, tickExplore, toggleMarker, travel } from './explore.js';
import { setHealth } from './needs.js';

function setup() {
  const state = new HomeState();
  const player = new PlayerState();
  player.inventory = createSlots(10);
  state.players.set('p1', player);
  return { state, player, random: createRandom(3) };
}

const cave = findLandmark('cave');
if (!cave) throw new Error('no cave');

describe('the shared map', () => {
  test('the fog lifts around players, and walking up to a landmark discovers it', () => {
    const { state, player } = setup();
    Object.assign(player, { x: 0, z: 0 });
    expect(tickExplore(state)).toEqual([]);
    const home = cellsAround({ x: 0, z: 0 }, 1)[0];
    expect(state.explored.has(String(home))).toBe(true);
    expect(state.explored.size).toBeLessThan(40);
    Object.assign(player, { x: cave.x - 10, z: cave.z });
    expect(tickExplore(state)).toEqual(['cave']);
    expect(tickExplore(state)).toEqual([]); // only once
    expect(state.discovered.has('cave')).toBe(true);
  });

  test('the watchtower reveals the map far around it', () => {
    const { state } = setup();
    const tower = LANDMARKS.find((l) => l.kind === 'watchtower');
    if (!tower) throw new Error('no tower');
    expect(climbTower(state, 'cave')).toBe(false);
    expect(climbTower(state, tower.id)).toBe(true);
    expect(state.explored.size).toBe(cellsAround(tower, TOWER_VIEW).length);
  });

  test('markers: a click adds one, a click on it removes it, the oldest goes past the cap', () => {
    const { state } = setup();
    expect(toggleMarker(state, { x: 10, z: 10 }, 'mark-0')).toBe('added');
    expect(toggleMarker(state, { x: 11, z: 9 }, 'mark-1')).toBe('removed');
    for (let i = 0; i < MAX_MAP_MARKERS + 2; i++) toggleMarker(state, { x: i * 10, z: 0 }, `m${i}`);
    expect(state.markers.size).toBe(MAX_MAP_MARKERS);
    expect(state.markers.has('m0')).toBe(false);
    expect(state.markers.has(`m${MAX_MAP_MARKERS + 1}`)).toBe(true);
  });
});

describe('waystones', () => {
  test('travel only from a lit waystone you stand at, to another lit one', () => {
    const { state, player } = setup();
    Object.assign(player, { x: HOME_WAYSTONE.at.x + 1, z: HOME_WAYSTONE.at.z });
    expect(travel(state, player, waystoneId(cave))).toBeNull(); // not discovered yet
    state.discovered.set('cave', true);
    const arrive = travel(state, player, waystoneId(cave));
    expect(arrive).not.toBeNull();
    expect(
      Math.hypot((arrive?.x ?? 0) - cave.waystone.x, (arrive?.z ?? 0) - cave.waystone.z),
    ).toBeLessThan(2);
    expect(travel(state, player, HOME_WAYSTONE.id)).toBeNull(); // already here
    Object.assign(player, { x: 30, z: 30 }); // nowhere near a waystone
    expect(travel(state, player, waystoneId(cave))).toBeNull();
  });
});

describe('landmark caches and the shrine', () => {
  test('a cache gives its loot once a day for the whole home; a full backpack keeps it closed', () => {
    const { state, player, random } = setup();
    player.inventory.forEach((s) => Object.assign(s, { itemId: 'wood', qty: 20 }));
    expect(openCache(state, 'cave', player, random)).toBe('inventory-full');
    player.inventory.forEach((s) => Object.assign(s, { itemId: '', qty: 0 }));
    expect(openCache(state, 'cave', player, random)).toBe('opened');
    expect(countItem(player.inventory, 'stone')).toBeGreaterThanOrEqual(3);
    expect(countItem(player.inventory, 'arrow')).toBeGreaterThanOrEqual(4);
    expect(openCache(state, 'cave', player, random)).toBe('empty');
    state.caches.clear(); // a new morning
    expect(openCache(state, 'cave', player, random)).toBe('opened');
    expect(openCache(state, 'shrine', player, random)).toBe('invalid'); // no cache there
  });

  test('the spirit shrine heals you fully', () => {
    const { player } = setup();
    setHealth(player, 30);
    expect(pray(player)).toBe(true);
    expect(player.health).toBe(HEALTH_MAX);
    expect(pray(player)).toBe(false); // nothing to heal
  });
});
