import { createRandom } from './random.js';

/**
 * Daily goals (ADR-018): every morning the home gets GOALS_PER_DAY shared goals. Both players
 * contribute; finishing one gives everyone GOAL_XP. Data only; the server counts progress.
 */
export interface GoalDefinition {
  icon: string;
  /** "Hunt 2 animals" */
  label: (target: number) => string;
  /** Target range, inclusive. */
  target: readonly [number, number];
}

export const GOALS = {
  hunt: { icon: '🐗', label: (n) => `Săn ${n} con thú`, target: [1, 3] },
  cook: { icon: '🍖', label: (n) => `Nấu ${n} món`, target: [2, 4] },
  gather: { icon: '🪵', label: (n) => `Nhặt ${n} gỗ hoặc đá`, target: [8, 16] },
  craft: { icon: '🔨', label: (n) => `Chế tạo ${n} món đồ`, target: [1, 2] },
} as const satisfies Record<string, GoalDefinition>;

export type GoalKind = keyof typeof GOALS;

export const GOALS_PER_DAY = 2;
export const GOAL_XP = 25;

export function isGoalKind(value: string): value is GoalKind {
  return Object.hasOwn(GOALS, value);
}

/** The goals for a day: deterministic per home and day, never the same kind twice. */
export function pickGoals(seed: number, day: number): { kind: GoalKind; target: number }[] {
  const random = createRandom(seed * 31 + day);
  const kinds = Object.keys(GOALS) as GoalKind[];
  const picked: { kind: GoalKind; target: number }[] = [];
  while (picked.length < GOALS_PER_DAY && kinds.length > 0) {
    const [kind] = kinds.splice(Math.floor(random() * kinds.length), 1);
    if (!kind) break;
    const [min, max] = GOALS[kind].target;
    picked.push({ kind, target: min + Math.floor(random() * (max - min + 1)) });
  }
  return picked;
}
