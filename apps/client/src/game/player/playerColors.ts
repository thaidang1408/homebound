/**
 * Body colors by slot. 3D materials take hex values, so these live here rather than in CSS
 * tokens; the lobby uses the same colors so a player's card matches their body.
 */
const PLAYER_COLORS = ['#4f8fc9', '#d9734e'] as const;

export function playerColor(slot: number): string {
  return PLAYER_COLORS[slot - 1] ?? PLAYER_COLORS[0];
}
