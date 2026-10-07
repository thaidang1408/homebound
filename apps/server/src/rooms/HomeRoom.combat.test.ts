import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  ClientMessage,
  GamePhase,
  HEALTH_MAX,
  RESPAWN_HEALTH,
  REVIVE_HEALTH,
  REVIVE_MS,
  ROOM_NAME,
  ServerMessage,
  SPAWN_POINTS,
  XP_REWARDS,
  GOALS_PER_DAY,
  type DaySummaryPayload,
  type HomeState,
} from '@homebound/shared';
import {
  createHarness,
  newPlayerId,
  playerOf,
  self,
  EVENING,
  setTime,
  sleep,
  startGame,
  waitFor,
  walk,
} from '../test/harness.js';

const h = createHarness(2593);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

const TO_WORKBENCH = [{ x: 4.2, z: 3.0 }];
const TO_BED = [
  { x: 3.5, z: 1.8 },
  { x: 3.5, z: -1.5 },
  { x: 2.9, z: -3.2 },
];
const countIn = (slots: Iterable<{ itemId: string; qty: number }>, id: string) =>
  [...slots].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);

async function soloGame() {
  const room = await h.track(
    h.sdk.create<HomeState>(ROOM_NAME, { name: 'Solo', playerId: newPlayerId() }),
  );
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

describe('downed, revive, death', () => {
  test('alone, falling means waking up at home', async () => {
    const room = await soloGame();
    let died = false;
    room.onMessage(ServerMessage.Died, () => (died = true));
    await walk(room, [{ x: 0, z: 3 }]);
    room.send(ClientMessage.DevHurt, { amount: HEALTH_MAX });
    await waitFor(() => died && self(room).health < HEALTH_MAX);
    // Displayed health rounds up and regen starts at once: 50 or 51.
    expect(self(room).health - RESPAWN_HEALTH).toBeLessThanOrEqual(1);
    expect(self(room).health).toBeGreaterThanOrEqual(RESPAWN_HEALTH);
    expect(self(room).downed).toBe(false);
    expect(self(room).x).toBeCloseTo(SPAWN_POINTS[0]?.x ?? 0);
  });

  test('with a partner you go down, can not move, and they revive you', async () => {
    const { host, partner } = await h.createPair();
    await startGame(host, partner);
    host.send(ClientMessage.DevHurt, { amount: HEALTH_MAX });
    await waitFor(() => playerOf(partner, host.sessionId).downed);

    host.send(ClientMessage.Move, { x: -1.2, z: 1.5, yaw: 0, pitch: 0 });
    await sleep(150);
    expect(self(host).z).toBeCloseTo(SPAWN_POINTS[0]?.z ?? 0);

    await walk(partner, [{ x: -0.2, z: 2.6 }]);
    const xp = self(partner).xp;
    const holding = setInterval(
      () => partner.send(ClientMessage.Interact, { targetId: host.sessionId }),
      300,
    );
    try {
      await waitFor(() => !self(host).downed, REVIVE_MS + 2000);
    } finally {
      clearInterval(holding);
    }
    expect(self(host).health - REVIVE_HEALTH).toBeLessThanOrEqual(1);
    await waitFor(() => self(partner).xp === xp + XP_REWARDS.revive);
  });
});

describe('crafting and weapons', () => {
  test('craft a spear at the workbench, not from across the room', async () => {
    const room = await soloGame();
    room.send(ClientMessage.DevGive, { itemId: 'wood', qty: 3 });
    room.send(ClientMessage.DevGive, { itemId: 'stone', qty: 2 });
    await waitFor(() => countIn(self(room).inventory, 'stone') === 2);
    room.send(ClientMessage.Craft, { recipeId: 'spear' });
    await sleep(150);
    expect(countIn(self(room).inventory, 'spear')).toBe(0);

    await walk(room, TO_WORKBENCH);
    room.send(ClientMessage.Craft, { recipeId: 'spear' });
    await waitFor(() => countIn(self(room).inventory, 'spear') === 1);
    expect(countIn(self(room).inventory, 'wood')).toBe(0);
    // (+ the daily goal bonus if today's goal happens to be crafting)
    expect(self(room).xp).toBeGreaterThanOrEqual(XP_REWARDS.craft);
  });

  test('a bow uses one arrow per shot, with a cooldown', async () => {
    const room = await soloGame();
    room.send(ClientMessage.DevGive, { itemId: 'bow', qty: 1 }); // slot 0
    room.send(ClientMessage.DevGive, { itemId: 'arrow', qty: 3 });
    await waitFor(() => countIn(self(room).inventory, 'arrow') === 3);
    const fire = () =>
      room.send(ClientMessage.Attack, { slot: 0, targetId: '', yaw: 0, pitch: 0.1 });
    fire();
    fire(); // too soon
    await waitFor(() => countIn(self(room).inventory, 'arrow') === 2);
    await sleep(200);
    expect(countIn(self(room).inventory, 'arrow')).toBe(2);
  });
});

describe('the day loop', () => {
  test(
    'staying up past midnight still ends with the summary in the morning',
    { timeout: 20_000 },
    async () => {
      const room = await soloGame();
      let summary: DaySummaryPayload | undefined;
      room.onMessage(ServerMessage.DaySummary, (p: DaySummaryPayload) => (summary = p));
      await setTime(room, 0.997); // ~2 s before midnight
      await waitFor(() => room.state.day === 2, 6000);
      await sleep(300);
      expect(summary).toBeUndefined(); // not at midnight…
      await walk(room, TO_BED);
      room.send(ClientMessage.Interact, { targetId: 'bed' });
      await waitFor(() => summary !== undefined, 6000); // …but on waking up
      expect(summary?.day).toBe(1);
    },
  );

  test('sleeping ends the day with a summary and brings new goals', async () => {
    const room = await soloGame();
    expect(room.state.goals.length).toBe(GOALS_PER_DAY);
    let summary: DaySummaryPayload | undefined;
    room.onMessage(ServerMessage.DaySummary, (p: DaySummaryPayload) => (summary = p));

    await setTime(room, EVENING);
    await walk(room, [
      { x: 3.5, z: 1.8 },
      { x: 3.5, z: -1.5 },
      { x: 2.9, z: -3.2 },
    ]);
    room.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => summary !== undefined, 6000);
    expect(summary).toMatchObject({ day: 1, goalsTotal: GOALS_PER_DAY });
    await waitFor(() => room.state.day === 2);
    expect(room.state.goals.length).toBe(GOALS_PER_DAY);
    expect([...room.state.goals].every((g) => g.progress === 0)).toBe(true);
  });
});

describe('backpack', () => {
  test('drag a stack to another slot', async () => {
    const room = await soloGame();
    room.send(ClientMessage.DevGive, { itemId: 'wood', qty: 3 }); // slot 0
    await waitFor(() => self(room).inventory.at(0)?.itemId === 'wood');
    room.send(ClientMessage.MoveSlot, { container: 'player', from: 0, to: 7 });
    await waitFor(() => self(room).inventory.at(7)?.itemId === 'wood');
    expect(self(room).inventory.at(0)?.qty).toBe(0);
    // The chest can only be rearranged while standing at it.
    room.send(ClientMessage.MoveSlot, { container: 'chest', from: 0, to: 5 });
    await sleep(150);
    expect(room.state.chest.at(5)?.qty).toBe(0);
  });
});
