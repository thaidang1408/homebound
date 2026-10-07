import {
  CREATURES,
  RESOURCE_KINDS,
  StoveStatus,
  canSleepAt,
  cookResult,
  findInteractable,
  getItem,
  isCreatureKind,
  isItemId,
  type HomeState,
  type ItemId,
  type PlayerState,
} from '@homebound/shared';

export interface Prompt {
  /** Shown as "[E] text" when actionable, plain hint text otherwise. */
  text: string;
  actionable: boolean;
}

function itemName(id: string): string {
  return isItemId(id) ? getItem(id).name.toLowerCase() : 'food';
}

/** Room for one more `id` in the backpack (a partial stack or an empty slot). */
function hasSpaceFor(me: PlayerState, id: ItemId): boolean {
  const max = getItem(id).maxStack;
  return [...me.inventory].some((s) => s.qty === 0 || (s.itemId === id && s.qty < max));
}

/** What pressing [E] on `focusId` would do right now, in player words. */
export function promptFor(focusId: string, state: HomeState, sessionId: string): Prompt | null {
  const me = state.players.get(sessionId);
  const partner = state.players.get(focusId);
  if (partner?.downed) {
    const share = Math.round(partner.revive * 100);
    return {
      text: `Hold — revive ${partner.name}${share > 0 ? ` (${share}%)` : ''}`,
      actionable: true,
    };
  }
  const creature = state.creatures.get(focusId);
  if (creature && me && isCreatureKind(creature.kind)) {
    const def = CREATURES[creature.kind];
    const fits = def.loot.every((l) => hasSpaceFor(me, l.itemId));
    return fits
      ? { text: `Butcher ${def.name.toLowerCase()}`, actionable: true }
      : { text: 'Backpack full', actionable: false };
  }
  const target = findInteractable(focusId);
  if (!target || !me) return null;

  switch (target.kind) {
    case 'stove': {
      const stove = state.stove;
      if (stove.status === StoveStatus.Done) {
        return { text: `Take ${itemName(stove.itemId)}`, actionable: true };
      }
      if (stove.status === StoveStatus.Cooking) return { text: 'Cooking…', actionable: false };
      const raw = [...me.inventory].find((s) => isItemId(s.itemId) && cookResult(s.itemId));
      return raw
        ? { text: `Cook ${itemName(raw.itemId)}`, actionable: true }
        : { text: 'Bring raw meat to cook', actionable: false };
    }
    case 'chest':
      return { text: 'Open storage', actionable: true };
    case 'bed': {
      if (me.sleeping) return { text: 'Get up', actionable: true };
      if (!canSleepAt(state.timeOfDay))
        return { text: 'Not tired yet — sleep after sunset', actionable: false };
      const partner = [...state.players.entries()].find(([id]) => id !== sessionId)?.[1];
      return partner?.sleeping
        ? { text: `Sleep — ${partner.name} is waiting`, actionable: true }
        : { text: 'Sleep', actionable: true };
    }
    case 'workbench':
      return { text: 'Craft', actionable: true };
    case 'tree':
    case 'rock':
    case 'bush': {
      const def = RESOURCE_KINDS[target.kind];
      if (!hasSpaceFor(me, def.drop)) return { text: 'Backpack full', actionable: false };
      return { text: `${def.verb} ${itemName(def.drop)}`, actionable: true };
    }
  }
}
