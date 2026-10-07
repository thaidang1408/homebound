import { levelForXp, type PlayerState } from '@homebound/shared';

/** Adds XP and recomputes the level. Returns how many levels were gained. */
export function grantXp(player: PlayerState, amount: number): number {
  if (amount <= 0) return 0;
  const before = player.level;
  player.xp += Math.floor(amount);
  player.level = levelForXp(player.xp).level;
  return player.level - before;
}
