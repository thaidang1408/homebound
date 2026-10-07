import { Client, type Room } from '@colyseus/sdk';
import { ClientMessage, GamePhase, ROOM_NAME, type HomeState, type Point } from '@homebound/shared';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGameServer } from '../app.js';

let playerCounter = 0;
/** A fresh valid anonymous player id per call (or a fixed one to simulate a returning player). */
export const newPlayerId = () => `test-player-${process.pid}-${++playerCounter}-xxxxxxxx`;

/** Real server + real SDK clients on a test port. One harness per test file. */
export function createHarness(port: number) {
  const saveDir = mkdtempSync(join(tmpdir(), 'homebound-saves-'));
  const server = createGameServer({ saveDir });
  const sdk = new Client(`http://127.0.0.1:${port}`);
  const openRooms: Room<HomeState>[] = [];

  /** Joined rooms are tracked for cleanup and returned only once their first state has arrived. */
  async function track(promise: Promise<Room<HomeState>>): Promise<Room<HomeState>> {
    const room = await promise;
    openRooms.push(room);
    await waitFor(() => room.state?.players !== undefined);
    return room;
  }

  return {
    sdk,
    saveDir,
    track,
    start: () => server.listen(port, '127.0.0.1'),
    stop: () => server.gracefullyShutdown(false),
    async leaveAll() {
      const rooms = openRooms.splice(0).filter((r) => r.connection.isOpen);
      await Promise.all(rooms.map((r) => r.leave().catch(() => undefined)));
    },
    /** Host creates a room, partner joins by code, both wait for the full state. */
    async createPair() {
      const host = await track(
        sdk.create<HomeState>(ROOM_NAME, { name: 'Host', playerId: newPlayerId() }),
      );
      const partner = await track(
        sdk.joinById<HomeState>(host.roomId, { name: 'Partner', playerId: newPlayerId() }),
      );
      await waitFor(() => host.state.players.size === 2 && partner.state.players.size === 2);
      return { host, partner };
    },
  };
}

export async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await sleep(10);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Synced player state as seen by `room`; throws if absent. */
export function playerOf(room: Room<HomeState>, sessionId: string) {
  const player = room.state.players.get(sessionId);
  if (!player) throw new Error(`player ${sessionId} not in state`);
  return player;
}

export const self = (room: Room<HomeState>) => playerOf(room, room.sessionId);

export async function startGame(host: Room<HomeState>, partner: Room<HomeState>) {
  host.send(ClientMessage.Ready, { ready: true });
  partner.send(ClientMessage.Ready, { ready: true });
  await waitFor(() => [...host.state.players.values()].every((p) => p.ready));
  host.send(ClientMessage.Start);
  await waitFor(() => partner.state.phase === GamePhase.Playing);
}

const WALK_STEP = 0.4; // m per move message, well within the server speed check

/** Walks through waypoints in small legal steps, then waits until the server agrees. */
export async function walk(room: Room<HomeState>, waypoints: readonly Point[]) {
  const pos = { x: self(room).x, z: self(room).z };
  for (const wp of waypoints) {
    while (Math.hypot(wp.x - pos.x, wp.z - pos.z) > 1e-6) {
      const d = Math.hypot(wp.x - pos.x, wp.z - pos.z);
      const t = Math.min(1, WALK_STEP / d);
      pos.x += (wp.x - pos.x) * t;
      pos.z += (wp.z - pos.z) * t;
      room.send(ClientMessage.Move, { x: pos.x, z: pos.z, yaw: 0, pitch: 0 });
      await sleep(40);
    }
  }
  await waitFor(() => Math.hypot(self(room).x - pos.x, self(room).z - pos.z) < 0.01);
}

/** Dev command: jump the world clock (e.g. to evening so beds can be used). */
export async function setTime(room: Room<HomeState>, timeOfDay: number) {
  room.send(ClientMessage.DevSetTime, { timeOfDay });
  await waitFor(() => Math.abs(room.state.timeOfDay - timeOfDay) < 0.01);
}

/** Early evening: bedtime is allowed and midnight is far away. */
export const EVENING = 0.8;
