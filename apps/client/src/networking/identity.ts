/**
 * Anonymous identity kept in this browser: links the player to their saved items and XP in a
 * home. Not an account — clearing site data starts fresh (ADR-010).
 */
const PLAYER_ID_KEY = 'homebound:player-id';
const LAST_HOME_KEY = 'homebound:last-home';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): identity lasts for this tab only.
  }
}

/** 32 hex chars. getRandomValues works on plain-http LAN pages, unlike randomUUID. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let cached: string | null = null;

export function getPlayerId(): string {
  cached ??= read(PLAYER_ID_KEY) ?? randomId();
  write(PLAYER_ID_KEY, cached);
  return cached;
}

export function getLastHome(): string | null {
  return read(LAST_HOME_KEY);
}

export function setLastHome(code: string): void {
  write(LAST_HOME_KEY, code);
}
