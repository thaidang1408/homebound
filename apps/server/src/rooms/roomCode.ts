import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@homebound/shared';

/**
 * Codes of homes that have a running room. Claim/release are synchronous, so two players opening
 * the same saved home at the same instant can't both create a room for it.
 * ponytail: single-process only; move to Redis presence (SADD return value) if we ever run
 * several server processes.
 */
const openCodes = new Set<string>();

function randomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Claims `code` for a running room. False if a room for it is already open. */
export function claimCode(code: string): boolean {
  if (openCodes.has(code)) return false;
  openCodes.add(code);
  return true;
}

/** Generates and claims a code that is neither running nor taken by a saved home. */
export function claimNewCode(isSaved: (code: string) => boolean): string {
  let code: string;
  do {
    code = randomCode();
  } while (openCodes.has(code) || isSaved(code));
  openCodes.add(code);
  return code;
}

export function releaseCode(code: string): void {
  openCodes.delete(code);
}
