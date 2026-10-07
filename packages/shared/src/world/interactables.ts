import type { Box } from './collision.js';
import { FURNITURE, HOUSE_COLLIDERS, type InteractableKind } from './house.js';
import { RESOURCE_NODES } from './layout.js';
import type { ResourceKind } from './resources.js';

/** Everything [E] can target: house furniture and outdoor resource nodes. */
export interface Interactable {
  id: string;
  kind: InteractableKind | ResourceKind;
  box: Box;
}

export const INTERACTABLES: readonly Interactable[] = [
  ...FURNITURE.flatMap((f) => (f.kind === 'decor' ? [] : [{ id: f.id, kind: f.kind, box: f.box }])),
  ...RESOURCE_NODES.map((n) => ({ id: n.id, kind: n.kind, box: n.reach })),
];

const byId = new Map(INTERACTABLES.map((i) => [i.id, i]));

export function findInteractable(id: string): Interactable | undefined {
  return byId.get(id);
}

/** Everything a player can't walk through: the house plus trees and rocks. */
export const WORLD_COLLIDERS: readonly Box[] = [
  ...HOUSE_COLLIDERS,
  ...RESOURCE_NODES.flatMap((n) => (n.collider ? [n.collider] : [])),
];
