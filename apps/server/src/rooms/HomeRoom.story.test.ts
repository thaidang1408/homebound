import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  ClientMessage,
  GamePhase,
  LANTERN_OFFSET,
  ROOM_NAME,
  findLandmark,
  lanternId,
  type HomeState,
  type Point,
} from '@homebound/shared';
import type { Room } from '@colyseus/sdk';
import { createHarness, newPlayerId, self, sleep, waitFor, walk } from '../test/harness.js';

const h = createHarness(2600);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

/** Through the kitchen doorway to the table where Đốm sits. */
const TO_DOM: Point[] = [
  { x: -3.5, z: 1.8 },
  { x: -3.5, z: -1.2 },
  { x: -2.5, z: -1.4 },
];
const tree = findLandmark('giant-tree');
if (!tree) throw new Error('no giant tree');

const count = (room: Room<HomeState>, id: string) =>
  [...self(room).inventory].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);
const at = (room: Room<HomeState>) => `${room.state.quest.chapter}.${room.state.quest.step}`;

describe('the story over the network', () => {
  test('chapter 1 start to finish, and the story is saved', { timeout: 20_000 }, async () => {
    const id = newPlayerId();
    const room = await h.track(h.sdk.create<HomeState>(ROOM_NAME, { name: 'Na', playerId: id }));
    await waitFor(() => room.state?.players?.size === 1);
    room.send(ClientMessage.Start);
    await waitFor(() => room.state.phase === GamePhase.Playing);

    await walk(room, TO_DOM);
    room.send(ClientMessage.Interact, { targetId: 'dom' });
    await waitFor(() => at(room) === '0.1');
    room.send(ClientMessage.Interact, { targetId: 'dom' }); // nothing to give yet
    await sleep(150);
    expect(at(room)).toBe('0.1');
    room.send(ClientMessage.DevGive, { itemId: 'wood', qty: 5 });
    room.send(ClientMessage.DevGive, { itemId: 'mushroom', qty: 2 });
    await waitFor(() => count(room, 'mushroom') === 2);
    room.send(ClientMessage.Interact, { targetId: 'dom' });
    await waitFor(() => at(room) === '0.2');
    expect(count(room, 'wood')).toBe(0);

    // Off to the Giant Tree (a dev jump), where the lantern waits.
    const lantern = { x: tree.x + LANTERN_OFFSET.x, z: tree.z + LANTERN_OFFSET.z };
    room.send(ClientMessage.DevTeleport, { x: lantern.x + 1, z: lantern.z + 1 });
    await waitFor(() => at(room) === '0.3'); // discovered → the visit step is done
    room.send(ClientMessage.Interact, { targetId: lanternId('giant-tree') });
    await waitFor(() => room.state.lanterns.has('giant-tree'));
    expect(at(room)).toBe('0.4');

    room.send(ClientMessage.DevTeleport, { x: -2.5, z: -1.4 });
    await waitFor(() => Math.hypot(self(room).x + 2.5, self(room).z + 1.4) < 0.1);
    room.send(ClientMessage.Interact, { targetId: 'dom' });
    await waitFor(() => at(room) === '1.0');
    await waitFor(() => count(room, 'arrow') === 10); // the chapter's reward

    const code = room.roomId;
    await room.leave();
    await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
    await sleep(100);
    const back = await h.track(
      h.sdk.create<HomeState>(ROOM_NAME, { name: 'Na', playerId: id, restoreCode: code }),
    );
    await waitFor(() => back.state?.quest?.chapter === 1);
    expect(back.state.lanterns.has('giant-tree')).toBe(true);
  });
});
