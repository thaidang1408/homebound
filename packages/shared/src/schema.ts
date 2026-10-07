import { schema, t, type SchemaType } from '@colyseus/schema';
import { MAX_PITCH } from './constants.js';

export const GamePhase = {
  Lobby: 'lobby',
  Playing: 'playing',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/**
 * Synced per-player state. Position is client-predicted, server-validated (ADR-007).
 * Every primitive needs an explicit default: schema-builder numbers otherwise start as
 * `undefined` on the client.
 */
export const PlayerState = schema(
  {
    name: t.string().default(''),
    /** 1 or 2: display order and spawn point. */
    slot: t.uint8().default(0),
    ready: t.boolean().default(false),
    connected: t.boolean().default(true),
    x: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.angle().default(0),
    pitch: t.quantized({ min: -MAX_PITCH, max: MAX_PITCH }).default(0),
  },
  'PlayerState',
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const HomeState = schema(
  {
    phase: t.string().default(GamePhase.Lobby),
    /** Keyed by Colyseus sessionId. */
    players: t.map(PlayerState),
  },
  'HomeState',
);
export type HomeState = SchemaType<typeof HomeState>;
