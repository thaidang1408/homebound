import { describe, expect, test } from 'vitest';
import { getItem } from '@homebound/shared';
import {
  addItem,
  countItem,
  createSlots,
  itemAt,
  moveStack,
  moveWithin,
  removeItem,
  spaceFor,
  takeOne,
} from './inventory.js';

const MAX = getItem('raw_meat').maxStack;

describe('inventory', () => {
  test('adds into existing stacks before empty slots', () => {
    const slots = createSlots(3);
    expect(addItem(slots, 'raw_meat', 3)).toBe(0);
    expect(addItem(slots, 'raw_meat', 2)).toBe(0);
    expect(slots.at(0)?.qty).toBe(5);
    expect(itemAt(slots, 1)).toBeNull();
  });

  test('splits across slots and reports leftovers when full', () => {
    const slots = createSlots(2);
    expect(addItem(slots, 'raw_meat', MAX * 2 + 3)).toBe(3);
    expect(countItem(slots, 'raw_meat')).toBe(MAX * 2);
    expect(spaceFor(slots, 'raw_meat')).toBe(0);
  });

  test('keeps different items in separate stacks', () => {
    const slots = createSlots(2);
    addItem(slots, 'raw_meat', 1);
    addItem(slots, 'cooked_meat', 1);
    expect(itemAt(slots, 0)).toBe('raw_meat');
    expect(itemAt(slots, 1)).toBe('cooked_meat');
    expect(addItem(slots, 'cooked_meat', MAX)).toBe(1);
  });

  test('removeItem is all-or-nothing', () => {
    const slots = createSlots(2);
    addItem(slots, 'raw_meat', 4);
    expect(removeItem(slots, 'raw_meat', 5)).toBe(false);
    expect(countItem(slots, 'raw_meat')).toBe(4);
    expect(removeItem(slots, 'raw_meat', 4)).toBe(true);
    expect(itemAt(slots, 0)).toBeNull();
    expect(slots.at(0)?.itemId).toBe('');
  });

  test('takeOne empties a slot at zero and ignores bad indices', () => {
    const slots = createSlots(1);
    addItem(slots, 'cooked_meat', 1);
    expect(takeOne(slots, 0)).toBe('cooked_meat');
    expect(takeOne(slots, 0)).toBeNull();
    expect(takeOne(slots, 99)).toBeNull();
  });

  test('moveStack moves what fits and leaves the rest', () => {
    const from = createSlots(1);
    const to = createSlots(1);
    addItem(from, 'raw_meat', 6);
    addItem(to, 'raw_meat', MAX - 2);
    expect(moveStack(from, 0, to)).toBe(2);
    expect(from.at(0)?.qty).toBe(4);
    expect(countItem(to, 'raw_meat')).toBe(MAX);
  });

  test('moveStack of an empty or missing slot does nothing', () => {
    const from = createSlots(1);
    const to = createSlots(1);
    expect(moveStack(from, 0, to)).toBe(0);
    expect(moveStack(from, 5, to)).toBe(0);
  });
});

describe('rearranging a container', () => {
  const at = (slots: ReturnType<typeof createSlots>, i: number) => {
    const s = slots.at(i);
    return s && s.qty > 0 ? `${s.itemId}:${s.qty}` : 'empty';
  };

  test('moves onto an empty slot', () => {
    const slots = createSlots(3);
    addItem(slots, 'wood', 4);
    expect(moveWithin(slots, 0, 2)).toBe(true);
    expect([at(slots, 0), at(slots, 2)]).toEqual(['empty', 'wood:4']);
  });

  test('swaps different items', () => {
    const slots = createSlots(2);
    addItem(slots, 'wood', 4);
    addItem(slots, 'stone', 2);
    moveWithin(slots, 0, 1);
    expect([at(slots, 0), at(slots, 1)]).toEqual(['stone:2', 'wood:4']);
  });

  test('merges the same item up to the stack limit, the rest stays', () => {
    const slots = createSlots(2);
    const meat = slots.at(0);
    const more = slots.at(1);
    if (!meat || !more) throw new Error('slots');
    Object.assign(meat, { itemId: 'raw_meat', qty: 4 });
    Object.assign(more, { itemId: 'raw_meat', qty: MAX - 1 });
    moveWithin(slots, 0, 1);
    expect([at(slots, 0), at(slots, 1)]).toEqual(['raw_meat:3', `raw_meat:${MAX}`]);
  });

  test('ignores empty sources, the same slot and out-of-range slots', () => {
    const slots = createSlots(2);
    addItem(slots, 'wood', 1);
    expect(moveWithin(slots, 1, 0)).toBe(false);
    expect(moveWithin(slots, 0, 0)).toBe(false);
    expect(moveWithin(slots, 0, 9)).toBe(false);
    expect(at(slots, 0)).toBe('wood:1');
  });
});
