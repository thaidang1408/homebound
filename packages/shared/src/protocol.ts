/** Response body of the server health check endpoint. */
export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
}

/** Options sent with create/join. */
export interface JoinOptions {
  name: string;
}

/** Client → server message names. Clients send intent; the server decides. */
export const ClientMessage = {
  /** Toggle lobby ready state. */
  Ready: 'ready',
  /** Either player asks to start the game (both players must be ready). */
  Start: 'start',
  /** Predicted position/look, validated by the server. */
  Move: 'move',
} as const;

/** Server → client message names. */
export const ServerMessage = {
  /** Server rejected a move: snap the local player to this position. */
  Teleport: 'teleport',
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
