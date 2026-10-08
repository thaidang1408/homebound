import { describe, expect, test } from 'vitest';
import { CHAT_MAX_LENGTH, MAX_PITCH, WORLD_RADIUS } from './constants.js';
import {
  clampToWorld,
  isMoveWithinSpeed,
  isValidRoomCode,
  normalizeRoomCode,
  parseMovePayload,
  parseInteractPayload,
  parseReadyPayload,
  parseTransferPayload,
  parseUseItemPayload,
  sanitizeChatText,
  sanitizePlayerName,
} from './validation.js';

describe('room codes', () => {
  test('normalizes case, spaces and dashes', () => {
    expect(normalizeRoomCode(' ab c-2d ')).toBe('ABC2D');
  });

  test('accepts only alphabet characters at the right length', () => {
    expect(isValidRoomCode('ABC23')).toBe(true);
    expect(isValidRoomCode('ABC2')).toBe(false);
    expect(isValidRoomCode('ABC0O')).toBe(false); // look-alikes excluded
  });
});

describe('player names', () => {
  test('strips control characters and caps length', () => {
    expect(sanitizePlayerName('  Hien\u0000\n ')).toBe('Hien');
    expect(sanitizePlayerName('x'.repeat(40))).toHaveLength(16);
  });

  test('chat text is cleaned and capped', () => {
    expect(sanitizeChatText('  chào\n\n  bé \u0007 ơi  ')).toBe('chào bé ơi');
    expect(sanitizeChatText('a'.repeat(300))).toHaveLength(CHAT_MAX_LENGTH);
    expect(sanitizeChatText('   ')).toBe('');
    expect(sanitizeChatText(42)).toBe('');
    expect(sanitizePlayerName(42)).toBe('');
  });
});

describe('message parsing', () => {
  test('rejects malformed move payloads', () => {
    expect(parseMovePayload(null)).toBeNull();
    expect(parseMovePayload({ x: 1, z: 2, yaw: 0 })).toBeNull();
    expect(parseMovePayload({ x: Number.NaN, z: 2, yaw: 0, pitch: 0 })).toBeNull();
    expect(parseMovePayload({ x: '1', z: 2, yaw: 0, pitch: 0 })).toBeNull();
  });

  test('clamps pitch', () => {
    expect(parseMovePayload({ x: 1, z: 2, yaw: 0, pitch: 99 })?.pitch).toBe(MAX_PITCH);
  });

  test('interaction payloads need exact shapes', () => {
    expect(parseInteractPayload({ targetId: 'stove' })).toEqual({ targetId: 'stove' });
    expect(parseInteractPayload({ targetId: 3 })).toBeNull();
    expect(parseTransferPayload({ from: 'chest', slot: 2 })).toEqual({ from: 'chest', slot: 2 });
    expect(parseTransferPayload({ from: 'fridge', slot: 2 })).toBeNull();
    expect(parseTransferPayload({ from: 'player', slot: 1.5 })).toBeNull();
    expect(parseUseItemPayload({ slot: -1 })).toBeNull();
  });

  test('ready payload must carry a boolean', () => {
    expect(parseReadyPayload({ ready: true })).toEqual({ ready: true });
    expect(parseReadyPayload({ ready: 'yes' })).toBeNull();
  });
});

describe('movement rules', () => {
  test('clamps positions outside the world circle', () => {
    const p = clampToWorld(WORLD_RADIUS * 2, 0);
    expect(p.x).toBeCloseTo(WORLD_RADIUS);
    expect(clampToWorld(1, 1)).toEqual({ x: 1, z: 1 });
  });

  test('allows sprint-speed steps and rejects teleports', () => {
    const origin = { x: 0, z: 0 };
    expect(isMoveWithinSpeed(origin, { x: 0.35, z: 0 }, 50)).toBe(true);
    expect(isMoveWithinSpeed(origin, { x: 10, z: 0 }, 50)).toBe(false);
  });
});
