import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
  ClientMessage,
  GamePhase,
  PETS,
  ROOM_NAME,
  type HomeState,
  type Point,
} from '@homebound/shared';
import type { Room } from '@colyseus/sdk';
import { createHarness, newPlayerId, self, sleep, waitFor, walk } from '../test/harness.js';

const h = createHarness(2592);
beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

/** Walking down to the clearing and back takes a while. */
const LONG = { timeout: 20_000 };

/** Out the front door into the front yard, facing north (back at the house). */
const FRONT_YARD: Point[] = [
  { x: 0, z: 3 },
  { x: 0, z: 6 },
  { x: 0, z: 9 },
];
/** Down the road to the edge of the forest clearing, where the unicorn foal lives. */
const TO_CLEARING: Point[] = [...FRONT_YARD, { x: 0, z: 36 }];

const count = (room: Room<HomeState>, id: string) =>
  [...self(room).inventory].filter((s) => s.itemId === id).reduce((n, s) => n + s.qty, 0);
const slotOf = (room: Room<HomeState>, id: string) =>
  [...self(room).inventory].findIndex((s) => s.itemId === id);

async function solo(playerId = newPlayerId(), name = 'Bé') {
  const room = await h.track(h.sdk.create<HomeState>(ROOM_NAME, { name, playerId }));
  await waitFor(() => room.state?.players?.size === 1);
  room.send(ClientMessage.Start);
  await waitFor(() => room.state.phase === GamePhase.Playing);
  return room;
}

/** Feeds the unicorn foal berries from the hotbar until it's this player's pet. */
async function befriendUnicorn(room: Room<HomeState>) {
  room.send(ClientMessage.DevGive, { itemId: 'berries', qty: 3 });
  await waitFor(() => count(room, 'berries') === 3);
  room.send(ClientMessage.SelectSlot, { slot: slotOf(room, 'berries') });
  await walk(room, TO_CLEARING);
  room.send(ClientMessage.DevSummon, { kind: 'unicorn', x: 0, z: 37.2 });
  await waitFor(() => {
    const c = room.state.creatures.get('unicorn-0');
    return !!c && Math.hypot(c.x - 0, c.z - 37.2) < 0.5;
  });
  for (let fed = 1; fed <= 3; fed++) {
    room.send(ClientMessage.Interact, { targetId: 'unicorn-0' });
    await waitFor(() => count(room, 'berries') === 3 - fed);
  }
  await waitFor(() => room.state.pets.size === 1);
  const [petId] = [...room.state.pets.keys()];
  if (!petId) throw new Error('no pet');
  return petId;
}

describe('eggs over the network', () => {
  test('an egg is set down in the yard (not out in the woods) and saved while it hatches', async () => {
    const id = newPlayerId();
    const room = await solo(id);
    room.send(ClientMessage.DevGive, { itemId: 'pet_egg', qty: 1 });
    await waitFor(() => count(room, 'pet_egg') === 1);
    await walk(room, FRONT_YARD);
    room.send(ClientMessage.PlaceEgg, { slot: slotOf(room, 'pet_egg') });
    await waitFor(() => room.state.pets.size === 1);
    const [egg] = [...room.state.pets.values()];
    expect(egg?.kind).toBe('');
    await waitFor(() => egg?.ownerSession === room.sessionId);
    expect(count(room, 'pet_egg')).toBe(0);
    await waitFor(() => (egg?.hatch ?? 0) > 0);

    const code = room.roomId;
    await room.leave();
    await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
    await sleep(100);
    const back = await h.track(
      h.sdk.create<HomeState>(ROOM_NAME, { name: 'Bé', playerId: id, restoreCode: code }),
    );
    await waitFor(() => back.state?.pets?.size === 1);
    const [saved] = [...back.state.pets.values()];
    expect(saved?.kind).toBe('');
    expect(saved?.hatch).toBeGreaterThan(0);
  });
});

describe('wild pets and orders', () => {
  test(
    'befriend the unicorn foal, name it, give orders; it comes back with you by name',
    LONG,
    async () => {
      const room = await solo(newPlayerId(), 'Na');
      const petId = await befriendUnicorn(room);
      const pet = () => room.state.pets.get(petId);
      expect(pet()?.kind).toBe('unicorn');
      expect(pet()?.order).toBe('follow');
      expect(room.state.creatures.get('unicorn-0')?.present).toBe(false);

      room.send(ClientMessage.PetName, { petId, name: '  Kẹo  ' });
      await waitFor(() => pet()?.name === 'Kẹo');
      room.send(ClientMessage.PetCommand, { petId, command: 'stay' });
      await waitFor(() => pet()?.order === 'stay');
      const seq = pet()?.actionSeq ?? 0;
      room.send(ClientMessage.PetCommand, { petId, command: 'pat' });
      await waitFor(() => pet()?.actionSeq !== seq);
      expect(pet()?.action).toBe('pat');
      room.send(ClientMessage.PetCommand, { petId, command: 'fly' }); // not a command
      room.send(ClientMessage.PetName, { petId: 'pet-99', name: 'X' });
      await sleep(150);
      expect(pet()?.order).toBe('stay');

      // Another device, same name: the character and the pet are theirs (ADR-021).
      const code = room.roomId;
      await room.leave();
      await waitFor(() => existsSync(join(h.saveDir, `${code}.json`)));
      await sleep(100);
      const back = await h.track(
        h.sdk.create<HomeState>(ROOM_NAME, {
          name: 'na',
          playerId: newPlayerId(),
          restoreCode: code,
        }),
      );
      await waitFor(() => back.state?.pets?.get(petId)?.ownerSession === back.sessionId);
      expect(back.state.pets.get(petId)?.name).toBe('Kẹo');
      expect(back.state.pets.get(petId)?.order).toBe('stay');
    },
  );

  test('only the owner gives orders or renames; the partner may pat it', LONG, async () => {
    const room = await solo(newPlayerId(), 'Owner');
    const petId = await befriendUnicorn(room);
    const partner = await h.track(
      h.sdk.joinById<HomeState>(room.roomId, { name: 'Friend', playerId: newPlayerId() }),
    );
    await waitFor(() => partner.state.players.size === 2);
    await walk(partner, TO_CLEARING);
    const pet = () => partner.state.pets.get(petId);
    partner.send(ClientMessage.PetCommand, { petId, command: 'home' });
    partner.send(ClientMessage.PetName, { petId, name: 'Mine' });
    const seq = pet()?.actionSeq ?? 0;
    partner.send(ClientMessage.PetCommand, { petId, command: 'pat' });
    await waitFor(() => pet()?.actionSeq !== seq);
    expect(pet()?.order).toBe('follow');
    expect(pet()?.name).toBe(PETS.unicorn.name);
  });
});
