import {
  MAX_PITCH,
  MOVE_DISTANCE_SLACK,
  MOVE_SPEED_TOLERANCE,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_SPRINT_SPEED,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  WORLD_RADIUS,
} from './constants.js';
import type { MovePayload, ReadyPayload } from './protocol.js';

/** Uppercases and strips spaces/dashes so "ab c-12" matches "ABC12". */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH && [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))
  );
}

/** Trims, removes control characters, caps length. Empty result means "use a default". */
export function sanitizePlayerName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, PLAYER_NAME_MAX_LENGTH)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Returns a well-formed move payload or null. Never trust the shape of client data. */
export function parseMovePayload(value: unknown): MovePayload | null {
  if (!isRecord(value)) return null;
  const { x, z, yaw, pitch } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(z) || !isFiniteNumber(yaw) || !isFiniteNumber(pitch)) {
    return null;
  }
  return { x, z, yaw, pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)) };
}

export function parseReadyPayload(value: unknown): ReadyPayload | null {
  if (!isRecord(value) || typeof value.ready !== 'boolean') return null;
  return { ready: value.ready };
}

/** Clamps a point into the playable circle. */
export function clampToWorld(x: number, z: number): { x: number; z: number } {
  const dist = Math.hypot(x, z);
  if (dist <= WORLD_RADIUS) return { x, z };
  const scale = WORLD_RADIUS / dist;
  return { x: x * scale, z: z * scale };
}

/** True if moving from `from` to `to` in `elapsedMs` is physically possible for a player. */
export function isMoveWithinSpeed(
  from: { x: number; z: number },
  to: { x: number; z: number },
  elapsedMs: number,
): boolean {
  const maxDistance =
    PLAYER_SPRINT_SPEED * MOVE_SPEED_TOLERANCE * (Math.max(0, elapsedMs) / 1000) +
    MOVE_DISTANCE_SLACK;
  return Math.hypot(to.x - from.x, to.z - from.z) <= maxDistance;
}
