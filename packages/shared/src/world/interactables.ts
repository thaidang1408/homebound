import type { Box } from './collision.js';
import { FURNITURE, HOUSE_COLLIDERS, type InteractableKind } from './house.js';
import { LANDMARKS, LANDMARK_COLLIDERS, WAYSTONES, cacheId } from './landmarks.js';
import { RESOURCE_NODES } from './layout.js';
import { LANTERN_OFFSET, lanternId } from '../quests.js';
import type { ResourceKind } from './resources.js';

/** Landmark parts [E] can use (Phase 12): loot caches, waystones, the tower, the shrine. */
export type LandmarkInteractable = 'cache' | 'waystone' | 'tower' | 'shrine' | 'lantern';

/** Everything [E] can target: house furniture, outdoor resource nodes and landmark parts. */
export interface Interactable {
  id: string;
  kind: InteractableKind | ResourceKind | LandmarkInteractable;
  box: Box;
}

const around = (p: { x: number; z: number }, half: number): Box => ({
  minX: p.x - half,
  maxX: p.x + half,
  minZ: p.z - half,
  maxZ: p.z + half,
});

export const INTERACTABLES: readonly Interactable[] = [
  ...FURNITURE.flatMap((f) => (f.kind === 'decor' ? [] : [{ id: f.id, kind: f.kind, box: f.box }])),
  ...RESOURCE_NODES.map((n) => ({ id: n.id, kind: n.kind, box: n.reach })),
  ...LANDMARKS.flatMap((l): Interactable[] => [
    ...(l.cache ? [{ id: cacheId(l), kind: 'cache' as const, box: around(l.cache.at, 0.5) }] : []),
    ...(l.kind === 'watchtower'
      ? [{ id: `tower-${l.id}`, kind: 'tower' as const, box: around(l, 1.6) }]
      : []),
    ...(l.kind === 'shrine'
      ? [{ id: `shrine-${l.id}`, kind: 'shrine' as const, box: around(l, 0.8) }]
      : []),
  ]),
  ...WAYSTONES.map((w) => ({ id: w.id, kind: 'waystone' as const, box: around(w.at, 0.45) })),
  // The great lanterns of the story (Phase 13), one at each landmark.
  ...LANDMARKS.map((l) => ({
    id: lanternId(l.id),
    kind: 'lantern' as const,
    box: around({ x: l.x + LANTERN_OFFSET.x, z: l.z + LANTERN_OFFSET.z }, 0.4),
  })),
];

const byId = new Map(INTERACTABLES.map((i) => [i.id, i]));

export function findInteractable(id: string): Interactable | undefined {
  return byId.get(id);
}

/** Everything a player can't walk through: the house plus trees and rocks. */
export const WORLD_COLLIDERS: readonly Box[] = [
  ...HOUSE_COLLIDERS,
  ...LANDMARK_COLLIDERS,
  ...RESOURCE_NODES.flatMap((n) => (n.collider ? [n.collider] : [])),
];
