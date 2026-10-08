import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  ClientMessage,
  GamePhase,
  HOME_WAYSTONE,
  ROOM_NAME,
  findLandmark,
  waystoneId,
  type HomeState,
} from '@homebound/shared';
import { createHarness, newPlayerId, self, sleep, waitFor } from '../test/harness.js';

const h = createHarness(2599);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

const cave = findLandmark('cave');
if (!cave) throw new Error('no cave');

async function solo(playerId = newPlayerId()) {
  const room = await h.track(h.sdk.create<HomeState>(ROOM_NAME, { name: 'Ana', playerId }));
  await waitFor(() => room.state?.players?.size === 1);
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

describe('exploring over the network', () => {
  test('discover the cave, loot its cache once, travel home by waystone; it all stays saved', async () => {
    const id = newPlayerId();
    const room = await solo(id);
    await waitFor(() => room.state.explored.size > 0); // the fog lifts around home right away
    const home = room.state.explored.size;

    // The wilds are a long walk: jump to the cave's waystone (dev only).
    room.send(ClientMessage.DevTeleport, { x: cave.waystone.x - 1.4, z: cave.waystone.z });
    await waitFor(() => room.state.discovered.has('cave'));
    expect(room.state.explored.size).toBeGreaterThan(home);

    room.send(ClientMessage.DevTeleport, { x: cave.x + 0.4, z: cave.z }); // inside, by the cache
    await waitFor(() => Math.hypot(self(room).x - (cave.x + 0.4), self(room).z - cave.z) < 0.1);
    room.send(ClientMessage.Interact, { targetId: 'cache-cave' });
    await waitFor(() => room.state.caches.has('cave'));
    const stones = () =>
      [...self(room).inventory].filter((s) => s.itemId === 'stone').reduce((n, s) => n + s.qty, 0);
    const got = stones();
    expect(got).toBeGreaterThanOrEqual(3);
    room.send(ClientMessage.Interact, { targetId: 'cache-cave' }); // empty until tomorrow
    await sleep(150);
    expect(stones()).toBe(got);

    room.send(ClientMessage.DevTeleport, { x: cave.waystone.x - 1.4, z: cave.waystone.z });
    await waitFor(
      () => Math.hypot(self(room).x - cave.waystone.x, self(room).z - cave.waystone.z) < 2,
    );
    room.send(ClientMessage.Travel, { to: 'waystone-atlantis' }); // ignored
    room.send(ClientMessage.Travel, { to: HOME_WAYSTONE.id });
    await waitFor(
      () => Math.hypot(self(room).x - HOME_WAYSTONE.at.x, self(room).z - HOME_WAYSTONE.at.z) < 2,
    );

    room.send(ClientMessage.MapMark, { x: 40, z: -20 });
    await waitFor(() => room.state.markers.size === 1);

    const code = room.roomId;
    await room.leave();
    await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
    await sleep(100);
    const back = await h.track(
      h.sdk.create<HomeState>(ROOM_NAME, { name: 'Ana', playerId: id, restoreCode: code }),
    );
    await waitFor(() => back.state?.discovered?.has('cave') === true);
    expect(back.state.caches.has('cave')).toBe(true);
    expect(back.state.markers.size).toBe(1);
    expect(back.state.explored.size).toBeGreaterThan(home);
    expect(waystoneId(cave)).toBe('waystone-cave');
  });
});
