import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { ClientMessage, GamePhase, ROOM_NAME, type HomeState, type Point } from '@homebound/shared';
import type { Room } from '@colyseus/sdk';
import { createHarness, newPlayerId, self, sleep, waitFor, walk } from '../test/harness.js';

const h = createHarness(2591);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

const TO_STOVE: Point[] = [
  { x: -3.5, z: 1.8 },
  { x: -3.5, z: -1.5 },
  { x: -4.4, z: -3.6 },
];
const TO_BENCH: Point[] = [{ x: 3.4, z: 2.6 }];
/** Out the front door and down the road, just past the yard. */
const DOWN_THE_ROAD: Point[] = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 10 },
  { x: 0, z: 17 },
];

const count = (room: Room<HomeState>, id: string) =>
  [...self(room).inventory].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);
const slotOf = (room: Room<HomeState>, id: string) =>
  [...self(room).inventory].findIndex((s) => s.itemId === id);

async function solo(playerId = newPlayerId()) {
  const room = await h.track(h.sdk.create<HomeState>(ROOM_NAME, { name: 'Hunter', playerId }));
  await waitFor(() => room.state?.players?.size === 1);
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

describe('stove recipes', () => {
  test('stew is cooked at the stove from meat, berries and a mushroom; not at the workbench', async () => {
    const room = await solo();
    for (const [itemId, qty] of [
      ['raw_meat', 1],
      ['berries', 2],
      ['mushroom', 1],
    ] as const) {
      room.send(ClientMessage.DevGive, { itemId, qty });
    }
    await waitFor(() => count(room, 'mushroom') === 1);
    await walk(room, TO_BENCH);
    room.send(ClientMessage.Craft, { recipeId: 'stew' });
    await sleep(300);
    expect(count(room, 'stew')).toBe(0); // wrong station
    await walk(room, [{ x: 0, z: 2 }, ...TO_STOVE]);
    room.send(ClientMessage.Craft, { recipeId: 'stew' });
    await waitFor(() => count(room, 'stew') === 1);
    expect(count(room, 'mushroom')).toBe(0);
  });
});

describe('traps over the network', () => {
  test('set a snare outside the yard, pick it back up; a set trap survives a re-open', async () => {
    const id = newPlayerId();
    const room = await solo(id);
    room.send(ClientMessage.DevGive, { itemId: 'snare', qty: 2 });
    await waitFor(() => count(room, 'snare') === 2);
    await walk(room, DOWN_THE_ROAD);

    room.send(ClientMessage.PlaceTrap, { slot: slotOf(room, 'snare') });
    await waitFor(() => room.state.traps.size === 1);
    expect(count(room, 'snare')).toBe(1);
    const [trapId] = [...room.state.traps.keys()];
    room.send(ClientMessage.Interact, { targetId: trapId });
    await waitFor(() => room.state.traps.size === 0);
    expect(count(room, 'snare')).toBe(2);

    room.send(ClientMessage.PlaceTrap, { slot: slotOf(room, 'snare') });
    await waitFor(() => room.state.traps.size === 1);
    const code = room.roomId;
    await room.leave();
    await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
    await sleep(100);

    const back = await h.track(
      h.sdk.create<HomeState>(ROOM_NAME, { name: 'Hunter', playerId: id, restoreCode: code }),
    );
    await waitFor(() => back.state?.traps?.size === 1);
    const [trap] = [...back.state.traps.values()];
    expect(trap?.kind).toBe('snare');
    expect(Math.hypot(trap?.x ?? 0, trap?.z ?? 0)).toBeGreaterThan(13);
  });
});
