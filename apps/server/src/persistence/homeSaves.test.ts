import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { HATCH_MS, HEALTH_MAX, HUNGER_MAX, MAX_MAP_MARKERS, WORLD_RADIUS } from '@homebound/shared';
import {
  SAVE_VERSION,
  homeExists,
  loadHome,
  parseSave,
  restoreSaves,
  saveHome,
  setSaveDir,
  setSaveMirror,
  type HomeSave,
} from './homeSaves.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'homebound-save-test-'));
  setSaveDir(dir);
});

const PLAYER = 'player-aaaaaaaaaaaaaaaa';

function sample(code = 'ABC23'): HomeSave {
  return {
    version: SAVE_VERSION,
    code,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    day: 4,
    timeOfDay: 0.8,
    chest: [{ itemId: 'raw_meat', qty: 3 }, null],
    stove: { status: 'cooking', itemId: 'raw_meat', elapsedMs: 1200, cookedBy: PLAYER },
    resources: { 'tree-0': 1, 'not-a-node': 3 },
    players: {
      [PLAYER]: {
        name: 'An',
        hunger: 42.5,
        health: 64,
        xp: 130,
        x: 1,
        z: 2,
        yaw: 0.5,
        inventory: [null, { itemId: 'cooked_meat', qty: 2 }],
      },
    },
    goals: [{ kind: 'hunt', target: 2, progress: 1 }],
    today: { hunted: 1, meals: 2, gathered: 9, crafted: 0, revives: 0 },
    traps: { 'trap-3': { kind: 'snare', x: 20, z: -4, sprung: true, owner: PLAYER } },
    pets: {
      'pet-0': {
        kind: 'dragon',
        name: 'Đốm',
        owner: PLAYER,
        order: 'stay',
        x: 3,
        z: 8,
        hatchMs: 0,
      },
      'pet-1': { kind: '', name: '', owner: PLAYER, order: 'follow', x: -2, z: 6, hatchMs: 9000 },
    },
    explored: [0, 312, 313],
    discovered: ['cave'],
    caches: ['cave'],
    markers: [{ x: 10, z: -20 }],
  };
}

