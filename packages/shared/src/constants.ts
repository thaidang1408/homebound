/** MVP is strictly two-player co-op. */
export const MAX_PLAYERS = 2;

/** Colyseus room type name, used by both server definition and client join. */
export const ROOM_NAME = 'home';

export const DEFAULT_SERVER_PORT = 2567;

export const HEALTH_PATH = '/health';

// --- Rooms ---

/** Room codes avoid look-alike characters (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

/** Seconds a dropped player's seat is held before they are removed. */
export const RECONNECT_GRACE_SECONDS = 30;

/** Flood protection; Colyseus disconnects clients above this rate. */
export const MAX_MESSAGES_PER_SECOND = 60;

export const PLAYER_NAME_MAX_LENGTH = 16;

// --- Movement ---

/** Client → server position updates. Matches Colyseus' default 50 ms patch rate. */
export const MOVE_SEND_INTERVAL_MS = 50;

export const PLAYER_WALK_SPEED = 4.5; // m/s
export const PLAYER_SPRINT_SPEED = 7; // m/s
export const PLAYER_EYE_HEIGHT = 1.6; // m

/** Server accepts up to sprint speed × tolerance, plus a fixed slack for network jitter. */
export const MOVE_SPEED_TOLERANCE = 1.5;
export const MOVE_DISTANCE_SLACK = 0.75; // m

/** Players are kept inside this circle around the house (Phase 3 replaces it with terrain bounds). */
export const WORLD_RADIUS = 28; // m

export const MAX_PITCH = Math.PI / 2 - 0.01;

/** Spawn in front of the house, facing it (yaw 0 looks toward -Z). Indexed by slot - 1. */
export const SPAWN_POINTS: readonly { x: number; z: number; yaw: number }[] = [
  { x: -1.5, z: 7, yaw: 0 },
  { x: 1.5, z: 7, yaw: 0 },
];
