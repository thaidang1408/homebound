import { describe, expect, test } from 'vitest';
import {
  HomeState,
  MAX_DROPS,
  PLAYER_INVENTORY_SLOTS,
  PlayerState,
  armorOf,
  equipIndex,
  handItem,
} from '@homebound/shared';
import { dropItem, pickUpDrop } from '../systems/drops.js';
import { createEquipment, equip, unequip } from './equipment.js';
import { addItem, countItem, createSlots } from './inventory.js';

function player() {
  const p = new PlayerState();
  p.inventory = createSlots(PLAYER_INVENTORY_SLOTS);
  p.equipment = createEquipment();
  return p;
}
const at = (p: PlayerState, i: number) => p.inventory.at(i)?.itemId ?? '';
const put = (p: PlayerState, i: number, itemId: string, qty: number) => {
  const s = p.inventory.at(i);
  if (s) Object.assign(s, { itemId, qty });
};
const worn = (p: PlayerState, slot: Parameters<typeof equipIndex>[0]) =>
  p.equipment.at(equipIndex(slot))?.itemId ?? '';

describe('equipment', () => {
  test('wearing armor counts; carrying it does not', () => {
    const p = player();
    addItem(p.inventory, 'leather_armor', 1);
    expect(armorOf(p.equipment)).toBe(0);
    expect(equip(p, 0)).toBe('done');
    expect(worn(p, 'body')).toBe('leather_armor');
    expect(at(p, 0)).toBe('');
    expect(armorOf(p.equipment)).toBe(0.25);
  });

  test('a new piece swaps with the old one; non-gear is refused', () => {
    const p = player();
    addItem(p.inventory, 'leather_armor', 1);
    addItem(p.inventory, 'bear_coat', 1);
    addItem(p.inventory, 'wood', 3);
    equip(p, 0);
    expect(equip(p, 1)).toBe('done');
    expect(worn(p, 'body')).toBe('bear_coat');
    expect(at(p, 1)).toBe('leather_armor');
    expect(equip(p, 2)).toBe('not-gear');
  });

  test('a bag on your back adds slots; it comes off only once they are empty', () => {
    const p = player();
    addItem(p.inventory, 'satchel', 1);
    equip(p, 0);
    expect(p.inventory.length).toBe(PLAYER_INVENTORY_SLOTS + 5);
    addItem(p.inventory, 'wood', 20 * 11); // fills the base slots and one of the new ones
    expect(at(p, 10)).toBe('wood');
    expect(unequip(p, equipIndex('back'))).toBe('bag-not-empty');
    put(p, 10, '', 0);
    expect(unequip(p, equipIndex('back'))).toBe('backpack-full'); // base slots all full
    put(p, 3, '', 0);
    expect(unequip(p, equipIndex('back'))).toBe('done');
    expect(p.inventory.length).toBe(PLAYER_INVENTORY_SLOTS);
    expect(at(p, 3)).toBe('satchel');
  });

  test('swapping a big backpack for a satchel needs the lost slots empty', () => {
    const p = player();
    addItem(p.inventory, 'big_backpack', 1);
    equip(p, 0);
    expect(p.inventory.length).toBe(PLAYER_INVENTORY_SLOTS + 10);
    addItem(p.inventory, 'satchel', 1); // lands in slot 0
    put(p, 17, 'stone', 1);
    expect(equip(p, 0)).toBe('bag-not-empty');
    put(p, 17, '', 0);
    expect(equip(p, 0)).toBe('done');
    expect(p.inventory.length).toBe(PLAYER_INVENTORY_SLOTS + 5);
    expect(at(p, 0)).toBe('big_backpack');
  });

  test('an empty hand holds the worn weapon', () => {
    const p = player();
    addItem(p.inventory, 'spear', 1);
    addItem(p.inventory, 'berries', 2);
    equip(p, 0);
    expect(handItem(p, 0)).toBe('spear');
    expect(handItem(p, 1)).toBe('berries');
  });
});

describe('drops', () => {
  test('a dropped stack lands ahead as a bag; picking it up takes what fits', () => {
    const state = new HomeState();
    const p = player();
    Object.assign(p, { x: 20, z: 20, yaw: 0 });
    addItem(p.inventory, 'wood', 12);
    expect(dropItem(state, p, 0, 'drop-0')).toBe('dropped');
    expect(countItem(p.inventory, 'wood')).toBe(0);
    const bag = state.drops.get('drop-0');
    expect(bag?.qty).toBe(12);
    expect(bag?.z).toBeLessThan(20); // yaw 0 looks toward −Z
    for (let i = 0; i < 10; i++) put(p, i, 'wood', 19);
    expect(pickUpDrop(state, 'drop-0', p)).toBe(10); // one more fits in each slot
    expect(state.drops.get('drop-0')?.qty).toBe(2);
    put(p, 0, '', 0);
    expect(pickUpDrop(state, 'drop-0', p)).toBe(2);
    expect(state.drops.has('drop-0')).toBe(false);
  });

  test('empty slots can’t be dropped, and the ground has a limit', () => {
    const state = new HomeState();
    const p = player();
    expect(dropItem(state, p, 0, 'drop-0')).toBe('empty');
    for (let i = 0; i < MAX_DROPS; i++) {
      addItem(p.inventory, 'stone', 1);
      dropItem(state, p, 0, `drop-${i}`);
    }
    addItem(p.inventory, 'stone', 1);
    expect(dropItem(state, p, 0, 'drop-x')).toBe('too-many');
  });
});
