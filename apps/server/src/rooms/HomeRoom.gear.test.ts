import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  ClientMessage,
  GamePhase,
  PLAYER_INVENTORY_SLOTS,
  ROOM_NAME,
  equipIndex,
  type HomeState,
} from '@homebound/shared';
import type { Room } from '@colyseus/sdk';
import { createHarness, newPlayerId, self, sleep, waitFor } from '../test/harness.js';

const h = createHarness(2601);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

const slotOf = (room: Room<HomeState>, id: string) =>
  [...self(room).inventory].findIndex((s) => s.itemId === id && s.qty > 0);
const worn = (room: Room<HomeState>, slot: Parameters<typeof equipIndex>[0]) =>
  self(room).equipment.at(equipIndex(slot))?.itemId ?? '';

describe('gear and drops over the network', () => {
  test(
    'wear a satchel and a spear, drop and pick up a stack; gear is saved',
    { timeout: 15_000 },
    async () => {
      const id = newPlayerId();
      const room = await h.track(h.sdk.create<HomeState>(ROOM_NAME, { name: 'Bo', playerId: id }));
      await waitFor(() => room.state?.players?.size === 1);
      room.send(ClientMessage.Start);
      await waitFor(() => room.state.phase === GamePhase.Playing);
      expect(self(room).equipment.length).toBe(5);

      room.send(ClientMessage.DevGive, { itemId: 'satchel', qty: 1 });
      room.send(ClientMessage.DevGive, { itemId: 'spear', qty: 1 });
      room.send(ClientMessage.DevGive, { itemId: 'wood', qty: 7 });
      await waitFor(() => slotOf(room, 'wood') >= 0);

      room.send(ClientMessage.Equip, { slot: slotOf(room, 'satchel') });
      await waitFor(() => self(room).inventory.length === PLAYER_INVENTORY_SLOTS + 5);
      expect(worn(room, 'back')).toBe('satchel');
      room.send(ClientMessage.Equip, { slot: slotOf(room, 'spear') });
      await waitFor(() => worn(room, 'weapon') === 'spear');
      room.send(ClientMessage.Equip, { slot: slotOf(room, 'wood') }); // not gear: nothing happens
      await sleep(100);
      expect(slotOf(room, 'wood')).toBeGreaterThanOrEqual(0);

      room.send(ClientMessage.DropItem, { slot: slotOf(room, 'wood') });
      await waitFor(() => room.state.drops.size === 1);
      expect(slotOf(room, 'wood')).toBe(-1);
      const [bagId, bag] = [...room.state.drops.entries()][0] ?? ['', undefined];
      expect(bag?.qty).toBe(7);
      room.send(ClientMessage.Interact, { targetId: bagId });
      await waitFor(() => room.state.drops.size === 0);
      expect(slotOf(room, 'wood')).toBeGreaterThanOrEqual(0);

      // Out of reach: a bag far away can't be picked up.
      room.send(ClientMessage.DropItem, { slot: slotOf(room, 'wood') });
      await waitFor(() => room.state.drops.size === 1);
      room.send(ClientMessage.DevTeleport, { x: 30, z: 30 });
      await waitFor(() => self(room).x > 29);
      room.send(ClientMessage.Interact, { targetId: [...room.state.drops.keys()][0] });
      await sleep(150);
      expect(room.state.drops.size).toBe(1);

      const code = room.roomId;
      await room.leave();
      await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
      await sleep(100);
      const back = await h.track(
        h.sdk.create<HomeState>(ROOM_NAME, { name: 'Bo', playerId: id, restoreCode: code }),
      );
      await waitFor(() => back.state?.players?.size === 1);
      expect(worn(back, 'back')).toBe('satchel');
      expect(worn(back, 'weapon')).toBe('spear');
      expect(self(back).inventory.length).toBe(PLAYER_INVENTORY_SLOTS + 5);
      expect(back.state.drops.size).toBe(1); // the bag is still out there
      expect(back.state.pans.length).toBe(3);
    },
  );
});
