import {
  DISCOVER_RANGE,
  HEALTH_MAX,
  INTERACT_RANGE,
  INTERACT_TOLERANCE,
  LANDMARKS,
  MARKER_TOGGLE_DISTANCE,
  MAX_MAP_MARKERS,
  MarkerState,
  REVEAL_RADIUS,
  TOWER_VIEW,
  WAYSTONES,
  WAYSTONE_ARRIVE_OFFSET,
  cellsAround,
  findLandmark,
  findWaystone,
  type HomeState,
  type ItemId,
  type PlayerState,
  type Point,
} from '@homebound/shared';
import { addItem, spaceFor } from '../inventory/inventory.js';
import type { Random } from './creatures.js';
import { setHealth } from './needs.js';

/**
 * Exploration (Phase 12, ADR-025): the shared map's fog lifts around both players, landmarks are
 * discovered by walking close (lighting their waystone), caches refill every morning.
 */

function reveal(state: HomeState, at: Point, radius: number): void {
  for (const i of cellsAround(at, radius)) {
    const key = String(i);
    if (!state.explored.has(key)) state.explored.set(key, true);
  }
}

/** Lifts the fog around every player; returns the landmarks discovered just now. */
export function tickExplore(state: HomeState): string[] {
  const found: string[] = [];
  for (const p of state.players.values()) {
    if (!p.connected) continue;
    reveal(state, p, REVEAL_RADIUS);
    for (const l of LANDMARKS) {
      if (state.discovered.has(l.id) || Math.hypot(l.x - p.x, l.z - p.z) > DISCOVER_RANGE) continue;
      state.discovered.set(l.id, true);
      found.push(l.id);
    }
  }
  return found;
}

/** A waystone is lit at home, and at every discovered landmark. */
export function isLit(state: HomeState, waystoneId: string): boolean {
  const w = findWaystone(waystoneId);
  return !!w && (w.landmark === '' || state.discovered.has(w.landmark));
}

const REACH = INTERACT_RANGE + INTERACT_TOLERANCE + 0.45; // the stone's half-size

/**
 * From a lit waystone the player stands at, to another lit one. Returns where they arrive (just in
 * front of it), or null if the trip isn't allowed.
 */
export function travel(state: HomeState, player: PlayerState, to: string): Point | null {
  const from = WAYSTONES.find(
    (w) => isLit(state, w.id) && Math.hypot(w.at.x - player.x, w.at.z - player.z) <= REACH,
  );
  const target = findWaystone(to);
  if (!from || !target || target.id === from.id || !isLit(state, to)) return null;
  // Arrive on the side facing home, clear of the stone.
  const d = Math.hypot(target.at.x, target.at.z) || 1;
  return {
    x: target.at.x - (target.at.x / d) * WAYSTONE_ARRIVE_OFFSET,
    z: target.at.z - (target.at.z / d) * WAYSTONE_ARRIVE_OFFSET,
  };
}

export type CacheOutcome = 'opened' | 'empty' | 'inventory-full' | 'invalid';

/** [E] on a landmark's cache: its loot (all or nothing), once per day for the whole home. */
export function openCache(
  state: HomeState,
  landmarkId: string,
  player: PlayerState,
  random: Random,
): CacheOutcome {
  const cache = findLandmark(landmarkId)?.cache;
  if (!cache) return 'invalid';
  if (state.caches.has(landmarkId)) return 'empty';
  const drops = new Map<ItemId, number>();
  for (const { itemId, min, max } of cache.loot) {
    const qty = min + Math.floor(random() * (max - min + 1));
    if (qty > 0) drops.set(itemId, (drops.get(itemId) ?? 0) + qty);
  }
  for (const [itemId, qty] of drops) {
    if (spaceFor(player.inventory, itemId) < qty) return 'inventory-full';
  }
  for (const [itemId, qty] of drops) addItem(player.inventory, itemId, qty);
  state.caches.set(landmarkId, true);
  return 'opened';
}

/** The view from the watchtower: the map is revealed far around it. */
export function climbTower(state: HomeState, landmarkId: string): boolean {
  const tower = findLandmark(landmarkId);
  if (tower?.kind !== 'watchtower') return false;
  reveal(state, tower, TOWER_VIEW);
  return true;
}

/** The spirit shrine heals you fully. */
export function pray(player: PlayerState): boolean {
  if (player.downed || player.healthExact >= HEALTH_MAX) return false;
  setHealth(player, HEALTH_MAX);
  return true;
}

/** A click on the map: removes a marker close to it, or adds one (the oldest goes past the cap). */
export function toggleMarker(state: HomeState, at: Point, id: string): 'added' | 'removed' {
  for (const [key, m] of state.markers) {
    if (Math.hypot(m.x - at.x, m.z - at.z) <= MARKER_TOGGLE_DISTANCE) {
      state.markers.delete(key);
      return 'removed';
    }
  }
  while (state.markers.size >= MAX_MAP_MARKERS) {
    const oldest = state.markers.keys().next().value;
    if (oldest === undefined) break;
    state.markers.delete(oldest);
  }
  const marker = new MarkerState();
  marker.x = at.x;
  marker.z = at.z;
  state.markers.set(id, marker);
  return 'added';
}
