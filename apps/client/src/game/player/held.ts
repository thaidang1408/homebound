import type { Room } from '@colyseus/sdk';
import {
  getWeapon,
  weaponOf,
  type HomeState,
  type WeaponDefinition,
  type WeaponId,
} from '@homebound/shared';
import { getUi } from '../../state/ui';

/** Item id in the selected hotbar slot ('' when empty). */
export function heldItemId(room: Room<HomeState>): string {
  return room.state.players.get(room.sessionId)?.inventory.at(getUi().selectedSlot)?.itemId ?? '';
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