describe('home saves', () => {
  test('round-trips through disk', () => {
    saveHome(sample());
    expect(homeExists('ABC23')).toBe(true);
    const loaded = loadHome('ABC23');
    expect(loaded?.day).toBe(4);
    expect(loaded?.chest[0]).toEqual({ itemId: 'raw_meat', qty: 3 });
    expect(loaded?.players[PLAYER]?.inventory[1]).toEqual({ itemId: 'cooked_meat', qty: 2 });
    expect(loaded?.stove.status).toBe('cooking');
    expect(loaded?.timeOfDay).toBe(0.8);
    expect(loaded?.resources).toEqual({ 'tree-0': 1 }); // unknown node ids dropped
    expect(loaded?.players[PLAYER]?.health).toBe(64);
    expect(loaded?.goals).toEqual([{ kind: 'hunt', target: 2, progress: 1 }]);
    expect(loaded?.today.meals).toBe(2);
    expect(loaded?.traps).toEqual({
      'trap-3': { kind: 'snare', x: 20, z: -4, sprung: true, owner: PLAYER },
    });
  });

  test('tampered traps are dropped or cleaned', () => {
    const raw = sample() as unknown as Record<string, unknown>;
    const parsed = parseSave(
      {
        ...raw,
        traps: {
          'trap-1': { kind: 'bomb', x: 1, z: 1 },
          '../x': { kind: 'snare', x: 1, z: 1 },
          'trap-2': { kind: 'spike', x: 'far', z: 1 },
          'trap-4': { kind: 'spike', x: 500, z: 2, owner: 'nope' },
        },
      },
      'ABC23',
    );
    expect(parsed?.traps).toEqual({
      'trap-4': { kind: 'spike', x: WORLD_RADIUS, z: 2, sprung: false, owner: '' },
    });
  });

  test('pets and eggs round-trip; tampered ones are dropped or cleaned', () => {
    saveHome(sample());
    expect(loadHome('ABC23')?.pets).toEqual(sample().pets);
    const raw = sample() as unknown as Record<string, unknown>;
    const parsed = parseSave(
      {
        ...raw,
        pets: {
          'pet-0': { kind: 'kraken', owner: PLAYER, x: 1, z: 1 },
          'pet-1': { kind: 'ghost', owner: 'nobody', x: 1, z: 1 },
          'pet-2': { kind: 'ghost', owner: PLAYER, x: 1, z: 1, order: 'attack', name: ' Boo\n ' },
          'pet-3': { kind: '', owner: PLAYER, x: 900, z: 1, hatchMs: 1e12 },
          'pet-4': { kind: 'alien', owner: PLAYER, x: 1, z: 1 }, // a third pet: over the limit
        },
      },
      'ABC23',
    );
    expect(parsed?.pets).toEqual({
      'pet-2': {
        kind: 'ghost',
        name: 'Boo',
        owner: PLAYER,
        order: 'follow',
        x: 1,
        z: 1,
        hatchMs: 0,
      },
      'pet-3': {
        kind: '',
        name: '',
        owner: PLAYER,
        order: 'follow',
        x: WORLD_RADIUS,
        z: 1,
        hatchMs: HATCH_MS,
      },
    });
  });

  test('the shared map round-trips; tampered entries are dropped', () => {
    saveHome(sample());
    const loaded = loadHome('ABC23');
    expect(loaded?.explored).toEqual([0, 312, 313]);
    expect(loaded?.discovered).toEqual(['cave']);
    expect(loaded?.caches).toEqual(['cave']);
    expect(loaded?.markers).toEqual([{ x: 10, z: -20 }]);
    const raw = sample() as unknown as Record<string, unknown>;
    const parsed = parseSave(
      {
        ...raw,
        explored: [1, 1, -4, 99999, 2.5, 'x', 7],
        discovered: ['cave', 'atlantis', 3],
        caches: 'all',
        markers: [
          { x: 500, z: 1 },
          { x: 'a', z: 1 },
          ...Array.from({ length: 12 }, (_, k) => ({ x: k, z: 0 })),
        ],
      },
      'ABC23',
    );
    expect(parsed?.explored).toEqual([1, 7]);
    expect(parsed?.discovered).toEqual(['cave']);
    expect(parsed?.caches).toEqual([]);
    expect(parsed?.markers).toHaveLength(MAX_MAP_MARKERS);
    expect(parsed?.markers.at(-1)).toEqual({ x: 11, z: 0 });
  });

  test('unknown or invalid codes are simply missing', () => {
    expect(loadHome('ZZZZZ')).toBeNull();
    expect(homeExists('../../etc/passwd')).toBe(false);
  });

  test('a corrupt file is moved aside, never overwritten', () => {
    writeFileSync(join(dir, 'ABC23.json'), '{ not json');
    expect(loadHome('ABC23')).toBeNull();
    expect(readdirSync(dir).some((f) => f.startsWith('ABC23.json.corrupt-'))).toBe(true);
    expect(homeExists('ABC23')).toBe(false);
  });

  test('tampered values are clamped or dropped', () => {
    const raw = sample() as unknown as Record<string, unknown>;
    const bad = {
      ...raw,
      day: -3,
      chest: [
        { itemId: 'diamond_sword', qty: 1 },
        { itemId: 'raw_meat', qty: 999 },
      ],
      goals: [
        { kind: 'hunt', target: 2, progress: 99 },
        { kind: 'fly', target: 1, progress: 0 },
      ],
      today: { hunted: -4, meals: 'x' },
      players: {
        [PLAYER]: { name: 'An', hunger: 1e9, xp: -50, inventory: 'nope' },
        'bad id!': { name: 'X' },
      },
    };
    const parsed = parseSave(bad, 'ABC23');
    expect(parsed?.day).toBe(1);
    expect(parsed?.chest[0]).toBeNull();
    expect(parsed?.chest[1]?.qty).toBe(10); // maxStack
    expect(parsed?.players[PLAYER]?.hunger).toBe(HUNGER_MAX);
    expect(parsed?.players[PLAYER]?.xp).toBe(0);
    expect(parsed?.players[PLAYER]?.health).toBe(HEALTH_MAX); // pre-Phase 4 saves: full health
    expect(Object.keys(parsed?.players ?? {})).toEqual([PLAYER]);
    expect(parsed?.goals).toEqual([{ kind: 'hunt', target: 2, progress: 2 }]);
    expect(parsed?.today).toMatchObject({ hunted: 0, meals: 0 });
  });

  test('a save for a different code or version is rejected', () => {
    expect(parseSave(sample('XYZ23'), 'ABC23')).toBeNull();
    expect(parseSave({ ...sample(), version: 99 }, 'ABC23')).toBeNull();
  });

  test('every save is handed to the mirror; restore only fills in missing homes', () => {
    const mirrored: HomeSave[] = [];
    setSaveMirror((save) => mirrored.push(save));
    saveHome(sample('ABC23'));
    setSaveMirror(null);
    expect(mirrored.map((s) => s.code)).toEqual(['ABC23']);

    const restored = restoreSaves([
      { code: 'ABC23', save: { ...sample('ABC23'), day: 99 } }, // on disk already: kept
      { code: 'XYZ23', save: sample('XYZ23') }, // wiped disk: restored
      { code: '../evil', save: sample() },
    ]);
    expect(restored).toBe(1);
    expect(loadHome('ABC23')?.day).toBe(4);
    expect(loadHome('XYZ23')?.day).toBe(4);
  });
});
