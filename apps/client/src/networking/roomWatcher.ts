import type { Room } from '@colyseus/sdk';
import { GamePhase, StoveStatus, type HomeState } from '@homebound/shared';
import { getSession, updateSession } from '../state/session';
import { showToast } from '../state/ui';

/** The low-frequency slice of room state the React UI cares about. */
interface Snapshot {
  key: string;
  day: number;
  stoveStatus: string;
  myHunger: number;
  sleeping: Map<string, boolean>;
}

function slots(list: Iterable<{ itemId: string; qty: number }>): string {
  return [...list].map((s) => `${s.itemId}:${s.qty}`).join(',');
}

function snapshot(room: Room<HomeState>): Snapshot {
  const s = room.state;
  const players = [...s.players.entries()];
  const key = [
    s.phase,
    s.day,
    s.stove.status,
    s.stove.itemId,
    slots(s.chest),
    ...players.map(
      ([id, p]) =>
        `${id}|${p.name}|${p.slot}|${p.ready}|${p.connected}|${p.hunger}|${p.sleeping}|${slots(p.inventory)}`,
    ),
  ].join(';');
  return {
    key,
    day: s.day,
    stoveStatus: s.stove.status,
    myHunger: s.players.get(room.sessionId)?.hunger ?? 0,
    sleeping: new Map(players.map(([id, p]) => [id, p.sleeping])),
  };
}

/** Feedback for things worth telling the player, derived from state changes. */
function announce(room: Room<HomeState>, prev: Snapshot, next: Snapshot): void {
  if (room.state.phase !== GamePhase.Playing) return;
  if (next.day > prev.day) showToast(`Day ${next.day} — good morning!`);
  if (next.stoveStatus === StoveStatus.Done && prev.stoveStatus !== StoveStatus.Done) {
    showToast('The food is ready!');
  }
  const ate = next.myHunger - prev.myHunger;
  if (ate > 0) showToast(`+${ate} hunger`);

  for (const [id, sleeping] of next.sleeping) {
    if (id === room.sessionId || !sleeping || prev.sleeping.get(id)) continue;
    const name = room.state.players.get(id)?.name ?? 'Your partner';
    showToast(`${name} went to bed`);
  }
}

/**
 * Re-renders the UI only when the UI-relevant slice changes. Patches arrive ~20×/s while
 * players move; building this key is cheap and avoids wiring per-field callbacks.
 */
export function watchRoom(room: Room<HomeState>): void {
  let prev = snapshot(room);
  const apply = () => {
    const next = snapshot(room);
    if (next.key === prev.key) return;
    announce(room, prev, next);
    prev = next;
    updateSession({
      screen: room.state.phase === GamePhase.Playing ? 'game' : 'lobby',
      version: getSession().version + 1,
    });
  };
  room.onStateChange(apply);
  apply();
}
