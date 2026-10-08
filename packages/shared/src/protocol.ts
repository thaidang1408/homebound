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
/**
 * Colyseus answers matchmaking errors with HTTP 520–529, which Cloudflare (in front of Render)
 * reserves for its own errors and strips (no CORS header, no body): the browser then can't tell
 * "no room running" from "server down". The server sends them as 420–429 instead (ADR-020).
 */
const CDN_RESERVED = { min: 520, max: 529, shift: 100 } as const;
export const toHttpSafeStatus = (code: number): number =>
  code >= CDN_RESERVED.min && code <= CDN_RESERVED.max ? code - CDN_RESERVED.shift : code;
export const fromHttpSafeStatus = (status: number): number =>
  status >= CDN_RESERVED.min - CDN_RESERVED.shift && status <= CDN_RESERVED.max - CDN_RESERVED.shift
    ? status + CDN_RESERVED.shift
    : status;

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
  /** Rearrange one container: move/swap/merge the stack in `from` onto slot `to`. */
  MoveSlot: 'move-slot',
  /** Use the item in an inventory slot (eat food). */
  UseItem: 'use-item',
  /** The hotbar slot you hold (cosmetic: the server reads attacks from their own slot). */
  SelectSlot: 'select-slot',
  /** Use the weapon in a hotbar slot: strike the creature in the crosshair, or shoot. */
  Attack: 'attack',
  /** Craft a workbench recipe. */
  Craft: 'craft',
  /** Say something to the home (`{ text }`); the server cleans and rate-limits it. */
  Chat: 'chat',
  /** Dodge roll (costs stamina; strikes miss you for a moment). The client moves you. */
  Dodge: 'dodge',
  /** Something the partner should see: `{ kind: 'jump' | 'wave' }`. */
  Emote: 'emote',
  /** Mark a spot for the partner: `{ x, z }`. */
  Ping: 'ping',
  /** Development servers only: jump the clock (playtests). Ignored in production. */
  DevSetTime: 'dev:set-time',
  /** Development servers only: lose health (test downed/revive). Payload `{ amount }`. */
  DevHurt: 'dev:hurt',
  /** Development servers only: get items (test weapons/crafting). Payload `{ itemId, qty }`. */
  DevGive: 'dev:give',
  /** Development servers only: bring the nearest creature of `{ kind }` 12 m from you (e2e). */
  DevSummon: 'dev:summon',
} as const;

/** Server → client message names. */
export const ServerMessage = {
  /** Server overrode the local player's position (rejected move, bed). Snap to it. */
  Teleport: 'teleport',
  /** Your attack landed (hitmarker). */
  HitConfirm: 'hit-confirm',
  /** You bled out (or went down alone) and woke up at home. */
  Died: 'died',
  /** Everyone slept: how the day went (sent before the new day's stats reset). */
  DaySummary: 'day-summary',
  /** Someone in the home said something (already cleaned by the server). */
  Chat: 'chat',
  /** Someone marked a spot: `{ from, x, z }`. */
  Ping: 'ping',
} as const;

/** What a player visibly does; synced as `PlayerState.action` for the partner's animation. */
export const PLAYER_ACTIONS = [
  'attack',
  'shoot',
  'chop',
  'mine',
  'pick',
  'eat',
  'dodge',
  'jump',
  'wave',
  'point',
] as const;
export type PlayerAction = (typeof PLAYER_ACTIONS)[number];
/** Actions a client may announce directly (the rest follow from accepted game actions). */
export const EMOTES = ['jump', 'wave'] as const;
export type Emote = (typeof EMOTES)[number];

export interface EmotePayload {
  kind: Emote;
}

export interface PingPayload {
  x: number;
  z: number;
}

export interface PingBroadcast extends PingPayload {
  from: string;
}

export interface ChatPayload {
  text: string;
}

export interface ChatBroadcast {
  /** Sender's sessionId. */
  from: string;
  name: string;
  text: string;
}

export interface ReadyPayload {
  ready: boolean;
}

export interface MovePayload {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  /** Shift held while moving: the server drains stamina for it. */
  sprint?: boolean;
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

export interface MoveSlotPayload {
  container: Container;
  from: number;
  to: number;
}

export interface DevSetTimePayload {
  timeOfDay: number;
}

export interface UseItemPayload {
  slot: number;
}

export interface AttackPayload {
  /** Hotbar slot of the held weapon (empty / non-weapon = fists). */
  slot: number;
  /** Melee: the creature in the crosshair ('' when shooting or swinging at air). */
  targetId: string;
  /** Ranged: the aim direction (yaw 0 looks toward −Z, pitch + looks up). */
  yaw: number;
  pitch: number;
}

export interface CraftPayload {
  recipeId: string;
}

export interface HitConfirmPayload {
  killed: boolean;
}

export interface DaySummaryPayload {
  /** The day that just ended. */
  day: number;
  hunted: number;
  meals: number;
  gathered: number;
  crafted: number;
  revives: number;
  goalsDone: number;
  goalsTotal: number;
}
