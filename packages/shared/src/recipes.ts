import type { ItemId } from './items.js';

/** Where a recipe is made: the workbench, or the stove (combination dishes, made at once). */
export type CraftStation = 'workbench' | 'stove';

/** Recipes. Data only; the server checks the station, the inputs, and crafts atomically. */
export interface RecipeDefinition {
  station: CraftStation;
  output: ItemId;
  qty: number;
  inputs: readonly { itemId: ItemId; qty: number }[];
}

export const RECIPES = {
  spear: {
    station: 'workbench',
    output: 'spear',
    qty: 1,
    inputs: [
      { itemId: 'wood', qty: 3 },
      { itemId: 'stone', qty: 2 },
    ],
  },
  bow: { station: 'workbench', output: 'bow', qty: 1, inputs: [{ itemId: 'wood', qty: 4 }] },
  arrows: {
    station: 'workbench',
    output: 'arrow',
    qty: 5,
    inputs: [
      { itemId: 'wood', qty: 1 },
      { itemId: 'stone', qty: 1 },
    ],
  },
  antler_spear: {
    station: 'workbench',
    output: 'antler_spear',
    qty: 1,
    inputs: [
      { itemId: 'wood', qty: 2 },
      { itemId: 'antler', qty: 1 },
      { itemId: 'stone', qty: 1 },
    ],
  },
  leather_armor: {
    station: 'workbench',
    output: 'leather_armor',
    qty: 1,
    inputs: [{ itemId: 'hide', qty: 3 }],
  },
  bear_coat: {
    station: 'workbench',
    output: 'bear_coat',
    qty: 1,
    inputs: [
      { itemId: 'hide', qty: 3 },
      { itemId: 'bear_claw', qty: 1 },
    ],
  },
  snare: {
    station: 'workbench',
    output: 'snare',
    qty: 2,
    inputs: [
      { itemId: 'wood', qty: 1 },
      { itemId: 'hide', qty: 1 },
    ],
  },
  spike_trap: {
    station: 'workbench',
    output: 'spike_trap',
    qty: 1,
    inputs: [
      { itemId: 'wood', qty: 3 },
      { itemId: 'stone', qty: 2 },
    ],
  },
  stew: {
    station: 'stove',
    output: 'stew',
    qty: 1,
    inputs: [
      { itemId: 'raw_meat', qty: 1 },
      { itemId: 'berries', qty: 2 },
      { itemId: 'mushroom', qty: 1 },
    ],
  },
  mushroom_skewer: {
    station: 'stove',
    output: 'mushroom_skewer',
    qty: 1,
    inputs: [
      { itemId: 'mushroom', qty: 2 },
      { itemId: 'wood', qty: 1 },
    ],
  },
} as const satisfies Record<string, RecipeDefinition>;

export type RecipeId = keyof typeof RECIPES;

export function isRecipeId(value: string): value is RecipeId {
  return Object.hasOwn(RECIPES, value);
}

/** Recipes made at a station, in catalogue order. */
export function recipesAt(station: CraftStation): RecipeId[] {
  return (Object.keys(RECIPES) as RecipeId[]).filter((id) => RECIPES[id].station === station);
}
