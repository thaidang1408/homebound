import {
  StoveStatus,
  cookResult,
  findFurniture,
  getItem,
  isItemId,
  type HomeState,
} from '@homebound/shared';

export interface Prompt {
  /** Shown as "[E] text" when actionable, plain hint text otherwise. */
  text: string;
  actionable: boolean;
}

function itemName(id: string): string {
  return isItemId(id) ? getItem(id).name.toLowerCase() : 'food';
}

/** What pressing [E] on `focusId` would do right now, in player words. */
export function promptFor(focusId: string, state: HomeState, sessionId: string): Prompt | null {
  const furniture = findFurniture(focusId);
  const me = state.players.get(sessionId);
  if (!furniture || !me) return null;

  switch (furniture.kind) {
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
      const partner = [...state.players.entries()].find(([id]) => id !== sessionId)?.[1];
      return partner?.sleeping
        ? { text: `Sleep — ${partner.name} is waiting`, actionable: true }
        : { text: 'Sleep', actionable: true };
    }
    case 'workbench':
      return { text: 'Use workbench', actionable: true };
    case 'decor':
      return null;
  }
}
