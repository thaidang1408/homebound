import type { Room } from '@colyseus/sdk';
import {
  CREATURES,
  GOALS,
  CHAPTERS,
  domLine,
  GOAL_XP,
  GamePhase,
  PETS,
  ServerMessage,
  StoveStatus,
  clockLabel,
  dayPhase,
  getBuff,
  getItem,
  isBuffId,
  isCreatureKind,
  isGoalKind,
  isItemId,
  isPetKind,
  findLandmark,
  type ChatBroadcast,
  type PingBroadcast,
  type DayPhase,
  type DaySummaryPayload,
  type HitConfirmPayload,
  type HomeState,
} from '@homebound/shared';
import { getSession, updateSession } from '../state/session';
import {
  playBell,
  playDowned,
  playEat,
  playFanfare,
  playHit,
  playHowl,
  playHurt,
  playPingAt,
  playPickup,
  playRevived,
  playUiClick,
} from '../audio/sounds';
import { addChatLine, clearChat } from '../state/chat';
import { addPing } from '../state/pings';
import { getUi, showToast, updateUi } from '../state/ui';

/** Story lines stay up long enough to read. */
const STORY_TOAST_MS = 8000;

/** The low-frequency slice of room state the React UI cares about. */
interface Snapshot {
  key: string;
  day: number;
  /** Pans with food ready to take. */
  stoveDone: number;
  myHunger: number;
  myHealth: number;
  /** Creature ids currently lying dead. */
  carcasses: Set<string>;
  myXp: number;
  myLevel: number;
  /** Goals finished so far today, by "kind:target" (a new day resets them). */
  goalsDone: Set<string>;
  sleeping: Map<string, boolean>;
  downed: Map<string, boolean>;
  phase: DayPhase;
  /** My backpack totals per item id. */
  items: Map<string, number>;
  /** Traps that have gone off. */
  sprung: Set<string>;
  myBuff: string;
  /** Pet id → kind ('' = egg), for hatch and befriend toasts. */
  pets: Map<string, string>;
  /** Landmarks discovered so far. */
  discovered: Set<string>;
  /** Where the story is: "chapter.step". */
  quest: string;
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
    [...s.pans].map((p) => `${p.status}:${p.itemId}`).join(','),
    ...[...s.drops.entries()].map(([id, d]) => `${id}:${d.itemId}:${d.qty}`),
    [...s.goals].map((g) => `${g.kind}:${g.progress}/${g.target}`).join(','),
    slots(s.chest),
    ...players.map(
      ([id, p]) =>
        `${id}|${p.name}|${p.slot}|${p.ready}|${p.connected}|${p.hunger}|${p.health}|${p.sleeping}|${p.downed}|${p.downed ? `${Math.round(p.bleedOut * 20)}/${Math.round(p.revive * 20)}` : ''}|${p.xp}|${p.level}|${p.selectedSlot}|${slots(p.inventory)}|${slots(p.equipment)}|${p.crouching}|${p.buff}:${p.buffLeft}`,
    ),
    // Health and presence change only in fights; patrol movement doesn't re-render the UI.
    ...[...s.creatures.entries()].map(([id, c]) => `${id}:${c.health}:${c.present}`),
    ...[...s.traps.entries()].map(([id, t]) => `${id}:${t.kind}:${t.sprung}`),
    // Pets: hatching in 5% steps, names, orders and who's home; wild pets' trust.
    ...[...s.pets.entries()].map(
      ([id, p]) =>
        `${id}:${p.kind}:${p.name}:${p.order}:${p.ownerSession}:${Math.round(p.hatch * 20)}`,
    ),
    ...[...s.creatures.values()].map((c) => c.trust),
    // Exploration: discoveries, emptied caches and map markers (the fog is drawn by the map).
    [...s.discovered.keys()].join(','),
    [...s.caches.keys()].join(','),
    s.markers.size,
    `${s.quest.chapter}.${s.quest.step}.${s.quest.progress}`,
    [...s.lanterns.keys()].join(','),
  ].join(';');
  return {
    key,
    day: s.day,
    stoveDone: [...s.pans].filter((p) => p.status === StoveStatus.Done).length,
    myHunger: s.players.get(room.sessionId)?.hunger ?? 0,
    myHealth: s.players.get(room.sessionId)?.health ?? 0,
    carcasses: new Set(
      [...s.creatures.entries()].filter(([, c]) => c.present && c.health === 0).map(([id]) => id),
    ),
    myXp: s.players.get(room.sessionId)?.xp ?? 0,
    myLevel: s.players.get(room.sessionId)?.level ?? 1,
    goalsDone: new Set(
      [...s.goals].filter((g) => g.progress >= g.target).map((g) => `${g.kind}:${g.target}`),
    ),
    sleeping: new Map(players.map(([id, p]) => [id, p.sleeping])),
    downed: new Map(players.map(([id, p]) => [id, p.downed])),
    phase: dayPhase(s.timeOfDay),
    items: totals(s.players.get(room.sessionId)?.inventory ?? []),
    sprung: new Set([...s.traps.entries()].filter(([, t]) => t.sprung).map(([id]) => id)),
    myBuff: s.players.get(room.sessionId)?.buff ?? '',
    pets: new Map([...s.pets.entries()].map(([id, p]) => [id, p.kind])),
    discovered: new Set(s.discovered.keys()),
    quest: `${s.quest.chapter}.${s.quest.step}`,
  };
}

