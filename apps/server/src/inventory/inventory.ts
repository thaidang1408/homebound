import { ArraySchema } from '@colyseus/schema';
import { ItemStack, getItem, isItemId, type ItemId } from '@homebound/shared';

/**
 * Slot-based inventories (player backpack, shared chest). Every mutation validates first and
 * then changes state in one step, so a failed action never half-applies.
 */
export type Slots = ArraySchema<ItemStack>;

export function createSlots(count: number): Slots {
  const slots = new ArraySchema<ItemStack>();
  for (let i = 0; i < count; i++) slots.push(new ItemStack());
  return slots;
}

function stackItem(stack: ItemStack): ItemId | null {
  return stack.qty > 0 && isItemId(stack.itemId) ? stack.itemId : null;
}

function clear(stack: ItemStack): void {
  stack.itemId = '';
  stack.qty = 0;
}

/** How many of `itemId` would fit into `slots` (topping up stacks, then empty slots). */
export function spaceFor(slots: Slots, itemId: ItemId): number {
  const max = getItem(itemId).maxStack;
  let space = 0;
  for (const stack of slots) {
    const id = stackItem(stack);
    if (id === null) space += max;
    else if (id === itemId) space += max - stack.qty;
  }
  return space;
}

/** Adds up to `qty`; returns how many did NOT fit. */
export function addItem(slots: Slots, itemId: ItemId, qty: number): number {
  const max = getItem(itemId).maxStack;
  let left = qty;
  // Top up existing stacks first, then fill empty slots.
  for (const stack of slots) {
    if (left === 0) break;
    if (stackItem(stack) !== itemId) continue;
    const add = Math.min(max - stack.qty, left);
    stack.qty += add;
    left -= add;
  }
  for (const stack of slots) {
    if (left === 0) break;
    if (stackItem(stack) !== null) continue;
    const add = Math.min(max, left);
    stack.itemId = itemId;
    stack.qty = add;
    left -= add;
  }
  return left;
}

export function countItem(slots: Slots, itemId: ItemId): number {
  let total = 0;
  for (const stack of slots) if (stackItem(stack) === itemId) total += stack.qty;
  return total;
}

/** Removes exactly `qty` of `itemId`, or nothing at all. */
export function removeItem(slots: Slots, itemId: ItemId, qty: number): boolean {
  if (countItem(slots, itemId) < qty) return false;
  let left = qty;
  for (const stack of slots) {
    if (left === 0) break;
    if (stackItem(stack) !== itemId) continue;
    const take = Math.min(stack.qty, left);
    stack.qty -= take;
    left -= take;
    if (stack.qty === 0) clear(stack);
  }
  return true;
}

/** Item in a slot, or null for empty/out-of-range slots. */
export function itemAt(slots: Slots, index: number): ItemId | null {
  const stack = slots.at(index);
  return stack ? stackItem(stack) : null;
}

/** Removes one item from a specific slot. Returns the item taken, or null. */
export function takeOne(slots: Slots, index: number): ItemId | null {
  const stack = slots.at(index);
  const id = stack ? stackItem(stack) : null;
  if (!stack || id === null) return null;
  stack.qty -= 1;
  if (stack.qty === 0) clear(stack);
  return id;
}

/** Moves as much of the stack at `from[index]` into `to` as fits. Returns the amount moved. */
export function moveStack(from: Slots, index: number, to: Slots): number {
  const stack = from.at(index);
  const id = stack ? stackItem(stack) : null;
  if (!stack || id === null) return 0;
  const leftover = addItem(to, id, stack.qty);
  const moved = stack.qty - leftover;
  if (leftover === 0) clear(stack);
  else stack.qty = leftover;
  return moved;
}

/**
 * Rearranges one container: the stack at `from` goes onto `to`. Empty target → moved; same item
 * → merged up to the stack limit (the rest stays put); different item → swapped.
 */
export function moveWithin(slots: Slots, from: number, to: number): boolean {
  const source = slots.at(from);
  const target = slots.at(to);
  const id = source ? stackItem(source) : null;
  if (!source || !target || from === to || id === null) return false;
  const targetId = stackItem(target);
  if (targetId === id) {
    const move = Math.min(source.qty, getItem(id).maxStack - target.qty);
    if (move === 0) return false;
    target.qty += move;
    source.qty -= move;
    if (source.qty === 0) clear(source);
    return true;
  }
  const { itemId, qty } = target;
  target.itemId = source.itemId;
  target.qty = source.qty;
  source.itemId = targetId === null ? '' : itemId;
  source.qty = targetId === null ? 0 : qty;
  return true;
}
