import { Client, CloseCode, ErrorCode, type Room } from '@colyseus/sdk';
import {
  GamePhase,
  JoinError,
  ROOM_NAME,
  fromHttpSafeStatus,
  type HomeState,
} from '@homebound/shared';
import { serverUrl } from '../config/env';
import { getSession, updateSession } from '../state/session';
import { getPlayerId, setLastHome } from './identity';
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

/** The SDK's error code is the HTTP status; the server shifts 52x to 42x (toHttpSafeStatus). */
const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
    ? fromHttpSafeStatus(error.code)
    : null;
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : '');

/** No room is running under this code right now (it may still be a saved home). */
function isNotRunning(error: unknown): boolean {
  return (
    errorCode(error) === ErrorCode.MATCHMAKE_INVALID_ROOM_ID &&
    /not found/.test(errorMessage(error))
  );
}

/** Maps SDK/network errors to messages a player understands. */
function friendlyError(error: unknown): string {
  const code = errorCode(error);
  const message = errorMessage(error);
  if (message.includes(JoinError.HomeNotFound)) {
    return 'No home with that code. Please check the code.';
  }
  if (message.includes(JoinError.AlreadyInHome)) {
    return "You're already in this home in another tab.";
  }
  if (code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) {
    return /locked/.test(message)
      ? 'This home already has two players.'
      : 'No home with that code. Please check the code.';
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
  setLastHome(room.roomId);
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
        code === CloseCode.CONSENTED
          ? null
          : 'Connection lost. Your home is saved — rejoin with its code.',
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

const joinOptions = (name: string) => ({ name, playerId: getPlayerId() });

export function createHome(name: string): Promise<void> {
  return run('Building your home…', () => client.create<HomeState>(ROOM_NAME, joinOptions(name)));
}

/**
 * Enters a home by code, whether it's running (join) or only saved (re-open). `firstTry` picks
 * the likely case so the usual path makes a single request: your own last home is usually
 * closed, a partner's code is usually running. Either way the other path is the fallback; if both
 * of you re-open at once, the server refuses the second open and that player just joins.
 */
async function enterHome(
  code: string,
  name: string,
  firstTry: 'join' | 'reopen',
): Promise<Room<HomeState>> {
  const options = joinOptions(name);
  const join = () => client.joinById<HomeState>(code, options);
  const reopen = () => client.create<HomeState>(ROOM_NAME, { ...options, restoreCode: code });
  const alreadyOpen = (e: unknown) => errorMessage(e).includes(JoinError.HomeAlreadyOpen);

  if (firstTry === 'reopen') {
    try {
      return await reopen();
    } catch (error) {
      if (!alreadyOpen(error)) throw error;
      return join();
    }
  }
  try {
    return await join();
  } catch (error) {
    if (!isNotRunning(error)) throw error;
  }
  try {
    return await reopen();
  } catch (error) {
    if (!alreadyOpen(error)) throw error;
    return join();
  }
}

/** Join a partner's home by code (usually running). */
export function joinHome(code: string, name: string): Promise<void> {
  return run('Opening the door…', () => enterHome(code, name, 'join'));
}

/** Go back to your own last home (usually closed and saved). */
export function continueHome(code: string, name: string): Promise<void> {
  return run('Opening the door…', () => enterHome(code, name, 'reopen'));
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

/**
 * The server lets you go as soon as it gets the leave request, but behind Render's proxy its
 * closing frame can get lost (seen live: the leave never resolved). Stop waiting after a moment
 * and close the socket ourselves; a late "abnormal close" must not start a reconnect.
 */
const LEAVE_TIMEOUT_MS = 1500;

export async function leaveRoom(): Promise<void> {
  const room = getSession().room;
  if (!room) return;
  const timedOut = await Promise.race([
    room.leave().then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), LEAVE_TIMEOUT_MS)),
  ]);
  if (!timedOut || getSession().room !== room) return;
  room.connection.events.onclose = null;
  room.connection.close(CloseCode.CONSENTED);
  room.onLeave.invoke(CloseCode.CONSENTED);
}
