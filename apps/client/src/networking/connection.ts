import { Client, CloseCode, ErrorCode, type Room } from '@colyseus/sdk';
import { GamePhase, ROOM_NAME, type HomeState, type JoinOptions } from '@homebound/shared';
import { serverUrl } from '../config/env';
import { getSession, updateSession } from '../state/session';
import { watchRoom } from './roomWatcher';

const client = new Client(serverUrl);

/** Survives a page reload in the same tab, so a refresh rejoins the same seat. */
const RECONNECT_TOKEN_KEY = 'homebound:reconnect-token';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(RECONNECT_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(RECONNECT_TOKEN_KEY, token);
    else sessionStorage.removeItem(RECONNECT_TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): reload-reconnect just won't work.
  }
}

/** Maps SDK/network errors to messages a player understands. */
function friendlyError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  const message = error instanceof Error ? error.message : '';
  if (code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) {
    return /locked/.test(message)
      ? 'This room is already full.'
      : 'Unable to join this room. Please check the room code.';
  }
  if (code === null || code === undefined) {
    return "Can't reach the game server. Please try again in a moment.";
  }
  return 'Something went wrong. Please try again.';
}

/** Join resolves before the first state patch; screens need `room.state.players` to exist. */
function firstState(room: Room<HomeState>): Promise<Room<HomeState>> {
  if (room.state?.players) return Promise.resolve(room);
  return new Promise((resolve) => room.onStateChange.once(() => resolve(room)));
}

/** Wires a joined room into the session store. */
function bindRoom(room: Room<HomeState>): void {
  writeToken(room.reconnectionToken);
  updateSession({
    room,
    screen: room.state.phase === GamePhase.Playing ? 'game' : 'lobby',
    connection: 'connected',
    error: null,
    busy: null,
  });
  watchRoom(room);

  room.onDrop(() => updateSession({ connection: 'reconnecting' }));
  room.onReconnect(() => {
    writeToken(room.reconnectionToken);
    updateSession({ connection: 'connected' });
  });
  room.onLeave((code) => {
    writeToken(null);
    updateSession({
      room: null,
      screen: 'landing',
      connection: 'connected',
      busy: null,
      error:
        code === CloseCode.CONSENTED ? null : 'Connection lost. Please rejoin with the room code.',
    });
  });
}

async function run(busy: string, join: () => Promise<Room<HomeState>>): Promise<void> {
  updateSession({ busy, error: null });
  try {
    bindRoom(await firstState(await join()));
  } catch (error) {
    console.warn('[network] join failed', error);
    updateSession({ busy: null, error: friendlyError(error) });
  }
}

export function createRoom(options: JoinOptions): Promise<void> {
  return run('Creating room…', () => client.create<HomeState>(ROOM_NAME, options));
}

export function joinRoom(code: string, options: JoinOptions): Promise<void> {
  return run('Joining room…', () => client.joinById<HomeState>(code, options));
}

/** After a page reload, try to take back the seat held by the server's grace period. */
export async function resumeSession(): Promise<void> {
  const token = readToken();
  if (!token) return;
  updateSession({ busy: 'Reconnecting…' });
  try {
    bindRoom(await firstState(await client.reconnect<HomeState>(token)));
  } catch {
    writeToken(null);
    updateSession({ busy: null });
  }
}

export async function leaveRoom(): Promise<void> {
  await getSession().room?.leave();
}
