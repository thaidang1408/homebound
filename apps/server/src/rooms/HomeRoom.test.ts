import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { CloseCode } from '@colyseus/sdk';
import {
  CHAT_COOLDOWN_MS,
  DODGE_COST,
  EMOTE_COOLDOWN_MS,
  PING_COOLDOWN_MS,
  PING_MAX_DISTANCE,
  STAMINA_MAX,
  CHAT_MAX_LENGTH,
  ClientMessage,
  GamePhase,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
  ServerMessage,
  isValidRoomCode,
  type ChatBroadcast,
  type PingBroadcast,
  type HomeState,
  type TeleportPayload,
} from '@homebound/shared';
import { createHarness, newPlayerId, playerOf, startGame, waitFor } from '../test/harness.js';

const h = createHarness(2598);
const { sdk, track, createPair } = h;

beforeAll(() => h.start());
afterEach(() => h.leaveAll());
afterAll(() => h.stop());

describe('room lifecycle', () => {
  test('create returns a valid human room code', async () => {
    const host = await track(
      sdk.create<HomeState>(ROOM_NAME, { name: 'Host', playerId: newPlayerId() }),
    );
    expect(host.roomId).toHaveLength(ROOM_CODE_LENGTH);
    expect(isValidRoomCode(host.roomId)).toBe(true);
  });

  test('rooms are private: matchmaking without a code finds nothing', async () => {
    await track(sdk.create<HomeState>(ROOM_NAME, { name: 'Host', playerId: newPlayerId() }));
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
    await expect(
      sdk.joinById(host.roomId, { name: 'Third', playerId: newPlayerId() }),
    ).rejects.toThrow();
  });

  test('unknown room code is rejected', async () => {
    await expect(
      sdk.joinById('ZZZZZ', { name: 'Lost', playerId: newPlayerId() }),
    ).rejects.toThrow();
  });

  test('names are sanitized and defaulted', async () => {
    const host = await track(
      sdk.create<HomeState>(ROOM_NAME, { name: '   ', playerId: newPlayerId() }),
    );
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

describe('chat', () => {
  test('a message reaches both players, cleaned; empty and too-fast ones are dropped', async () => {
    const { host, partner } = await createPair();
    const heard: ChatBroadcast[] = [];
    partner.onMessage(ServerMessage.Chat, (m: ChatBroadcast) => heard.push(m));
    const echoed: ChatBroadcast[] = [];
    host.onMessage(ServerMessage.Chat, (m: ChatBroadcast) => echoed.push(m));

    host.send(ClientMessage.Chat, { text: '   ' });
    host.send(ClientMessage.Chat, { text: '  đi săn   thôi!  ' });
    host.send(ClientMessage.Chat, { text: 'spam' }); // inside the cooldown
    await waitFor(() => heard.length === 1 && echoed.length === 1);
    await new Promise((r) => setTimeout(r, CHAT_COOLDOWN_MS + 100));
    expect(heard).toEqual([{ from: host.sessionId, name: 'Host', text: 'đi săn thôi!' }]);

    host.send(ClientMessage.Chat, { text: 'x'.repeat(500) });
    await waitFor(() => heard.length === 2);
    expect(heard[1]?.text).toHaveLength(CHAT_MAX_LENGTH);
  });
});

describe('stamina, emotes and pings', () => {
  test('a dodge costs stamina and the partner sees it; a second one right away is refused', async () => {
    const { host, partner } = await createPair();
    await startGame(host, partner);
    host.send(ClientMessage.Dodge);
    await waitFor(() => playerOf(partner, host.sessionId).action === 'dodge');
    const seen = playerOf(partner, host.sessionId);
    expect(seen.stamina).toBe(STAMINA_MAX - DODGE_COST);
    const seq = seen.actionSeq;
    host.send(ClientMessage.Dodge); // inside the cooldown
    await new Promise((r) => setTimeout(r, 300));
    expect(playerOf(partner, host.sessionId).actionSeq).toBe(seq);
    expect(playerOf(partner, host.sessionId).stamina).toBeLessThan(STAMINA_MAX);
  });

  test('wave and jump animate for the partner; unknown emotes are ignored', async () => {
    const { host, partner } = await createPair();
    await startGame(host, partner);
    host.send(ClientMessage.Emote, { kind: 'dance' });
    host.send(ClientMessage.Emote, { kind: 'wave' });
    await waitFor(() => playerOf(partner, host.sessionId).action === 'wave');
    await new Promise((r) => setTimeout(r, EMOTE_COOLDOWN_MS + 50));
    host.send(ClientMessage.Emote, { kind: 'jump' });
    await waitFor(() => playerOf(partner, host.sessionId).action === 'jump');
  });

  test('a ping reaches both players and points; one too far away is dropped', async () => {
    const { host, partner } = await createPair();
    await startGame(host, partner);
    const pings: PingBroadcast[] = [];
    partner.onMessage(ServerMessage.Ping, (p: PingBroadcast) => pings.push(p));
    const me = playerOf(host, host.sessionId);
    host.send(ClientMessage.Ping, { x: me.x + PING_MAX_DISTANCE + 5, z: me.z });
    await new Promise((r) => setTimeout(r, 200));
    expect(pings).toHaveLength(0);
    await new Promise((r) => setTimeout(r, PING_COOLDOWN_MS));
    host.send(ClientMessage.Ping, { x: me.x + 4, z: me.z - 2 });
    await waitFor(() => pings.length === 1);
    expect(pings[0]).toMatchObject({ from: host.sessionId });
    // The message can arrive before the next state patch.
    await waitFor(() => playerOf(partner, host.sessionId).action === 'point');
  });
});
