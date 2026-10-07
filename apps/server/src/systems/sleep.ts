import { BED_SPOTS, type HomeState, type PlayerState, type Point } from '@homebound/shared';

function bedSpot(player: PlayerState) {
  return (
    BED_SPOTS[player.slot - 1] ?? BED_SPOTS[0] ?? { sleep: { x: 0, z: 0 }, wake: { x: 0, z: 0 } }
  );
}

/** Lies down or gets up. Returns the position the server moved the player to. */
export function toggleSleep(player: PlayerState): Point {
  player.sleeping = !player.sleeping;
  const spot = bedSpot(player);
  const target = player.sleeping ? spot.sleep : spot.wake;
  player.x = target.x;
  player.z = target.z;
  return target;
}

/** A new day needs every player in the room asleep (a partner who is reconnecting is not). */
export function everyoneAsleep(state: HomeState): boolean {
  const players = [...state.players.values()];
  return players.length > 0 && players.every((p) => p.sleeping && p.connected);
}

/** Advances the day and wakes everyone. Returns the players that were moved, with targets. */
export function startNewDay(state: HomeState): { player: PlayerState; target: Point }[] {
  state.day += 1;
  return [...state.players.values()].map((player) => ({ player, target: toggleSleep(player) }));
}
