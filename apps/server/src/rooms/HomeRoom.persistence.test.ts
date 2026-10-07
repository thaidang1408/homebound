import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  COOK_TIME_MS,
  ClientMessage,
  GamePhase,
  JoinError,
  NEW_DAY_DELAY_MS,
  ROOM_NAME,
  XP_REWARDS,
  type HomeState,
  type Point,
} from '@homebound/shared';
import type { Room } from '@colyseus/sdk';
import { createHarness, newPlayerId, self, sleep, waitFor, walk } from '../test/harness.js';

const h = createHarness(2595);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

const TO_CHEST: Point[] = [{ x: -4.3, z: 2.9 }];
const TO_STOVE: Point[] = [
  { x: -3.5, z: 1.8 },
  { x: -3.5, z: -1.5 },
  { x: -4.4, z: -3.6 },
];
const TO_BED: Point[] = [
  { x: 3.5, z: 1.8 },
  { x: 3.5, z: -1.5 },
  { x: 2.9, z: -3.2 },
];

const countIn = (slots: Iterable<{ itemId: string; qty: number }>, id: string) =>
  [...slots].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);

async function soloGame(playerId = newPlayerId(), name = 'Solo') {
  const room = await h.track(h.sdk.create<HomeState>(ROOM_NAME, { name, playerId }));
  await waitFor(() => room.state?.players?.size === 1);
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

async function leaveAndWaitForSave(room: Room<HomeState>) {
  const code = room.roomId;
  await room.leave();
  // The last player leaving disposes the room, which saves and frees the code.
  await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
  await sleep(100);
  return code;
}

function reopen(code: string, playerId: string, name = 'Back') {
  return h.track(h.sdk.create<HomeState>(ROOM_NAME, { name, playerId, restoreCode: code }));
}

describe('solo and drop-in', () => {
  test('one player can start alone without readying up', async () => {
    const room = await soloGame();
    expect(room.state.players.size).toBe(1);
  });

  test('the partner joins a running home straight into the game', async () => {
    const host = await soloGame();
    const partner = await h.track(
      h.sdk.joinById<HomeState>(host.roomId, { name: 'Late', playerId: newPlayerId() }),
    );
    await waitFor(() => partner.state?.players?.size === 2);
    expect(partner.state.phase).toBe(GamePhase.Playing);
  });

  test('a lone sleeper starts the next day', async () => {
    const room = await soloGame();
    await walk(room, TO_BED);
    room.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => room.state.day === 2, NEW_DAY_DELAY_MS + 2000);
  });
});

describe('identity', () => {
  test('a missing or malformed player id is refused', async () => {
    await expect(h.sdk.create(ROOM_NAME, { name: 'X' })).rejects.toThrow(JoinError.InvalidPlayer);
    await expect(h.sdk.create(ROOM_NAME, { name: 'X', playerId: 'short' })).rejects.toThrow();
  });

  test('the same player cannot be in a home twice (two tabs)', async () => {
    const id = newPlayerId();
    const host = await soloGame(id);
    await expect(h.sdk.joinById(host.roomId, { name: 'Tab 2', playerId: id })).rejects.toThrow(
      JoinError.AlreadyInHome,
    );
  });
});

describe('saving and re-opening a home', () => {
  test('items, chest, day and position come back for the same player', async () => {
    const id = newPlayerId();
    const room = await soloGame(id);
    const chestBefore = countIn(room.state.chest, 'raw_meat');
    await walk(room, TO_CHEST);
    room.send(ClientMessage.Transfer, { from: 'chest', slot: 0 });
    await waitFor(() => countIn(self(room).inventory, 'raw_meat') === chestBefore);
    const code = await leaveAndWaitForSave(room);

    const back = await reopen(code, id);
    await waitFor(() => back.state?.players?.size === 1);
    expect(back.roomId).toBe(code);
    expect(back.state.phase).toBe(GamePhase.Playing);
    expect(countIn(self(back).inventory, 'raw_meat')).toBe(chestBefore);
    expect(countIn(back.state.chest, 'raw_meat')).toBe(0);
    expect(self(back).x).toBeCloseTo(TO_CHEST[0]?.x ?? NaN, 1);
    expect(self(back).name).toBe('Back');
  });

  test('a new player in a saved home starts fresh while the chest is shared', async () => {
    const room = await soloGame();
    const code = await leaveAndWaitForSave(room);
    const stranger = await reopen(code, newPlayerId());
    await waitFor(() => stranger.state?.players?.size === 1);
    expect(countIn(self(stranger).inventory, 'raw_meat')).toBe(0);
    expect(countIn(stranger.state.chest, 'raw_meat')).toBeGreaterThan(0);
  });

  test('unknown codes are refused', async () => {
    await expect(reopen('QQQQQ', newPlayerId())).rejects.toThrow(JoinError.HomeNotFound);
    await expect(reopen('../x', newPlayerId())).rejects.toThrow(JoinError.HomeNotFound);
  });

  test('a home that is already open cannot be opened twice; joining it works', async () => {
    const id = newPlayerId();
    const room = await soloGame(id);
    const code = await leaveAndWaitForSave(room);
    const first = await reopen(code, id);
    await expect(reopen(code, newPlayerId())).rejects.toThrow(JoinError.HomeAlreadyOpen);
    const partner = await h.track(
      h.sdk.joinById<HomeState>(code, { name: 'P', playerId: newPlayerId() }),
    );
    await waitFor(() => first.state.players.size === 2 && partner.state?.players?.size === 2);
  });

  test('a home that was never started is not saved', async () => {
    const room = await h.track(
      h.sdk.create<HomeState>(ROOM_NAME, { name: 'L', playerId: newPlayerId() }),
    );
    await waitFor(() => room.state?.players?.size === 1);
    const code = room.roomId;
    await room.leave();
    await sleep(200);
    expect(existsSync(join(h.saveDir, `${code}.json`))).toBe(false);
  });
});

describe('XP and levels', () => {
  test('the cook earns XP when the food is done, and keeps it after re-opening', async () => {
    const id = newPlayerId();
    const room = await soloGame(id);
    await walk(room, TO_CHEST);
    room.send(ClientMessage.Transfer, { from: 'chest', slot: 0 });
    await waitFor(() => countIn(self(room).inventory, 'raw_meat') > 0);
    await walk(room, [{ x: -3.5, z: 2.0 }, ...TO_STOVE.slice(1)]);
    room.send(ClientMessage.Interact, { targetId: 'stove' });
    await waitFor(() => self(room).xp === XP_REWARDS.cookMeal, COOK_TIME_MS + 2000);

    const code = await leaveAndWaitForSave(room);
    const back = await reopen(code, id);
    await waitFor(() => back.state?.players?.size === 1);
    expect(self(back).xp).toBe(XP_REWARDS.cookMeal);
  }, 15000);

  test('sleeping through the night grants XP', async () => {
    const room = await soloGame();
    await walk(room, TO_BED);
    room.send(ClientMessage.Interact, { targetId: 'bed' });
    await waitFor(() => self(room).xp === XP_REWARDS.sleepNight, NEW_DAY_DELAY_MS + 2000);
    expect(self(room).level).toBe(1);
  });
});
