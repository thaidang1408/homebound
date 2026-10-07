import { useSyncExternalStore } from 'react';
import type { Room } from '@colyseus/sdk';
import type { HomeState } from '@homebound/shared';

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
  /** Bumped on low-frequency room changes (players, ready, phase) so React re-reads room.state. */
  version: number;
}

let session: Session = {
  screen: 'landing',
  room: null,
  connection: 'connected',
  error: null,
  busy: null,
  version: 0,
};

const listeners = new Set<() => void>();

export function getSession(): Session {
  return session;
}

export function updateSession(patch: Partial<Session>): void {
  session = { ...session, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding. Per-frame data must NOT go through here; read room.state in useFrame. */
export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession);
}

declare global {
  interface Window {
    /** Dev-only hook for automated browser checks (stripped from production builds). */
    __homebound?: { getSession: typeof getSession };
  }
}

if (import.meta.env.DEV) {
  window.__homebound = { getSession };
}
