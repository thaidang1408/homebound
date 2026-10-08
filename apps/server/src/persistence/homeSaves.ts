import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { logger } from '@colyseus/core';
import {
  CHEST_SLOTS,
  HEALTH_MAX,
  HUNGER_MAX,
  HATCH_MS,
  LANDMARKS,
  MAP_CELLS,
  MAX_MAP_MARKERS,
  MAX_PLAYERS,
  MAX_TRAPS,
  NEW_HOME_TIME,
  PETS_PER_PLAYER,
  PET_ORDERS,
  PLAYER_INVENTORY_SLOTS,
  RESOURCE_KINDS,
  findResourceNode,
  StoveStatus,
  WORLD_RADIUS,
  getItem,
  isGoalKind,
  findLandmark,
  isItemId,
  isMapCell,
  isPetKind,
  isValidPlayerId,
  sanitizePetName,
  isValidRoomCode,
  type ItemId,
  type PetOrder,
} from '@homebound/shared';

/**
 * Saved homes: one JSON file per home code (ADR-009). Everything read back is validated; a save
 * file is data from disk, not trusted state.
 */
export const SAVE_VERSION = 1;

export interface SavedStack {
  itemId: ItemId;
  qty: number;
}

/** null = empty slot; arrays keep slot positions. */
export type SavedSlots = (SavedStack | null)[];

export interface SavedPlayer {
  name: string;
  hunger: number;
  /** Missing in saves from before Phase 4 → full health. */
  health: number;
  xp: number;
  x: number;
  z: number;
  yaw: number;
  inventory: SavedSlots;
}

export interface HomeSave {
  version: typeof SAVE_VERSION;
  code: string;
  createdAt: string;
  updatedAt: string;
  day: number;
  /** 0–1, see world/time.ts. */
  timeOfDay: number;
  chest: SavedSlots;
  stove: { status: string; itemId: string; elapsedMs: number; cookedBy: string };
  /** Remaining charges per resource node id; nodes not listed are full. */
  resources: Record<string, number>;
  /** Keyed by playerId, including players who are offline right now. */
  players: Record<string, SavedPlayer>;
  /** Today's goals and stats; missing in pre-Phase 6 saves (new goals are picked). */
  goals: SavedGoal[];
  today: SavedDayStats;
  /** Traps on the ground by id; missing in pre-Phase 10 saves. */
  traps: Record<string, SavedTrap>;
  /** Pets and eggs by id; missing in pre-Phase 11 saves. */
  pets: Record<string, SavedPet>;
  /** The shared map (Phase 12; missing before): revealed cells, discovered landmark ids… */
  explored: number[];
  discovered: string[];
  /** …landmark caches emptied today, and marked spots. */
  caches: string[];
  markers: { x: number; z: number }[];
}

export interface SavedPet {
  /** PetKind, or '' for an egg. */
  kind: string;
  name: string;
  /** playerId of the owner (required: a pet always has someone). */
  owner: string;
  order: PetOrder;
  x: number;
  z: number;
  /** Egg: how long it has been hatching. */
  hatchMs: number;
}

export interface SavedTrap {
  kind: 'snare' | 'spike';
  x: number;
  z: number;
  sprung: boolean;
  /** playerId, or '' if it's gone. */
  owner: string;
}

export interface SavedGoal {
  kind: string;
  target: number;
  progress: number;
}

export interface SavedDayStats {
  hunted: number;
  meals: number;
  gathered: number;
  crafted: number;
  revives: number;
}

let saveDir = resolve(process.env.HOMEBOUND_SAVE_DIR ?? 'data/homes');

/** Tests point this at a temp directory. */
export function setSaveDir(dir: string): void {
  saveDir = resolve(dir);
}

function fileFor(code: string): string {
  // The code is validated before it ever reaches a path, so no traversal is possible.
  if (!isValidRoomCode(code)) throw new Error(`invalid home code: ${code}`);
  return join(saveDir, `${code}.json`);
}

export function homeExists(code: string): boolean {
  return isValidRoomCode(code) && existsSync(fileFor(code));
}

/** Called after every save, e.g. to copy it to a database (see mirror.ts). */
let onSaved: ((save: HomeSave) => void) | null = null;
export function setSaveMirror(mirror: typeof onSaved): void {
  onSaved = mirror;
}

