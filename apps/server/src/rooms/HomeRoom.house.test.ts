import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  BED_SPOTS,
  ClientMessage,
  HUNGER_START,
  NEW_DAY_DELAY_MS,
  ServerMessage,
  StoveStatus,
  type Point,
  type TeleportPayload,
} from '@homebound/shared';
import {
  EVENING,
  createHarness,
  setTime,
  playerOf,
  self,
  sleep,
  startGame,
  waitFor,
  walk,
} from '../test/harness.js';

const h = createHarness(2596);

beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

/** Paths from the living-room spawns that avoid walls and furniture. */
const TO_CHEST: Point[] = [{ x: -4.3, z: 2.9 }];
const TO_STOVE: Point[] = [
  { x: -3.5, z: 1.8 },
  { x: -3.5, z: -1.5 },
  { x: -4.4, z: -3.6 },
];
const TO_BED_LEFT: Point[] = [
  { x: 3.5, z: 1.8 },
  { x: 3.5, z: -1.5 },
  { x: 2.9, z: -3.2 },
];

const countIn = (slots: Iterable<{ itemId: string; qty: number }>, id: string) =>
  [...slots].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);

async function playingPair() {
  const pair = await h.createPair();
  await startGame(pair.host, pair.partner);
  return pair;
}

describe('home state', () => {
  test('day 1, starter meat in the shared chest, empty pockets', async () => {
    const { host } = await playingPair();
    expect(host.state.day).toBe(1);
    expect(countIn(host.state.chest, 'raw_meat')).toBeGreaterThan(0);
    expect(countIn(self(host).inventory, 'raw_meat')).toBe(0);
    expect(self(host).hunger).toBe(HUNGER_START);
  });
});

describe('shared chest', () => {
  test('cannot be used from across the house', async () => {
    const { host } = await playingPair();
    host.send(ClientMessage.Transfer, { from: 'chest', slot: 0 });
    await sleep(150);
    expect(countIn(self(host).inventory, 'raw_meat')).toBe(0);
  });

  test('take from and put back into the chest; the partner sees it', async () => {
    const { host, partner } = await playingPair();
    const inChest = countIn(host.state.chest, 'raw_meat');
    await walk(host, TO_CHEST);

    host.send(ClientMessage.Transfer, { from: 'chest', slot: 0 });
    await waitFor(() => countIn(self(host).inventory, 'raw_meat') === inChest);
    expect(countIn(partner.state.chest, 'raw_meat')).toBe(0);

    host.send(ClientMessage.Transfer, { from: 'player', slot: 0 });
    await waitFor(() => countIn(partner.state.chest, 'raw_meat') === inChest);
  });
});

describe('eating and cooking', () => {
  test('eating raw meat from the hotbar restores a little hunger', async () => {
    const { host } = await playingPair();
    await walk(host, TO_CHEST);
    host.send(ClientMessage.Transfer, { from: 'chest', slot: 0 });
    await waitFor(() => countIn(self(host).inventory, 'raw_meat') > 0);
    const before = countIn(self(host).inventory, 'raw_meat');

    host.send(ClientMessage.UseItem, { slot: 0 });
    await waitFor(() => countIn(self(host).inventory, 'raw_meat') === before - 1);
    expect(self(host).hunger).toBeGreaterThan(HUNGER_START);
  });

  test('cook at the stove only when standing next to it', async () => {
    const { host } = await playingPair();
    await walk(host, TO_CHEST);
    host.send(ClientMessage.Transfer, { from: 'chest', slot: 0 });
    await waitFor(() => countIn(self(host).inventory, 'raw_meat') > 0);

    host.send(ClientMessage.Interact, { targetId: 'stove' });
    await sleep(150);
    expect(host.state.stove.status).toBe(StoveStatus.Idle);

    await walk(host, [{ x: -3.5, z: 2.0 }, ...TO_STOVE.slice(1)]);
    host.send(ClientMessage.Interact, { targetId: 'stove' });
    await waitFor(() => host.state.stove.status === StoveStatus.Cooking);
    expect(host.state.stove.itemId).toBe('raw_meat');
  });

  test('unknown furniture ids are ignored', async () => {
    const { host } = await playingPair();
    host.send(ClientMessage.Interact, { targetId: 'fridge-of-infinite-meat' });
    host.send(ClientMessage.Interact, { targetId: 42 });
    await sleep(150);
    expect(host.connection.isOpen).toBe(true);
  });
});

describe('walls', () => {
  test('walking into furniture is rejected with a correction', async () => {
    const { host } = await playingPair();
    await walk(host, [{ x: -1.2, z: 1.7 }]);
    const correction = new Promise<TeleportPayload>((resolve) =>
      host.onMessage(ServerMessage.Teleport, resolve),
    );
    // The sofa spans z 0.45–1.25.
    host.send(ClientMessage.Move, { x: -1.2, z: 1.3, yaw: 0, pitch: 0 });
    expect((await correction).z).toBeCloseTo(1.7, 4);
  });
});

describe('sleep', () => {
  test('both players in bed start a new day; getting up first cancels it', async () => {
    const { host, partner } = await playingPair();
    const toBedRight = TO_BED_LEFT.map((p) => ({ x: p.x, z: p.z + 1.2 }));
    await Promise.all([walk(host, TO_BED_LEFT), walk(partner, toBedRight)]);

    await setTime(host, EVENING);

    host.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => playerOf(partner, host.sessionId).sleeping);
    expect(self(host).x).toBeCloseTo(BED_SPOTS[0]?.sleep.x ?? NaN, 4);

    await setTime(partner, EVENING);

    partner.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => self(partner).sleeping);
    await setTime(partner, EVENING);
    partner.send(ClientMessage.Interact, { targetId: 'bed' }); // changes their mind
    await waitFor(() => !self(partner).sleeping);
    await sleep(NEW_DAY_DELAY_MS + 300);
    expect(host.state.day).toBe(1);

    await setTime(partner, EVENING);

    partner.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => host.state.day === 2, NEW_DAY_DELAY_MS + 2000);
    expect(self(host).sleeping || self(partner).sleeping).toBe(false);
  }, 15000);

  test('beds cannot be used during the day', async () => {
    const { host } = await playingPair();
    await walk(host, TO_BED_LEFT);
    await setTime(host, 0.5);
    host.send(ClientMessage.Interact, { targetId: 'bed' });
    await sleep(200);
    expect(self(host).sleeping).toBe(false);
  });

  test('moves are ignored while asleep', async () => {
    const { host } = await playingPair();
    await walk(host, TO_BED_LEFT);
    await setTime(host, EVENING);
    host.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => self(host).sleeping);
    const { x, z } = self(host);
    host.send(ClientMessage.Move, { x: x - 0.3, z, yaw: 0, pitch: 0 });
    await sleep(150);
    expect(self(host).x).toBe(x);
  });
});
