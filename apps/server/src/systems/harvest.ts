import {
  HARVEST_COOLDOWN_MS,
  RESOURCE_KINDS,
  RESOURCE_NODES,
  ResourceState,
  type HomeState,
  type PlayerState,
  type ResourceNodeDefinition,
} from '@homebound/shared';
import { addItem, spaceFor } from '../inventory/inventory.js';

export type HarvestOutcome = 'harvested' | 'depleted' | 'cooldown' | 'inventory-full';

/** Every node starts full. Saved homes overwrite charges afterwards. */
export function initResources(state: HomeState): void {
  for (const node of RESOURCE_NODES) {
    const r = new ResourceState();
    r.charges = RESOURCE_KINDS[node.kind].charges;
    state.resources.set(node.id, r);
  }
}

/**
 * One harvest: checks charges, the player's cooldown and backpack space, then gives the drop.
 * `lastHarvestAt` is the caller's per-player clock (ms).
 */
export function harvest(
  state: HomeState,
  player: PlayerState,
  node: ResourceNodeDefinition,
  now: number,
  lastHarvestAt: number,
): HarvestOutcome {
  const live = state.resources.get(node.id);
  const def = RESOURCE_KINDS[node.kind];
  if (!live || live.charges === 0) return 'depleted';
  if (now - lastHarvestAt < HARVEST_COOLDOWN_MS) return 'cooldown';
  if (spaceFor(player.inventory, def.drop) < def.qty) return 'inventory-full';

  addItem(player.inventory, def.drop, def.qty);
  live.charges -= 1;
  if (live.charges === 0) live.respawnMs = def.respawnMs;
  return 'harvested';
}

/** Depleted nodes count down and grow back full. */
export function tickResources(state: HomeState, dtMs: number): void {
  for (const node of RESOURCE_NODES) {
    const live = state.resources.get(node.id);
    if (!live || live.charges > 0) continue;
    live.respawnMs -= dtMs;
    if (live.respawnMs <= 0) {
      live.respawnMs = 0;
      live.charges = RESOURCE_KINDS[node.kind].charges;
    }
  }
}