/** Writes atomically (temp file + rename) so a crash mid-write never leaves a half file. */
function writeFile(code: string, json: string): void {
  mkdirSync(saveDir, { recursive: true });
  const target = fileFor(code);
  const temp = `${target}.tmp`;
  writeFileSync(temp, json);
  renameSync(temp, target);
}

export function saveHome(save: HomeSave): void {
  writeFile(save.code, JSON.stringify(save, null, 2));
  onSaved?.(save);
}

/**
 * Puts mirrored saves back on disk after the host wiped it. A file already on disk is at least as
 * new as its mirror, so it is kept. Rows are validated later by loadHome, like any file.
 */
export function restoreSaves(rows: { code: string; save: unknown }[]): number {
  let restored = 0;
  for (const { code, save } of rows) {
    if (!isValidRoomCode(code) || homeExists(code)) continue;
    writeFile(code, JSON.stringify(save, null, 2));
    restored++;
  }
  return restored;
}

/** Loads and validates a save. A corrupt file is kept aside (never overwritten) and reported as missing. */
export function loadHome(code: string): HomeSave | null {
  if (!homeExists(code)) return null;
  const file = fileFor(code);
  try {
    const save = parseSave(JSON.parse(readFileSync(file, 'utf8')), code);
    if (save) return save;
  } catch (error) {
    logger.error(`[saves] ${code} unreadable`, error);
  }
  const aside = `${file}.corrupt-${Date.now()}`;
  renameSync(file, aside);
  logger.error(`[saves] ${code} is corrupt, moved to ${aside}`);
  return null;
}

// --- validation of data read from disk ---

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

function parseSlots(value: unknown, length: number): SavedSlots {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, i) => {
    const s: unknown = list[i];
    if (!isObject(s) || typeof s.itemId !== 'string' || !isItemId(s.itemId)) return null;
    const qty = Math.floor(num(s.qty, 0, 0, getItem(s.itemId).maxStack));
    return qty > 0 ? { itemId: s.itemId, qty } : null;
  });
}

function parsePlayer(value: unknown): SavedPlayer | null {
  if (!isObject(value)) return null;
  return {
    name: str(value.name).slice(0, 32),
    hunger: num(value.hunger, HUNGER_MAX, 0, HUNGER_MAX),
    // Never load a 0-health player: they'd be stuck unconscious.
    health: num(value.health, HEALTH_MAX, 1, HEALTH_MAX),
    xp: Math.floor(num(value.xp, 0, 0, 2 ** 31)),
    x: num(value.x, 0),
    z: num(value.z, 0),
    yaw: num(value.yaw, 0),
    inventory: parseSlots(value.inventory, PLAYER_INVENTORY_SLOTS),
  };
}

export function parseSave(value: unknown, code: string): HomeSave | null {
  if (!isObject(value) || value.version !== SAVE_VERSION || value.code !== code) return null;
  const stove = isObject(value.stove) ? value.stove : {};
  const status = Object.values(StoveStatus).find((s) => s === stove.status) ?? StoveStatus.Idle;
  const players: Record<string, SavedPlayer> = {};
  if (isObject(value.players)) {
    for (const [id, raw] of Object.entries(value.players)) {
      const player = parsePlayer(raw);
      if (player && isValidPlayerId(id)) players[id] = player;
    }
  }
  return {
    version: SAVE_VERSION,
    code,
    createdAt: str(value.createdAt, new Date().toISOString()),
    updatedAt: str(value.updatedAt, new Date().toISOString()),
    day: Math.floor(num(value.day, 1, 1, 65535)),
    timeOfDay: num(value.timeOfDay, NEW_HOME_TIME, 0, 0.9999),
    chest: parseSlots(value.chest, CHEST_SLOTS),
    stove: {
      status,
      itemId: isItemId(str(stove.itemId)) ? str(stove.itemId) : '',
      elapsedMs: num(stove.elapsedMs, 0, 0),
      cookedBy: str(stove.cookedBy),
    },
    resources: parseResources(value.resources),
    players,
    goals: parseGoals(value.goals),
    today: parseToday(value.today),
    traps: parseTraps(value.traps),
    pets: parsePets(value.pets),
    explored: parseList(value.explored, isMapCell, MAP_CELLS * MAP_CELLS),
    discovered: parseList(value.discovered, isLandmarkId, LANDMARKS.length),
    caches: parseList(value.caches, isLandmarkId, LANDMARKS.length),
    markers: parseMarkers(value.markers),
  };
}

