import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { HUNGER_MAX } from '@homebound/shared';
import {
  SAVE_VERSION,
  homeExists,
  loadHome,
  parseSave,
  saveHome,
  setSaveDir,
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
    chest: [{ itemId: 'raw_meat', qty: 3 }, null],
    stove: { status: 'cooking', itemId: 'raw_meat', elapsedMs: 1200, cookedBy: PLAYER },
    players: {
      [PLAYER]: {
        name: 'An',
        hunger: 42.5,
        xp: 130,
        x: 1,
        z: 2,
        yaw: 0.5,
        inventory: [null, { itemId: 'cooked_meat', qty: 2 }],
      },
    },
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
    expect(Object.keys(parsed?.players ?? {})).toEqual([PLAYER]);
  });

  test('a save for a different code or version is rejected', () => {
    expect(parseSave(sample('XYZ23'), 'ABC23')).toBeNull();
    expect(parseSave({ ...sample(), version: 99 }, 'ABC23')).toBeNull();
  });
});
