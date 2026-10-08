import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { HEALTH_MAX, HUNGER_MAX } from '@homebound/shared';
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
      'trap-4': { kind: 'spike', x: 58, z: 2, sprung: false, owner: '' },
    });
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
