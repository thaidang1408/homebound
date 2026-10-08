import {
  CREATURES,
  HEALTH_MAX,
  questStep,
  PETS,
  PETS_PER_PLAYER,
  RESOURCE_KINDS,
  StoveStatus,
  canSleepAt,
  stoveFood,
  findInteractable,
  getItem,
  isCreatureKind,
  isItemId,
  isPetKind,
  type CreatureDefinition,
  type HomeState,
  type ItemId,
  type PlayerState,
} from '@homebound/shared';

export interface Prompt {
  /** Shown as "[E] text" when actionable, plain hint text otherwise. */
  text: string;
  actionable: boolean;
  /** A second key that works here too ("[R] Recipes" at the stove). */
  secondary?: { key: string; text: string };
}

const STOVE_RECIPES = { key: 'R', text: 'Recipes' } as const;
const TRAP_NAMES: Record<string, string> = { snare: 'snare', spike: 'spike trap' };

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
  const pet = state.pets.get(focusId);
  if (pet && me) {
    if (!isPetKind(pet.kind)) {
      return { text: `Egg hatching… ${Math.round(pet.hatch * 100)}%`, actionable: false };
    }
    return pet.ownerSession === sessionId
      ? { text: `Talk to ${pet.name}`, actionable: true }
      : { text: `Pat ${pet.name}`, actionable: true };
  }
  const creature = state.creatures.get(focusId);
  if (creature && me && isCreatureKind(creature.kind)) {
    const def: CreatureDefinition = CREATURES[creature.kind];
    if (def.tame) {
      // A wild pet: befriended by feeding it its favorite food from your hand.
      const { food, feeds } = PETS[def.tame];
      const mine = [...state.pets.values()].filter((p) => p.ownerSession === sessionId).length;
      if (mine >= PETS_PER_PLAYER) return { text: 'You already have two pets', actionable: false };
      if (me.inventory.at(me.selectedSlot)?.itemId !== food) {
        return { text: `${def.name} loves ${itemName(food)} — hold some`, actionable: false };
      }
      return { text: `Feed ${itemName(food)} (${creature.trust}/${feeds})`, actionable: true };
    }
    const fits = def.loot.every((l) => hasSpaceFor(me, l.itemId));
    return fits
      ? { text: `Butcher ${def.name.toLowerCase()}`, actionable: true }
      : { text: 'Backpack full', actionable: false };
  }
  const drop = state.drops.get(focusId);
  if (drop && me && isItemId(drop.itemId)) {
    const name = `${getItem(drop.itemId).name}${drop.qty > 1 ? ` ×${drop.qty}` : ''}`;
    return hasSpaceFor(me, drop.itemId)
      ? { text: `Pick up ${name}`, actionable: true }
      : { text: `${name} — backpack full`, actionable: false };
  }
  const trap = state.traps.get(focusId);
  if (trap && me) {
    const name = TRAP_NAMES[trap.kind] ?? 'trap';
    return {
      text: trap.sprung ? `Pick up the sprung ${name}` : `Pick up ${name}`,
      actionable: true,
    };
  }
  const target = findInteractable(focusId);
  if (!target || !me) return null;

  switch (target.kind) {
    case 'stove': {
      const pans = [...state.pans];
      const done = pans.filter((p) => p.status === StoveStatus.Done);
      if (done.length > 0) {
        const first = done[0]?.itemId ?? '';
        const text = done.length > 1 ? `Take the food (${done.length})` : `Take ${itemName(first)}`;
        return { text, actionable: true, secondary: STOVE_RECIPES };
      }
      const free = pans.filter((p) => p.status === StoveStatus.Idle).length;
      if (free === 0) return { text: 'Cooking…', actionable: false, secondary: STOVE_RECIPES };
      const food = stoveFood(me);
      if (!food) {
        return {
          text: 'Bring raw meat (or hold a mushroom) to cook',
          actionable: false,
          secondary: STOVE_RECIPES,
        };
      }
      const have = [...me.inventory]
        .filter((s) => s.itemId === food)
        .reduce((n, s) => n + s.qty, 0);
      const n = Math.min(free, have);
      return {
        text: `Cook ${itemName(food)}${n > 1 ? ` ×${n}` : ''}`,
        actionable: true,
        secondary: STOVE_RECIPES,
      };
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
    case 'cache':
      return state.caches.has(focusId.slice('cache-'.length))
        ? { text: 'Empty — it fills up again every morning', actionable: false }
        : { text: 'Open the cache', actionable: true };
    case 'tower':
      return { text: 'Climb up and look around (maps the land)', actionable: true };
    case 'shrine':
      return me.health < HEALTH_MAX
        ? { text: 'Rest at the shrine (heals you)', actionable: true }
        : { text: 'The shrine hums softly', actionable: false };
    case 'waystone':
      return { text: 'Travel to another waystone', actionable: true };
    case 'dom':
      return { text: 'Talk to Đốm', actionable: true };
    case 'lantern': {
      const landmark = focusId.slice('lantern-'.length);
      if (state.lanterns.has(landmark))
        return { text: 'The great lantern glows', actionable: false };
      const step = questStep(state.quest.chapter, state.quest.step);
      return step?.kind === 'light' && step.landmark === landmark
        ? { text: 'Light the great lantern', actionable: true }
        : { text: 'A great lantern, cold and dark — ask Đốm', actionable: false };
    }
    case 'tree':
    case 'rock':
    case 'bush':
    case 'mushroom':
    case 'nest': {
      const def = RESOURCE_KINDS[target.kind];
      if (!hasSpaceFor(me, def.drop)) return { text: 'Backpack full', actionable: false };
      return { text: `${def.verb} ${itemName(def.drop)}`, actionable: true };
    }
  }
}