const TRAP_ID = /^trap-\d{1,6}$/;

function parseTraps(value: unknown): Record<string, SavedTrap> {
  const out: Record<string, SavedTrap> = {};
  if (!isObject(value)) return out;
  for (const [id, raw] of Object.entries(value)) {
    if (Object.keys(out).length >= MAX_TRAPS) break;
    if (!TRAP_ID.test(id) || !isObject(raw)) continue;
    const kind = raw.kind === 'snare' || raw.kind === 'spike' ? raw.kind : null;
    const x = num(raw.x, NaN, -WORLD_RADIUS, WORLD_RADIUS);
    const z = num(raw.z, NaN, -WORLD_RADIUS, WORLD_RADIUS);
    if (!kind || Number.isNaN(x) || Number.isNaN(z)) continue;
    const owner = str(raw.owner);
    out[id] = {
      kind,
      x,
      z,
      sprung: raw.sprung === true,
      owner: isValidPlayerId(owner) ? owner : '',
    };
  }
  return out;
}

/** A list of distinct valid values (anything else dropped). */
function parseList<T>(value: unknown, valid: (v: never) => boolean, max: number): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)].filter((v) => valid(v as never)).slice(0, max) as T[];
}
const isLandmarkId = (v: unknown) => typeof v === 'string' && !!findLandmark(v);

function parseMarkers(value: unknown): { x: number; z: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((m: unknown) => {
      if (!isObject(m)) return [];
      const x = num(m.x, NaN, -WORLD_RADIUS, WORLD_RADIUS);
      const z = num(m.z, NaN, -WORLD_RADIUS, WORLD_RADIUS);
      return Number.isNaN(x) || Number.isNaN(z) ? [] : [{ x, z }];
    })
    .slice(-MAX_MAP_MARKERS);
}

const PET_ID = /^pet-\d{1,6}$/;
/** Generous: owners include players who are offline, and claimed characters keep their pets. */
const MAX_SAVED_PETS = MAX_PLAYERS * PETS_PER_PLAYER * 4;

function parsePets(value: unknown): Record<string, SavedPet> {
  const out: Record<string, SavedPet> = {};
  if (!isObject(value)) return out;
  const perOwner = new Map<string, number>();
  for (const [id, raw] of Object.entries(value)) {
    if (Object.keys(out).length >= MAX_SAVED_PETS) break;
    if (!PET_ID.test(id) || !isObject(raw)) continue;
    const owner = str(raw.owner);
    const kind = str(raw.kind);
    const x = num(raw.x, NaN, -WORLD_RADIUS, WORLD_RADIUS);
    const z = num(raw.z, NaN, -WORLD_RADIUS, WORLD_RADIUS);
    if (!isValidPlayerId(owner) || (kind !== '' && !isPetKind(kind))) continue;
    if (Number.isNaN(x) || Number.isNaN(z)) continue;
    const owned = perOwner.get(owner) ?? 0;
    if (owned >= PETS_PER_PLAYER) continue;
    perOwner.set(owner, owned + 1);
    out[id] = {
      kind,
      name: sanitizePetName(raw.name),
      owner,
      order: PET_ORDERS.find((o) => o === raw.order) ?? 'follow',
      x,
      z,
      hatchMs: num(raw.hatchMs, 0, 0, HATCH_MS),
    };
  }
  return out;
}

const UINT8 = 255;
const UINT16 = 65535;

function parseGoals(value: unknown): SavedGoal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((g: unknown) => {
    if (!isObject(g) || typeof g.kind !== 'string' || !isGoalKind(g.kind)) return [];
    const target = Math.floor(num(g.target, 1, 1, UINT8));
    return [{ kind: g.kind, target, progress: Math.floor(num(g.progress, 0, 0, target)) }];
  });
}

function parseToday(value: unknown): SavedDayStats {
  const v = isObject(value) ? value : {};
  const count = (x: unknown) => Math.floor(num(x, 0, 0, UINT16));
  return {
    hunted: count(v.hunted),
    meals: count(v.meals),
    gathered: count(v.gathered),
    crafted: count(v.crafted),
    revives: count(v.revives),
  };
}

function parseResources(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(value)) return out;
  for (const [id, charges] of Object.entries(value)) {
    const node = findResourceNode(id);
    if (node) out[id] = Math.floor(num(charges, 0, 0, RESOURCE_KINDS[node.kind].charges));
  }
  return out;
}
