/** Response body of the server health check endpoint. */
export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
}

/** Options sent with create/join. */
export interface JoinOptions {
  name: string;
  /** Stable anonymous id kept in the browser; links a player to their saved items and XP. */
  playerId: string;
  /** Re-open a saved home by its code (only when it isn't already running). */
  restoreCode?: string;
}

/** Error messages the server uses to refuse a join; the client maps them to friendly text. */
export const JoinError = {
  HomeNotFound: 'home-not-found',
  HomeAlreadyOpen: 'home-already-open',
  AlreadyInHome: 'already-in-home',
  InvalidPlayer: 'invalid-player',
} as const;

/** Client → server message names. Clients send intent; the server decides. */
export const ClientMessage = {
  /** Toggle lobby ready state. */
  Ready: 'ready',
  /** Either player asks to start the game (both players must be ready). */
  Start: 'start',
  /** Predicted position/look, validated by the server. */
  Move: 'move',
  /** Use a piece of furniture (stove, bed). The server decides what happens. */
  Interact: 'interact',
  /** Move a whole stack between the player's inventory and the shared chest. */
  Transfer: 'transfer',
  /** Use the item in an inventory slot (eat food). */
  UseItem: 'use-item',
  /** Strike the creature in your crosshair (bare hands for now). Payload: InteractPayload. */
  Attack: 'attack',
  /** Development servers only: jump the clock (playtests). Ignored in production. */
  DevSetTime: 'dev:set-time',
} as const;

/** Server → client message names. */
export const ServerMessage = {
  /** Server overrode the local player's position (rejected move, bed). Snap to it. */
  Teleport: 'teleport',
  /** You ran out of health and woke up at home (Phase 4 stand-in for downed/revive). */
  BlackedOut: 'blacked-out',
} as const;

export interface ReadyPayload {
  ready: boolean;
}

export interface MovePayload {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface TeleportPayload {
  x: number;
  z: number;
}

export interface InteractPayload {
  targetId: string;
}

export type Container = 'player' | 'chest';

export interface TransferPayload {
  from: Container;
  slot: number;
}

export interface DevSetTimePayload {
  timeOfDay: number;
}

export interface UseItemPayload {
  slot: number;
}
