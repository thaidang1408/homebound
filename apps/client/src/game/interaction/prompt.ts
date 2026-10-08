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

const STOVE_RECIPES = { key: 'R', text: 'Công thức' } as const;
const TRAP_NAMES: Record<string, string> = { snare: 'bẫy dây', spike: 'bẫy chông' };

function itemName(id: string): string {
  return isItemId(id) ? getItem(id).name.toLowerCase() : 'đồ ăn';
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
      text: `Giữ — cứu ${partner.name}${share > 0 ? ` (${share}%)` : ''}`,
      actionable: true,
    };
  }
  const pet = state.pets.get(focusId);
  if (pet && me) {
    if (!isPetKind(pet.kind)) {
      return { text: `Trứng sắp nở… ${Math.round(pet.hatch * 100)}%`, actionable: false };
    }
    return pet.ownerSession === sessionId
      ? { text: `Nói chuyện với ${pet.name}`, actionable: true }
      : { text: `Vuốt ve ${pet.name}`, actionable: true };
  }
  const creature = state.creatures.get(focusId);
  if (creature && me && isCreatureKind(creature.kind)) {
    const def: CreatureDefinition = CREATURES[creature.kind];
    if (def.tame) {
      // A wild pet: befriended by feeding it its favorite food from your hand.
      const { food, feeds } = PETS[def.tame];
      const mine = [...state.pets.values()].filter((p) => p.ownerSession === sessionId).length;
      if (mine >= PETS_PER_PLAYER) return { text: 'Bạn đã có hai thú cưng rồi', actionable: false };
      if (me.inventory.at(me.selectedSlot)?.itemId !== food) {
        return {
          text: `${def.name} thích ${itemName(food)} — cầm trên tay nhé`,
          actionable: false,
        };
      }
      return { text: `Cho ăn ${itemName(food)} (${creature.trust}/${feeds})`, actionable: true };
    }
    const fits = def.loot.every((l) => hasSpaceFor(me, l.itemId));
    return fits
      ? { text: `Xẻ thịt ${def.name.toLowerCase()}`, actionable: true }
      : { text: 'Ba lô đầy rồi', actionable: false };
  }
  const drop = state.drops.get(focusId);
  if (drop && me && isItemId(drop.itemId)) {
    const name = `${getItem(drop.itemId).name}${drop.qty > 1 ? ` ×${drop.qty}` : ''}`;
    return hasSpaceFor(me, drop.itemId)
      ? { text: `Nhặt ${name}`, actionable: true }
      : { text: `${name} — ba lô đầy rồi`, actionable: false };
  }
  const trap = state.traps.get(focusId);
  if (trap && me) {
    const name = TRAP_NAMES[trap.kind] ?? 'bẫy';
    return {
      text: trap.sprung ? `Nhặt ${name} đã sập` : `Nhặt ${name}`,
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
        const text = done.length > 1 ? `Lấy đồ ăn (${done.length})` : `Lấy ${itemName(first)}`;
        return { text, actionable: true, secondary: STOVE_RECIPES };
      }
      const free = pans.filter((p) => p.status === StoveStatus.Idle).length;
      if (free === 0) return { text: 'Đang nấu…', actionable: false, secondary: STOVE_RECIPES };
      const food = stoveFood(me);
      if (!food) {
        return {
          text: 'Mang thịt sống (hoặc cầm nấm) đến để nấu',
          actionable: false,
          secondary: STOVE_RECIPES,
        };
      }
      const have = [...me.inventory]
        .filter((s) => s.itemId === food)
        .reduce((n, s) => n + s.qty, 0);
      const n = Math.min(free, have);
      return {
        text: `Nấu ${itemName(food)}${n > 1 ? ` ×${n}` : ''}`,
        actionable: true,
        secondary: STOVE_RECIPES,
      };
    }
    case 'chest':
      return { text: 'Mở rương chung', actionable: true };
    case 'bed': {
      if (me.sleeping) return { text: 'Dậy', actionable: true };
      if (!canSleepAt(state.timeOfDay))
        return { text: 'Chưa buồn ngủ — ngủ sau khi mặt trời lặn', actionable: false };
      const partner = [...state.players.entries()].find(([id]) => id !== sessionId)?.[1];
      return partner?.sleeping
        ? { text: `Ngủ — ${partner.name} đang chờ`, actionable: true }
        : { text: 'Ngủ', actionable: true };
    }
    case 'workbench':
      return { text: 'Chế tạo', actionable: true };
    case 'cache':
      return state.caches.has(focusId.slice('cache-'.length))
        ? { text: 'Trống rồi — sáng mai sẽ đầy lại', actionable: false }
        : { text: 'Mở hòm báu', actionable: true };
    case 'tower':
      return { text: 'Leo lên ngắm xung quanh (vẽ bản đồ)', actionable: true };
    case 'shrine':
      return me.health < HEALTH_MAX
        ? { text: 'Nghỉ ở đền (hồi máu)', actionable: true }
        : { text: 'Ngôi đền ngân nga khe khẽ', actionable: false };
    case 'waystone':
      return { text: 'Đi tới đá dịch chuyển khác', actionable: true };
    case 'dom':
      return { text: 'Nói chuyện với Đốm', actionable: true };
    case 'lantern': {
      const landmark = focusId.slice('lantern-'.length);
      if (state.lanterns.has(landmark))
        return { text: 'Đèn lồng lớn đang sáng', actionable: false };
      const step = questStep(state.quest.chapter, state.quest.step);
      return step?.kind === 'light' && step.landmark === landmark
        ? { text: 'Thắp đèn lồng lớn', actionable: true }
        : { text: 'Đèn lồng lớn tắt lạnh — hỏi Đốm nhé', actionable: false };
    }
    case 'tree':
    case 'rock':
    case 'bush':
    case 'mushroom':
    case 'nest': {
      const def = RESOURCE_KINDS[target.kind];
      if (!hasSpaceFor(me, def.drop)) return { text: 'Ba lô đầy rồi', actionable: false };
      return { text: `${def.verb} ${itemName(def.drop)}`, actionable: true };
    }
  }
}
