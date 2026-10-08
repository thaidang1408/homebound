import {
  MAX_PITCH,
  MOVE_DISTANCE_SLACK,
  MOVE_SPEED_TOLERANCE,
  PLAYER_ID_PATTERN,
  CHAT_MAX_LENGTH,
  PLAYER_NAME_MAX_LENGTH,
  PET_NAME_MAX_LENGTH,
  PLAYER_SPRINT_SPEED,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  WORLD_RADIUS,
} from './constants.js';
import { EMOTES, PET_COMMANDS } from './protocol.js';
import type {
  AttackPayload,
  CraftPayload,
  EmotePayload,
  InteractPayload,
  MovePayload,
  MoveSlotPayload,
  PetCommandPayload,
  PetNamePayload,
  PingPayload,
  ReadyPayload,
  TransferPayload,
  UseItemPayload,
} from './protocol.js';

/** Uppercases and strips spaces/dashes so "ab c-12" matches "ABC12". */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH && [...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))
  );
}

export function isValidPlayerId(value: unknown): value is string {
  return typeof value === 'string' && PLAYER_ID_PATTERN.test(value);
}

/** Removes control characters, collapses whitespace, trims and caps the length. */
function cleanText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength)
      .trim()
  );
}

/** Empty result means "use a default". */
export const sanitizePlayerName = (input: unknown): string =>
  cleanText(input, PLAYER_NAME_MAX_LENGTH);

/** Empty result means "send nothing". */
export const sanitizeChatText = (input: unknown): string => cleanText(input, CHAT_MAX_LENGTH);

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
  const pose: MovePayload = { x, z, yaw, pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)) };
  if (value.sprint === true) pose.sprint = true;
  if (value.crouch === true) pose.crouch = true;
  return pose;
}

export function parseEmotePayload(value: unknown): EmotePayload | null {
  if (!isRecord(value)) return null;
  const kind = EMOTES.find((e) => e === value.kind);
  return kind ? { kind } : null;
}

export function parsePingPayload(value: unknown): PingPayload | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.z)) return null;
  return { x: value.x, z: value.z };
}

/** Empty result means "keep the old name". */
export const sanitizePetName = (input: unknown): string => cleanText(input, PET_NAME_MAX_LENGTH);

export function parsePetCommandPayload(value: unknown): PetCommandPayload | null {
  if (!isRecord(value) || typeof value.petId !== 'string') return null;
  const command = PET_COMMANDS.find((c) => c === value.command);
  return command ? { petId: value.petId, command } : null;
}

export function parsePetNamePayload(value: unknown): PetNamePayload | null {
  if (!isRecord(value) || typeof value.petId !== 'string') return null;
  const name = sanitizePetName(value.name);
  return name ? { petId: value.petId, name } : null;
}

export function parseReadyPayload(value: unknown): ReadyPayload | null {
  if (!isRecord(value) || typeof value.ready !== 'boolean') return null;
  return { ready: value.ready };
}

/** Slot index shape only; the server checks it against the actual container length. */
function isSlotIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function parseInteractPayload(value: unknown): InteractPayload | null {
  if (!isRecord(value) || typeof value.targetId !== 'string') return null;
  return { targetId: value.targetId };
}

export function parseAttackPayload(value: unknown): AttackPayload | null {
  if (!isRecord(value) || !isSlotIndex(value.slot) || typeof value.targetId !== 'string') {
    return null;
  }
  const { yaw, pitch } = value;
  if (!isFiniteNumber(yaw) || !isFiniteNumber(pitch)) return null;
  return {
    slot: value.slot,
    targetId: value.targetId,
    yaw,
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)),
  };
}

export function parseCraftPayload(value: unknown): CraftPayload | null {
  if (!isRecord(value) || typeof value.recipeId !== 'string') return null;
  return { recipeId: value.recipeId };
}

export function parseMoveSlotPayload(value: unknown): MoveSlotPayload | null {
  if (!isRecord(value) || !isSlotIndex(value.from) || !isSlotIndex(value.to)) return null;
  if (value.container !== 'player' && value.container !== 'chest') return null;
  return { container: value.container, from: value.from, to: value.to };
}

export function parseTransferPayload(value: unknown): TransferPayload | null {
  if (!isRecord(value) || !isSlotIndex(value.slot)) return null;
  if (value.from !== 'player' && value.from !== 'chest') return null;
  return { from: value.from, slot: value.slot };
}

export function parseUseItemPayload(value: unknown): UseItemPayload | null {
  if (!isRecord(value) || !isSlotIndex(value.slot)) return null;
  return { slot: value.slot };
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
