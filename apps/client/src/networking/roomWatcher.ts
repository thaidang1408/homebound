import type { Room } from '@colyseus/sdk';
import {
  CREATURES,
  GamePhase,
  ServerMessage,
  StoveStatus,
  clockLabel,
  dayPhase,
  getItem,
  isCreatureKind,
  isItemId,
  type DayPhase,
  type HomeState,
} from '@homebound/shared';
import { getSession, updateSession } from '../state/session';
import { getUi, showToast, updateUi } from '../state/ui';

/** The low-frequency slice of room state the React UI cares about. */
interface Snapshot {
  key: string;
  day: number;
  stoveStatus: string;
  myHunger: number;
  myHealth: number;
  /** Creature ids currently lying dead. */
  carcasses: Set<string>;
  myXp: number;
  myLevel: number;
  sleeping: Map<string, boolean>;
  phase: DayPhase;
  /** My backpack totals per item id. */
  items: Map<string, number>;
}

function slots(list: Iterable<{ itemId: string; qty: number }>): string {
  return [...list].map((s) => `${s.itemId}:${s.qty}`).join(',');
}

function totals(list: Iterable<{ itemId: string; qty: number }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of list) if (s.qty > 0) out.set(s.itemId, (out.get(s.itemId) ?? 0) + s.qty);
  return out;
}

function snapshot(room: Room<HomeState>): Snapshot {
  const s = room.state;
  const players = [...s.players.entries()];
  const key = [
    s.phase,
    s.day,
    // 10-minute clock resolution: the HUD clock re-renders ~every 5 s, not every tick.
    clockLabel(s.timeOfDay),
    s.stove.status,
    s.stove.itemId,
    slots(s.chest),
    ...players.map(
      ([id, p]) =>
        `${id}|${p.name}|${p.slot}|${p.ready}|${p.connected}|${p.hunger}|${p.health}|${p.sleeping}|${p.xp}|${p.level}|${slots(p.inventory)}`,
    ),
    // Health and presence change only in fights; patrol movement doesn't re-render the UI.
    ...[...s.creatures.entries()].map(([id, c]) => `${id}:${c.health}:${c.present}`),
  ].join(';');
  return {
    key,
    day: s.day,
    stoveStatus: s.stove.status,
    myHunger: s.players.get(room.sessionId)?.hunger ?? 0,
    myHealth: s.players.get(room.sessionId)?.health ?? 0,
    carcasses: new Set(
      [...s.creatures.entries()].filter(([, c]) => c.present && c.health === 0).map(([id]) => id),
    ),
    myXp: s.players.get(room.sessionId)?.xp ?? 0,
    myLevel: s.players.get(room.sessionId)?.level ?? 1,
    sleeping: new Map(players.map(([id, p]) => [id, p.sleeping])),
    phase: dayPhase(s.timeOfDay),
    items: totals(s.players.get(room.sessionId)?.inventory ?? []),
  };
}

/** Feedback for things worth telling the player, derived from state changes. */
function announce(room: Room<HomeState>, prev: Snapshot, next: Snapshot): void {
  if (room.state.phase !== GamePhase.Playing) return;
  if (next.day > prev.day) showToast(`Day ${next.day} — good morning!`);
  if (next.stoveStatus === StoveStatus.Done && prev.stoveStatus !== StoveStatus.Done) {
    showToast('The food is ready!');
  }
  if (next.myHealth < prev.myHealth) updateUi({ hurtCount: getUi().hurtCount + 1 });
  for (const id of next.carcasses) {
    const kind = room.state.creatures.get(id)?.kind ?? '';
    if (prev.carcasses.has(id) || !isCreatureKind(kind)) continue;
    showToast(`${CREATURES[kind].name} down! Butcher it with E`);
  }
  const ate = next.myHunger - prev.myHunger;
  if (ate > 0) showToast(`+${ate} hunger`);
  for (const [id, qty] of next.items) {
    const gained = qty - (prev.items.get(id) ?? 0);
    if (gained > 0 && isItemId(id)) showToast(`+${gained} ${getItem(id).icon} ${getItem(id).name}`);
  }
  if (next.phase !== prev.phase) {
    if (next.phase === 'evening') showToast('The sun is setting — head home before dark.');
    if (next.phase === 'night') showToast('Night has fallen. Stay close to home.');
  }
  const earned = next.myXp - prev.myXp;
  if (earned > 0) showToast(`+${earned} XP`);
  if (next.myLevel > prev.myLevel) showToast(`⭐ Level ${next.myLevel}!`);

  for (const id of next.sleeping.keys()) {
    if (id === room.sessionId || prev.sleeping.has(id)) continue;
    showToast(`${room.state.players.get(id)?.name ?? 'Your partner'} came home`);
  }

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
  room.onMessage(ServerMessage.BlackedOut, () =>
    showToast('You blacked out… and woke up at home.'),
  );
  apply();
}
