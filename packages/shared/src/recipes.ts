import type { ItemId } from './items.js';

/** Workbench recipes. Data only; the server checks inputs and crafts atomically. */
export interface RecipeDefinition {
  output: ItemId;
  qty: number;
  inputs: readonly { itemId: ItemId; qty: number }[];
}

export const RECIPES = {
  spear: {
    output: 'spear',
    qty: 1,
    inputs: [
      { itemId: 'wood', qty: 3 },
      { itemId: 'stone', qty: 2 },
    ],
  },
  bow: { output: 'bow', qty: 1, inputs: [{ itemId: 'wood', qty: 4 }] },
  arrows: {
    output: 'arrow',
    qty: 5,
    inputs: [
      { itemId: 'wood', qty: 1 },
      { itemId: 'stone', qty: 1 },
    ],
  },
} as const satisfies Record<string, RecipeDefinition>;

export type RecipeId = keyof typeof RECIPES;

export function isRecipeId(value: string): value is RecipeId {
  return Object.hasOwn(RECIPES, value);
}
