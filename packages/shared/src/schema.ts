import { schema, t, type SchemaType } from '@colyseus/schema';
import { HEALTH_MAX, HUNGER_START, MAX_PITCH, STAMINA_MAX } from './constants.js';
import { CreatureMode } from './creatures.js';
import { NEW_HOME_TIME } from './world/time.js';

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
    /** Displayed health (rounded up). */
    health: t.uint8().default(HEALTH_MAX),
    /** Exact value (regen is fractional); never sent. */
    healthExact: t.float64().noSync().default(HEALTH_MAX),
    /** At 0 health: on the ground, waiting for the partner (ADR-017). */
    downed: t.boolean().default(false),
    /** Share of the bleed-out time left while downed (1 → 0). */
    bleedOut: t.quantized({ min: 0, max: 1, bits: 8 }).default(1),
    /** Revive progress while the partner holds [E] (0 → 1). */
    revive: t.quantized({ min: 0, max: 1, bits: 8 }).default(0),
    // --- server-only ---
    bleedMs: t.float64().noSync().default(0),
    reviveMs: t.float64().noSync().default(0),
    /** sessionId of whoever is reviving, and when they last held [E]. */
    reviverId: t.string().noSync().default(''),
    revivePingAt: t.float64().noSync().default(0),
    /** Lifetime XP; level is derived from it (progression.ts) and synced for the UI. */
    xp: t.uint32().default(0),
    level: t.uint8().default(1),
    /** Selected hotbar slot, so the partner sees what you hold. */
    selectedSlot: t.uint8().default(0),
    /** Stamina for sprinting and dodging (server-owned, rounded up for display). */
    stamina: t.uint8().default(STAMINA_MAX),
    staminaExact: t.float64().noSync().default(STAMINA_MAX),
    /** Emptied out and recovering: no sprint or dodge until STAMINA_RECOVER. */
    winded: t.boolean().default(false),
    staminaUsedAt: t.float64().noSync().default(0),
    dodgeUntil: t.float64().noSync().default(0),
    dodgeAt: t.float64().noSync().default(-1e9),
    emoteAt: t.float64().noSync().default(-1e9),
    pingAt: t.float64().noSync().default(-1e9),
    /**
     * The last thing they visibly did (PlayerAction) and a counter that changes each time, so the
     * partner can animate it once even when the same action repeats.
     */
    action: t.string().default(''),
    actionSeq: t.uint8().default(0),
    /** Sneaking (C): creatures notice you from half as far. */
    crouching: t.boolean().default(false),
    /** When they last sprinted (noise). */
    noisyAt: t.float64().noSync().default(-1e9),
    /** Active food buff (buffs.ts, '' = none) and whole seconds left, for the HUD. */
    buff: t.string().default(''),
    buffLeft: t.uint16().default(0),
    buffMs: t.float64().noSync().default(0),
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

/** A harvestable node's live state; its position and kind are static world data (layout.ts). */
export const ResourceState = schema(
  {
    charges: t.uint8().default(0),
    /** Server-side countdown while depleted; never sent. */
    respawnMs: t.float64().noSync().default(0),
  },
  'ResourceState',
);
export type ResourceState = SchemaType<typeof ResourceState>;

/** A live creature. Kind data lives in creatures.ts; the AI runs on the server only. */
export const CreatureState = schema(
  {
    kind: t.string().default(''),
    mode: t.string().default(CreatureMode.Idle),
    x: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.angle().default(0),
    health: t.uint8().default(0),
    /** Hidden while waiting to respawn (after being butchered). */
    present: t.boolean().default(true),
    // --- server-only AI memory ---
    /** Time left in the current mode (idle pause, alert, wind-up, hurt, respawn). */
    timerMs: t.float64().noSync().default(0),
    /** sessionId being chased/attacked ('' = none). */
    target: t.string().noSync().default(''),
    /** Where a patrol is walking to. */
    goalX: t.float32().noSync().default(0),
    goalZ: t.float32().noSync().default(0),
    /** Wild pets: times fed by `trustBy` (playerId), toward befriending it (pets.ts). */
    trust: t.uint8().default(0),
    trustBy: t.string().noSync().default(''),
  },
  'CreatureState',
);
export type CreatureState = SchemaType<typeof CreatureState>;

