import type { Room } from '@colyseus/sdk';
import type { HomeState } from '@homebound/shared';
import { createStore } from './createStore';

export type Screen = 'landing' | 'lobby' | 'game';
export type ConnectionStatus = 'connected' | 'reconnecting';

export interface Session {
  screen: Screen;
  room: Room<HomeState> | null;
  connection: ConnectionStatus;
  /** Player-facing message, never a raw technical error. */
  error: string | null;
  /** Shown while an async action runs ("Creating room…"). */
  busy: string | null;
  /** Bumped on low-frequency room changes (players, inventory, stove, day) so React re-reads room.state. */
  version: number;
}

const store = createStore<Session>({
  screen: 'landing',
  room: null,
  connection: 'connected',
  error: null,
  busy: null,
  version: 0,
});

export const getSession = store.get;
export const updateSession = store.update;
/** React binding. Per-frame data must NOT go through here; read room.state in useFrame. */
export const useSession = store.use;
