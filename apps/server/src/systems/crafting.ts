import { RECIPES, type RecipeId } from '@homebound/shared';
import { addItem, countItem, removeItem, spaceFor, type Slots } from '../inventory/inventory.js';

export type CraftOutcome = 'crafted' | 'missing-materials' | 'inventory-full';

/** Crafts from the player's backpack, all or nothing. */
export function craft(inventory: Slots, recipeId: RecipeId): CraftOutcome {
  const recipe = RECIPES[recipeId];
  if (recipe.inputs.some((i) => countItem(inventory, i.itemId) < i.qty)) return 'missing-materials';
  // ponytail: ignores the space the inputs would free; a full backpack must make room first.
  if (spaceFor(inventory, recipe.output) < recipe.qty) return 'inventory-full';
  for (const i of recipe.inputs) removeItem(inventory, i.itemId, i.qty);
  addItem(inventory, recipe.output, recipe.qty);
  return 'crafted';
}