/** A player's pet (or its egg, while `kind` is ''). Saved with the home (ADR-024). */
export const PetState = schema(
  {
    /** PetKind, or '' while it's still an egg. */
    kind: t.string().default(''),
    name: t.string().default(''),
    /** The owner's sessionId while they're in the home ('' when offline). */
    ownerSession: t.string().default(''),
    /** PetOrder. */
    order: t.string().default('follow'),
    x: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.angle().default(0),
    /** Egg: 0 → 1 while hatching; 1 once hatched. */
    hatch: t.quantized({ min: 0, max: 1, bits: 8 }).default(0),
    /** Last visible action (PetAction) and a counter that changes each time. */
    action: t.string().default(''),
    actionSeq: t.uint8().default(0),
    /** Scouts (ghost): the creature it marks on the owner's compass ('' = none). */
    mark: t.string().default(''),
    // --- server-only ---
    /** The owner's playerId (saves are keyed by it). */
    owner: t.string().noSync().default(''),
    hatchMs: t.float64().noSync().default(0),
    cooldownMs: t.float64().noSync().default(0),
    stuckMs: t.float64().noSync().default(0),
  },
  'PetState',
);
export type PetState = SchemaType<typeof PetState>;

/** A trap on the ground (snare or spike), set by a player. Saved with the home. */
export const TrapState = schema(
  {
    kind: t.string().default(''),
    x: t.float32().default(0),
    z: t.float32().default(0),
    /** Went off (caught or hurt something); [E] picks it back up to reset it. */
    sprung: t.boolean().default(false),
    /** playerId of whoever set it (XP and hit credit); server-only. */
    owner: t.string().noSync().default(''),
  },
  'TrapState',
);
export type TrapState = SchemaType<typeof TrapState>;

/** An arrow in flight. Simulated on the server; clients interpolate and orient it. */
export const ProjectileState = schema(
  {
    x: t.float32().default(0),
    y: t.float32().default(0),
    z: t.float32().default(0),
    // --- server-only flight ---
    vx: t.float64().noSync().default(0),
    vy: t.float64().noSync().default(0),
    vz: t.float64().noSync().default(0),
    ageMs: t.float64().noSync().default(0),
    damage: t.uint8().noSync().default(0),
    /** sessionId of the shooter (creatures turn on them; they get the XP). */
    owner: t.string().noSync().default(''),
  },
  'ProjectileState',
);
export type ProjectileState = SchemaType<typeof ProjectileState>;

/** A spot someone marked on the shared map (Phase 12). Saved. */
export const MarkerState = schema(
  {
    x: t.float32().default(0),
    z: t.float32().default(0),
  },
  'MarkerState',
);
export type MarkerState = SchemaType<typeof MarkerState>;

/** One of today's shared goals (goals.ts). */
export const GoalState = schema(
  {
    kind: t.string().default(''),
    target: t.uint8().default(0),
    progress: t.uint8().default(0),
  },
  'GoalState',
);
export type GoalState = SchemaType<typeof GoalState>;

/** What the home did today; shown in the morning summary, then reset. */
export const DayStats = schema(
  {
    hunted: t.uint16().default(0),
    meals: t.uint16().default(0),
    gathered: t.uint16().default(0),
    crafted: t.uint16().default(0),
    revives: t.uint16().default(0),
  },
  'DayStats',
);
export type DayStats = SchemaType<typeof DayStats>;

export const HomeState = schema(
  {
    phase: t.string().default(GamePhase.Lobby),
    day: t.uint16().default(1),
    /** 0 = midnight … 0.5 = noon (world/time.ts). Server-owned. */
    timeOfDay: t.quantized({ min: 0, max: 1, mode: 'wrap', bits: 16 }).default(NEW_HOME_TIME),
    /** Keyed by Colyseus sessionId. */
    players: t.map(PlayerState),
    /** Shared storage chest, fixed-length slot array. */
    chest: t.array(ItemStack),
    stove: StoveState,
    /** Keyed by resource node id. */
    resources: t.map(ResourceState),
    /** Keyed by creature id (`boar-0`…). Not saved: a re-opened home has fresh creatures. */
    creatures: t.map(CreatureState),
    /** Arrows in flight, keyed by a per-room counter. */
    projectiles: t.map(ProjectileState),
    /** Traps on the ground, keyed `trap-<n>`. */
    traps: t.map(TrapState),
    /** Pets and eggs, keyed `pet-<n>`. */
    pets: t.map(PetState),
    /** The shared map (Phase 12): revealed cells (by index), discovered landmarks (by id). */
    explored: t.map('boolean'),
    discovered: t.map('boolean'),
    /** Landmark caches already emptied today (refilled every morning). */
    caches: t.map('boolean'),
    /** Spots marked on the map, keyed `mark-<n>`. */
    markers: t.map(MarkerState),
    /** Today's shared goals (ADR-018). */
    goals: t.array(GoalState),
    today: DayStats,
  },
  'HomeState',
);
export type HomeState = SchemaType<typeof HomeState>;