/** Feedback for things worth telling the player, derived from state changes. */
function announce(room: Room<HomeState>, prev: Snapshot, next: Snapshot): void {
  if (room.state.phase !== GamePhase.Playing) return;
  if (next.day > prev.day) showToast(`Ngày ${next.day} — chào buổi sáng!`);
  if (next.stoveDone > prev.stoveDone) {
    showToast('Đồ ăn chín rồi!');
    playBell();
  }
  if (next.myHealth < prev.myHealth) {
    updateUi({ hurtCount: getUi().hurtCount + 1 });
    playHurt();
  }
  for (const id of next.carcasses) {
    const kind = room.state.creatures.get(id)?.kind ?? '';
    if (prev.carcasses.has(id) || !isCreatureKind(kind)) continue;
    showToast(`${CREATURES[kind].name} gục rồi! Bấm E để xẻ thịt`);
  }
  for (const id of next.sprung) {
    if (prev.sprung.has(id)) continue;
    const kind = room.state.traps.get(id)?.kind;
    showToast(kind === 'snare' ? '🪢 Bẫy dây bắt được gì đó!' : '🔺 Bẫy chông trúng gì đó!');
  }
  if (next.quest !== prev.quest) {
    // The story moved on: Đốm's line about it, and the chapter's end if it was the last step.
    const [chapter = 0, step = 0] = next.quest.split('.').map(Number);
    const ended = step === 0 && chapter > 0 ? CHAPTERS[chapter - 1] : undefined;
    const line = domLine(room.state.quest.chapter, room.state.quest.step).split('\n')[0];
    if (line) showToast(`🏮 Đốm: ${line}`, STORY_TOAST_MS);
    if (ended) {
      showToast(`📖 Xong chương: ${ended.title} — có trang nhật ký mới để đọc [J]`, STORY_TOAST_MS);
      playFanfare();
    } else playBell();
  }
  for (const id of next.discovered) {
    const l = findLandmark(id);
    if (prev.discovered.has(id) || !l) continue;
    showToast(`🗺️ Đã khám phá: ${l.icon} ${l.name} — đá dịch chuyển đã sáng`);
    playFanfare();
  }
  for (const [id, kind] of next.pets) {
    const pet = room.state.pets.get(id);
    if (!pet || !isPetKind(kind) || prev.pets.get(id) === kind) continue;
    const mine = pet.ownerSession === room.sessionId;
    const owner = room.state.players.get(pet.ownerSession)?.name ?? 'Bạn đồng hành';
    const what = `${PETS[kind].icon} ${PETS[kind].name.toLowerCase()}`;
    if (prev.pets.has(id)) {
      showToast(
        mine
          ? `🐣 Trứng của bạn đã nở: ${what}! Bấm E để nói chuyện`
          : `🐣 Trứng của ${owner} đã nở: ${what}!`,
      );
    } else {
      showToast(
        mine
          ? `💕 ${what} đã thành thú cưng của bạn! Bấm E để nói chuyện`
          : `💕 ${owner} đã kết bạn với ${what}!`,
      );
    }
    playFanfare();
  }
  if (next.myBuff && next.myBuff !== prev.myBuff && isBuffId(next.myBuff)) {
    const buff = getBuff(next.myBuff);
    const what = 'regen' in buff ? 'hồi máu nhanh hơn nhiều' : 'thú khó phát hiện bạn hơn';
    showToast(
      `${buff.icon} ${buff.name}: ${what} trong ${Math.round(buff.durationMs / 60_000)} phút`,
    );
  }
  const ate = next.myHunger - prev.myHunger;
  if (ate > 0) {
    showToast(`+${ate} no`);
    playEat();
  }
  // Loot and XP from one action go in a single toast ("+1 🪵 Wood · +2 XP").
  const gains: string[] = [];
  for (const [id, qty] of next.items) {
    const gained = qty - (prev.items.get(id) ?? 0);
    if (gained > 0 && isItemId(id))
      gains.push(`+${gained} ${getItem(id).icon} ${getItem(id).name}`);
  }
  if ([...next.items].some(([id, qty]) => qty > (prev.items.get(id) ?? 0))) playPickup();
  if (next.phase !== prev.phase) {
    if (next.phase === 'evening') showToast('Mặt trời sắp lặn — về nhà trước khi trời tối nhé.');
    if (next.phase === 'night') {
      showToast('Trời tối rồi — sói đã ra ngoài. Ở gần nhà nhé.');
      playHowl();
    }
  }
  const earned = next.myXp - prev.myXp;
  if (earned > 0) gains.push(`+${earned} KN`);
  if (gains.length > 0) showToast(gains.join(' · '));
  if (next.myLevel > prev.myLevel) {
    showToast(`⭐ Cấp ${next.myLevel}!`);
    playFanfare();
  }
  if (next.day === prev.day) {
    for (const g of room.state.goals) {
      const key = `${g.kind}:${g.target}`;
      if (!next.goalsDone.has(key) || prev.goalsDone.has(key) || !isGoalKind(g.kind)) continue;
      showToast(`✅ Xong mục tiêu: ${GOALS[g.kind].label(g.target)} (mỗi người +${GOAL_XP} KN)`);
      playFanfare();
    }
  }

  for (const id of next.sleeping.keys()) {
    if (id === room.sessionId || prev.sleeping.has(id)) continue;
    showToast(`${room.state.players.get(id)?.name ?? 'Bạn đồng hành'} đã về nhà`);
  }

  for (const [id, down] of next.downed) {
    const was = prev.downed.get(id) ?? false;
    if (down === was) continue;
    const name = room.state.players.get(id)?.name ?? 'Bạn đồng hành';
    if (down) playDowned();
    else playRevived();
    if (id === room.sessionId) {
      showToast(down ? 'Bạn bị gục! Cố lên…' : 'Bạn đứng dậy rồi!');
    } else {
      showToast(down ? `${name} bị gục! Đứng gần và giữ E để cứu` : `${name} đã đứng dậy`);
    }
  }

  for (const [id, sleeping] of next.sleeping) {
    if (id === room.sessionId || !sleeping || prev.sleeping.get(id)) continue;
    const name = room.state.players.get(id)?.name ?? 'Bạn đồng hành';
    showToast(`${name} đã đi ngủ`);
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
  clearChat();
  room.onMessage(ServerMessage.Chat, (m: ChatBroadcast) => {
    const mine = m.from === room.sessionId;
    addChatLine(m, mine);
    if (!mine) playUiClick();
  });
  room.onMessage(ServerMessage.Ping, (p: PingBroadcast) => {
    addPing(p, p.from === room.sessionId);
    playPingAt(p.x, p.z);
  });
  room.onMessage(ServerMessage.Died, () =>
    showToast('Bạn ngất đi… và tỉnh dậy ở nhà. Đồ đạc vẫn còn nguyên.'),
  );
  room.onMessage(ServerMessage.DaySummary, (summary: DaySummaryPayload) => updateUi({ summary }));
  room.onMessage(ServerMessage.HitConfirm, (p: HitConfirmPayload) => {
    updateUi({ hitCount: getUi().hitCount + 1, lastHitKilled: p.killed });
    playHit(p.killed);
  });
  apply();
}
