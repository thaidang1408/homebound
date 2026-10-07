/** XP granted per event. Data, not code: tune here, add events here. */
export const XP_REWARDS = {
  /** The player who put food on the stove, when it finishes. */
  cookMeal: 10,
  /** Each player who sleeps through to a new day. */
  sleepNight: 20,
  /** Each harvest of a tree, rock or bush. */
  gather: 2,
  /** Each item crafted at the workbench. */
  craft: 5,
  /** Reviving your downed partner. */
  revive: 15,
} as const;

export const MAX_LEVEL = 50;

/** XP needed to go from `level` to `level + 1`. Gentle linear curve: 50, 75, 100, … */
export function xpToNextLevel(level: number): number {
  return 50 + 25 * (level - 1);
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level needs in total (0 at max level). */
  needed: number;
}

/** Level reached with `totalXp`, and progress toward the next one. */
export function levelForXp(totalXp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < MAX_LEVEL && remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return { level, intoLevel: remaining, needed: level < MAX_LEVEL ? xpToNextLevel(level) : 0 };
}
