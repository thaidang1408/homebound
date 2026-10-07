import {
  GoalState,
  pickGoals,
  type DaySummaryPayload,
  type GoalKind,
  type HomeState,
} from '@homebound/shared';

/** Daily goals and the day's stats (ADR-018). Pure rules on state; the room grants the XP. */

/** A stable number from a home code, so each home has its own sequence of daily goals. */
export function goalSeed(code: string): number {
  let h = 0;
  for (const ch of code) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function setGoals(state: HomeState, seed: number): void {
  state.goals.clear();
  for (const { kind, target } of pickGoals(seed, state.day)) {
    const g = new GoalState();
    g.kind = kind;
    g.target = target;
    state.goals.push(g);
  }
}

/** Adds progress to today's goals of `kind`. Returns how many goals this just completed. */
export function progressGoal(state: HomeState, kind: GoalKind, amount = 1): number {
  let completed = 0;
  for (const g of state.goals) {
    if (g.kind !== kind || g.progress >= g.target) continue;
    g.progress = Math.min(g.target, g.progress + amount);
    if (g.progress >= g.target) completed++;
  }
  return completed;
}

/** The day that is ending, as a summary; then clears the stats for tomorrow. */
export function closeDay(state: HomeState, day: number): DaySummaryPayload {
  const { today } = state;
  const summary: DaySummaryPayload = {
    day,
    hunted: today.hunted,
    meals: today.meals,
    gathered: today.gathered,
    crafted: today.crafted,
    revives: today.revives,
    goalsDone: [...state.goals].filter((g) => g.progress >= g.target).length,
    goalsTotal: state.goals.length,
  };
  today.hunted = 0;
  today.meals = 0;
  today.gathered = 0;
  today.crafted = 0;
  today.revives = 0;
  return summary;
}
