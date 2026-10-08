import type { DaySummaryPayload } from '@homebound/shared';
import { createStore } from './createStore';

export type Panel =
  | 'none'
  | 'inventory'
  | 'storage'
  | 'workbench'
  | 'stove'
  | 'chat'
  | 'pet'
  | 'map'
  | 'travel'
  | 'dom'
  | 'journal';

export interface Toast {
  id: number;
  text: string;
  /** Identical toasts in a row stack into one line ("… ×3"). */
  count: number;
}

interface UiState {
  /** Selected hotbar slot (0-based). Local only: the server is told the slot when an item is used. */
  selectedSlot: number;
  panel: Panel;
  /** What [E] would use: furniture/resource id, carcass creature id, or a downed partner's sessionId. */
  focusId: string | null;
  /** Live creature under the crosshair and within reach of the held melee weapon. */
  preyId: string | null;
  /** Bumped whenever the local player takes damage (drives the red flash). */
  hurtCount: number;
  /** Bumped when the server confirms one of my attacks landed (hitmarker). */
  hitCount: number;
  lastHitKilled: boolean;
  /** The morning card about the day that just ended (null = hidden). */
  summary: DaySummaryPayload | null;
  /** Sneaking (C), shown in the HUD. */
  crouching: boolean;
  /** The pet whose panel is open. */
  petId: string | null;
  /** The waystone whose travel panel is open. */
  waystoneId: string | null;
  /** Where the story was when you started talking to Đốm (so its whole reply shows). */
  domFrom: { chapter: number; step: number } | null;
  toasts: Toast[];
}

const store = createStore<UiState>({
  selectedSlot: 0,
  panel: 'none',
  focusId: null,
  preyId: null,
  hurtCount: 0,
  hitCount: 0,
  lastHitKilled: false,
  summary: null,
  crouching: false,
  petId: null,
  waystoneId: null,
  domFrom: null,
  toasts: [],
});

export const getUi = store.get;
export const updateUi = store.update;
export const useUi = store.use;

const TOAST_MS = 2600;
let nextToastId = 1;

/** Short feedback message ("+35 hunger", "Day 2 — Good morning!"). */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function expire(id: number, ms = TOAST_MS): void {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      updateUi({ toasts: getUi().toasts.filter((t) => t.id !== id) });
    }, ms),
  );
}

/** `ms`: how long it stays (longer for story lines worth reading). */
export function showToast(text: string, ms = TOAST_MS): void {
  const { toasts } = getUi();
  const last = toasts.at(-1);
  if (last?.text === text) {
    // Same message again (holding E on a tree): count it up and keep it on screen.
    updateUi({ toasts: [...toasts.slice(0, -1), { ...last, count: last.count + 1 }] });
    expire(last.id, ms);
    return;
  }
  const toast = { id: nextToastId++, text, count: 1 };
  updateUi({ toasts: [...toasts, toast].slice(-3) });
  expire(toast.id, ms);
}
