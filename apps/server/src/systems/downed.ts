import {
  BLEED_OUT_MS,
  HUNGER_MAX,
  INTERACT_RANGE,
  INTERACT_TOLERANCE,
  RESPAWN_HEALTH,
  RESPAWN_MIN_HUNGER,
  REVIVE_HEALTH,
  REVIVE_MS,
  REVIVE_PING_TIMEOUT_MS,
  SPAWN_POINTS,
  type HomeState,
  type PlayerState,
  type Point,
} from '@homebound/shared';
import { setHealth } from './needs.js';

/**
 * Downed → revive or death (ADR-017). At 0 health a player falls and bleeds out over
 * BLEED_OUT_MS; their partner holds [E] next to them for REVIVE_MS to get them up (bleeding pauses
 * meanwhile). Nobody able to help, or bleeding out, means death: wake up at home, items kept.
 */

const REVIVE_REACH = INTERACT_RANGE + INTERACT_TOLERANCE;

/** A partner who could come and help: connected and on their feet (a sleeper can get up). */
function canHelp(state: HomeState, exceptId: string): boolean {
  for (const [id, p] of state.players) {
    if (id !== exceptId && p.connected && !p.downed) return true;
  }
  return false;
}

/** Puts a player on the ground. Returns 'dead' straight away if nobody could revive them. */
export function knockDown(state: HomeState, sessionId: string): 'downed' | 'dead' {
  const player = state.players.get(sessionId);
  if (!player) return 'downed';
  if (!canHelp(state, sessionId)) return 'dead';
  player.downed = true;
  player.bleedMs = BLEED_OUT_MS;
  player.bleedOut = 1;
  player.reviveMs = 0;
  player.revive = 0;
  player.reviverId = '';
  return 'downed';
}

/** Wakes a dead player at their spawn point. Returns where they were moved to. */
export function respawn(player: PlayerState): Point {
  const spawn = SPAWN_POINTS[player.slot - 1] ?? SPAWN_POINTS[0] ?? { x: 0, z: 0 };
  player.downed = false;
  player.revive = 0;
  player.reviverId = '';
  player.x = spawn.x;
  player.z = spawn.z;
  setHealth(player, RESPAWN_HEALTH);
  if (player.hungerExact < RESPAWN_MIN_HUNGER) {
    player.hungerExact = Math.min(HUNGER_MAX, RESPAWN_MIN_HUNGER);
    player.hunger = Math.ceil(player.hungerExact);
  }
  return spawn;
}

/** The reviver is holding [E] on a downed player. Returns false if that's not possible. */
export function pingRevive(
  state: HomeState,
  reviverId: string,
  targetId: string,
  now: number,
): boolean {
  const reviver = state.players.get(reviverId);
  const target = state.players.get(targetId);
  if (!reviver || !target || reviverId === targetId || !target.downed || reviver.downed) {
    return false;
  }
  if (Math.hypot(reviver.x - target.x, reviver.z - target.z) > REVIVE_REACH) return false;
  if (target.reviverId !== reviverId) target.reviveMs = 0; // a new helper starts over
  target.reviverId = reviverId;
  target.revivePingAt = now;
  return true;
}

export type DownedEvent =
  { type: 'revived'; sessionId: string; reviverId: string } | { type: 'died'; sessionId: string };

/** Advances bleeding and revives. */
export function tickDowned(state: HomeState, dtMs: number, now: number): DownedEvent[] {
  const events: DownedEvent[] = [];
  for (const [id, p] of state.players) {
    if (!p.downed) continue;
    const reviver = p.reviverId ? state.players.get(p.reviverId) : undefined;
    const reviving =
      !!reviver &&
      reviver.connected &&
      !reviver.downed &&
      now - p.revivePingAt <= REVIVE_PING_TIMEOUT_MS &&
      Math.hypot(reviver.x - p.x, reviver.z - p.z) <= REVIVE_REACH;

    if (reviving) {
      p.reviveMs += dtMs;
      if (p.reviveMs >= REVIVE_MS) {
        p.downed = false;
        p.revive = 0;
        setHealth(p, REVIVE_HEALTH);
        events.push({ type: 'revived', sessionId: id, reviverId: p.reviverId });
        p.reviverId = '';
        continue;
      }
    } else {
      p.reviveMs = 0;
      p.bleedMs -= dtMs;
    }
    p.revive = Math.min(1, p.reviveMs / REVIVE_MS);
    p.bleedOut = Math.max(0, p.bleedMs / BLEED_OUT_MS);
    if (p.bleedMs <= 0 || !canHelp(state, id)) events.push({ type: 'died', sessionId: id });
  }
  return events;
}
