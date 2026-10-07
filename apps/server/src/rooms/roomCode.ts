import { randomInt } from 'node:crypto';
import type { Presence } from '@colyseus/core';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@homebound/shared';

/** Presence set holding every room code in use (works unchanged with RedisPresence later). */
const ROOM_CODES_KEY = '$homebound:room-codes';

function randomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Generates a code not used by any live room and reserves it. */
export async function reserveRoomCode(presence: Presence): Promise<string> {
  const used = new Set<string>(await presence.smembers(ROOM_CODES_KEY));
  let code: string;
  do {
    code = randomCode();
  } while (used.has(code));
  await presence.sadd(ROOM_CODES_KEY, code);
  return code;
}

export async function releaseRoomCode(presence: Presence, code: string): Promise<void> {
  await presence.srem(ROOM_CODES_KEY, code);
}
