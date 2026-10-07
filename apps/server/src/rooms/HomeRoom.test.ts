import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { CloseCode } from '@colyseus/sdk';
import {
  ClientMessage,
  GamePhase,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
  ServerMessage,
  isValidRoomCode,
  type HomeState,
  type TeleportPayload,
} from '@homebound/shared';
import { createHarness, playerOf, startGame, waitFor } from '../test/harness.js';

const h = createHarness(2598);
const { sdk, track, createPair } = h;

beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

describe('room lifecycle', () => {
  test('create returns a valid human room code', async () => {
    const host = await track(sdk.create<HomeState>(ROOM_NAME, { name: 'Host' }));
    expect(host.roomId).toHaveLength(ROOM_CODE_LENGTH);
    expect(isValidRoomCode(host.roomId)).toBe(true);
  });

  test('rooms are private: matchmaking without a code finds nothing', async () => {
    await track(sdk.create<HomeState>(ROOM_NAME, { name: 'Host' }));
    await expect(sdk.join(ROOM_NAME)).rejects.toThrow();
  });

  test('partner joins by code; both see two players in slots 1 and 2', async () => {
    const { host } = await createPair();
    const players = [...host.state.players.values()];
    expect(players.map((p) => p.slot).sort()).toEqual([1, 2]);
    expect(players.map((p) => p.name).sort()).toEqual(['Host', 'Partner']);
  });

  test('new players start with fully defined numeric state', async () => {
    const { host, partner } = await createPair();
    const seen = playerOf(partner, host.sessionId);
    expect(seen.pitch).toBe(0);
    expect(seen.yaw).toBe(0);
    expect(Number.isFinite(seen.x) && Number.isFinite(seen.z)).toBe(true);
  });

  test('a third player is rejected', async () => {
    const { host } = await createPair();
    await expect(sdk.joinById(host.roomId, { name: 'Third' })).rejects.toThrow();
  });

  test('unknown room code is rejected', async () => {
    await expect(sdk.joinById('ZZZZZ', { name: 'Lost' })).rejects.toThrow();
  });

  test('names are sanitized and defaulted', async () => {
    const host = await track(sdk.create<HomeState>(ROOM_NAME, { name: '   ' }));
    await waitFor(() => host.state?.players?.size === 1);
    expect([...host.state.players.values()][0]?.name).toBe('Player 1');
  });
});

describe('lobby', () => {
  test('cannot start until both players are ready', async () => {
    const { host, partner } = await createPair();
    host.send(ClientMessage.Ready, { ready: true });
    host.send(ClientMessage.Start);
    await new Promise((r) => setTimeout(r, 150));
    expect(host.state.phase).toBe(GamePhase.Lobby);

    await startGame(host, partner);
    expect(host.state.phase).toBe(GamePhase.Playing);
  });
});

describe('movement sync', () => {
  test("a player's move is visible to the partner", async () => {
    const { host, partner } = await createPair();
    await startGame(host, partner);
    const self = playerOf(host, host.sessionId);

    host.send(ClientMessage.Move, { x: self.x + 0.3, z: self.z, yaw: 1, pitch: 0.2 });
    await waitFor(() => playerOf(partner, host.sessionId).yaw > 0.9);

    const seen = playerOf(partner, host.sessionId);
    expect(seen.x).toBeCloseTo(self.x, 3);
    expect(seen.yaw).toBeCloseTo(1, 2);
    expect(seen.pitch).toBeCloseTo(0.2, 2);
  });

  test('moves are ignored in the lobby', async () => {
    const { host, partner } = await createPair();
    const before = playerOf(partner, host.sessionId).x;
    host.send(ClientMessage.Move, { x: before + 0.3, z: 7, yaw: 0, pitch: 0 });
    await new Promise((r) => setTimeout(r, 150));
    expect(playerOf(partner, host.sessionId).x).toBe(before);
  });

  test('teleport-speed moves are rejected with a correction', async () => {
    const { host, partner } = await createPair();
    await startGame(host, partner);
    const start = { ...playerOf(host, host.sessionId) };

    const correction = new Promise<TeleportPayload>((resolve) =>
      host.onMessage(ServerMessage.Teleport, resolve),
    );
    host.send(ClientMessage.Move, { x: start.x + 20, z: start.z, yaw: 0, pitch: 0 });

    // State is float32 on the wire; the correction carries the exact server value.
    const { x, z } = await correction;
    expect(x).toBeCloseTo(start.x, 4);
    expect(z).toBeCloseTo(start.z, 4);
    expect(playerOf(partner, host.sessionId).x).toBe(start.x);
  });

  test('malformed messages are ignored and the room stays alive', async () => {
    const { host, partner } = await createPair();
    await startGame(host, partner);
    host.send(ClientMessage.Move, { x: 'NaN', damage: 999999 });
    host.send(ClientMessage.Move, null);
    host.send(ClientMessage.Ready, { ready: 'yes' });

    const self = playerOf(host, host.sessionId);
    host.send(ClientMessage.Move, { x: self.x, z: self.z - 0.2, yaw: 0.5, pitch: 0 });
    await waitFor(() => playerOf(partner, host.sessionId).yaw > 0.4);
  });
});

describe('disconnects', () => {
  test('a dropped player is marked disconnected, then reconnects into the same seat', async () => {
    const { host, partner } = await createPair();
    partner.reconnection.minUptime = 0;
    const reconnected = new Promise<void>((resolve) => partner.onReconnect(() => resolve()));

    partner.connection.close(CloseCode.MAY_TRY_RECONNECT, 'simulated network drop');
    await waitFor(() => host.state.players.get(partner.sessionId)?.connected === false);

    await reconnected;
    await waitFor(() => host.state.players.get(partner.sessionId)?.connected === true, 5000);
    expect(host.state.players.size).toBe(2);
  });

  test('a player who leaves on purpose is removed immediately', async () => {
    const { host, partner } = await createPair();
    const partnerId = partner.sessionId;
    await partner.leave();
    await waitFor(() => !host.state.players.has(partnerId));
  });
});
