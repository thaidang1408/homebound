import type { ItemId } from './items.js';

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

/** Anonymous player ids: 16–64 url-safe characters. */
export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** Running homes are saved this often (and on leave, new day and shutdown). */
export const AUTOSAVE_INTERVAL_MS = 30_000;

// --- Movement ---

/** Client → server position updates. Matches Colyseus' default 50 ms patch rate. */
export const MOVE_SEND_INTERVAL_MS = 50;

export const PLAYER_WALK_SPEED = 4.5; // m/s
export const PLAYER_SPRINT_SPEED = 7; // m/s
export const PLAYER_EYE_HEIGHT = 1.6; // m
export const PLAYER_RADIUS = 0.3; // m, collision circle

/** Server accepts up to sprint speed × tolerance, plus a fixed slack for network jitter. */
export const MOVE_SPEED_TOLERANCE = 1.5;
export const MOVE_DISTANCE_SLACK = 0.75; // m

/** The playable world is a circle around the house; the terrain rim rises at its edge. */
export const WORLD_RADIUS = 58; // m

export const MAX_PITCH = Math.PI / 2 - 0.01;

/** Spawn in the living room, facing the kitchen/bedroom doorways (yaw 0 looks toward -Z). By slot - 1. */
export const SPAWN_POINTS: readonly { x: number; z: number; yaw: number }[] = [
  { x: -1.2, z: 2.6, yaw: 0 },
  { x: 1.2, z: 2.6, yaw: 0 },
];

// --- Simulation ---

/** Server fixed tick for needs and stations. */
export const SIMULATION_TICK_MS = 100;

// --- Interaction ---

/** Max distance from a player to the edge of a piece of furniture to use it. */
export const INTERACT_RANGE = 1.4; // m
/** Extra distance the server allows on top of INTERACT_RANGE (latency between client and server poses). */
export const INTERACT_TOLERANCE = 0.6; // m

// --- Inventory ---

export const PLAYER_INVENTORY_SLOTS = 10;
/** The first HOTBAR_SLOTS of the player inventory are the hotbar (keys 1–5). */
export const HOTBAR_SLOTS = 5;
export const CHEST_SLOTS = 16;
/** What the shared chest holds on day 1, until hunting exists (Phase 4). */
export const STARTER_CHEST: readonly { itemId: ItemId; qty: number }[] = [
  { itemId: 'raw_meat', qty: 6 },
];

// --- Needs ---

export const HUNGER_MAX = 100;
export const HUNGER_START = 80;
/** Full to empty in 20 minutes of play; paused while sleeping. */
export const HUNGER_DECAY_PER_SECOND = HUNGER_MAX / (20 * 60);

// --- Cooking ---

export const COOK_TIME_MS = 6000;

// --- Sleep ---

/** Once everyone is in bed, wait this long (fade to black) before the new day starts. */
export const NEW_DAY_DELAY_MS = 2500;

// --- Health ---

export const HEALTH_MAX = 100;
/** Slow natural healing while not starving (full in ~7 minutes). */
export const HEALTH_REGEN_PER_SECOND = 0.25;
/**
 * Phase 4 stand-in for downed/revive (Phase 5): at 0 health you black out and wake up at home
 * with this much health, keeping your items.
 */
export const BLACKOUT_HEALTH = 50;
