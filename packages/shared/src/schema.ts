import { schema, t, type SchemaType } from '@colyseus/schema';
import { HUNGER_START, MAX_PITCH } from './constants.js';

// Every primitive needs an explicit default: schema-builder numbers otherwise start as
// `undefined` on the client (regression test in HomeRoom.test.ts).

export const GamePhase = {
  Lobby: 'lobby',
  Playing: 'playing',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/** One inventory slot. Empty slot: itemId '' and qty 0. */
export const ItemStack = schema(
  {
    itemId: t.string().default(''),
    qty: t.uint8().default(0),
  },
  'ItemStack',
);
export type ItemStack = SchemaType<typeof ItemStack>;

/** Synced per-player state. Position is client-predicted, server-validated (ADR-007). */
export const PlayerState = schema(
  {
    name: t.string().default(''),
    /** 1 or 2: display order, spawn point, bed side. */
    slot: t.uint8().default(0),
    ready: t.boolean().default(false),
    connected: t.boolean().default(true),
    x: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.angle().default(0),
    pitch: t.quantized({ min: -MAX_PITCH, max: MAX_PITCH }).default(0),
    /** Displayed hunger (rounded up). */
    hunger: t.uint8().default(HUNGER_START),
    /** Exact value the server decays; never sent. */
    hungerExact: t.float64().noSync().default(HUNGER_START),
    sleeping: t.boolean().default(false),
    /** Lifetime XP; level is derived from it (progression.ts) and synced for the UI. */
    xp: t.uint32().default(0),
    level: t.uint8().default(1),
    /** Fixed-length slot array; the first HOTBAR_SLOTS are the hotbar. */
    inventory: t.array(ItemStack),
  },
  'PlayerState',
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const StoveStatus = {
  Idle: 'idle',
  Cooking: 'cooking',
  Done: 'done',
} as const;
export type StoveStatus = (typeof StoveStatus)[keyof typeof StoveStatus];

/** The kitchen stove: one item at a time, anyone can collect the result. */
export const StoveState = schema(
  {
    status: t.string().default(StoveStatus.Idle),
    /** Item on the pan ('' when idle). */
    itemId: t.string().default(''),
    /** 0 → 1 while cooking; drives the pan visuals. */
    progress: t.quantized({ min: 0, max: 1, bits: 8 }).default(0),
    /** Server-side cooking clock; never sent. */
    elapsedMs: t.float64().noSync().default(0),
    /** playerId of whoever started cooking (gets the XP); never sent. */
    cookedBy: t.string().noSync().default(''),
  },
  'StoveState',
);
export type StoveState = SchemaType<typeof StoveState>;

export const HomeState = schema(
  {
    phase: t.string().default(GamePhase.Lobby),
    day: t.uint16().default(1),
    /** Keyed by Colyseus sessionId. */
    players: t.map(PlayerState),
    /** Shared storage chest, fixed-length slot array. */
    chest: t.array(ItemStack),
    stove: StoveState,
  },
  'HomeState',
);
export type HomeState = SchemaType<typeof HomeState>;
