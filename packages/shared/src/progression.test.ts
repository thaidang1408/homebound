import { describe, expect, test } from 'vitest';
import { MAX_LEVEL, levelForXp, xpToNextLevel } from './progression.js';

describe('levels', () => {
  test('start at level 1 with no XP', () => {
    expect(levelForXp(0)).toEqual({ level: 1, intoLevel: 0, needed: 50 });
  });

  test('level thresholds are cumulative', () => {
    expect(levelForXp(49).level).toBe(1);
    expect(levelForXp(50)).toEqual({ level: 2, intoLevel: 0, needed: 75 });
    expect(levelForXp(50 + 75 + 10)).toEqual({ level: 3, intoLevel: 10, needed: 100 });
  });

  test('caps at the max level', () => {
    expect(levelForXp(10_000_000)).toMatchObject({ level: MAX_LEVEL, needed: 0 });
  });

  test('ignores bad input', () => {
    expect(levelForXp(-5).level).toBe(1);
    expect(xpToNextLevel(1)).toBe(50);
  });
});
