import type { Room } from '@colyseus/sdk';
import {
  getWeapon,
  handItem,
  weaponOf,
  type HomeState,
  type WeaponDefinition,
  type WeaponId,
} from '@homebound/shared';
import { getUi } from '../../state/ui';

/** Item id in your hand: the selected hotbar slot, or the worn weapon when it's empty. */
export function heldItemId(room: Room<HomeState>): string {
  const me = room.state.players.get(room.sessionId);
  return me ? handItem(me, getUi().selectedSlot) : '';
}

/** The weapon the local player holds (fists for empty hands or non-weapons). Allocation-free. */
export function heldWeaponId(room: Room<HomeState>): WeaponId {
  return weaponOf(heldItemId(room));
}

export interface Held {
  slot: number;
  itemId: string;
  weapon: WeaponDefinition;
}

/** Everything about the held item, for one-off actions (clicks). */
export function heldItem(room: Room<HomeState>): Held {
  const itemId = heldItemId(room);
  return { slot: getUi().selectedSlot, itemId, weapon: getWeapon(weaponOf(itemId)) };
}
