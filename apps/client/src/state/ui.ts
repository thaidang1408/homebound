import { createStore } from './createStore';

export type Panel = 'none' | 'inventory' | 'storage';

export interface Toast {
  id: number;
  text: string;
}

interface UiState {
  /** Selected hotbar slot (0-based). Local only: the server is told the slot when an item is used. */
  selectedSlot: number;
  panel: Panel;
  /** Furniture id the player is looking at and close enough to use. */
  focusId: string | null;
  /** Live creature under the crosshair and within striking reach (left click attacks). */
  preyId: string | null;
  /** Bumped whenever the local player takes damage (drives the red flash). */
  hurtCount: number;
  toasts: Toast[];
}

const store = createStore<UiState>({
  selectedSlot: 0,
  panel: 'none',
  focusId: null,
  preyId: null,
  hurtCount: 0,
  toasts: [],
});

export const getUi = store.get;
export const updateUi = store.update;
export const useUi = store.use;

const TOAST_MS = 2600;
let nextToastId = 1;

/** Short feedback message ("+35 hunger", "Day 2 — Good morning!"). */
export function showToast(text: string): void {
  const toast = { id: nextToastId++, text };
  updateUi({ toasts: [...getUi().toasts, toast].slice(-3) });
  setTimeout(() => updateUi({ toasts: getUi().toasts.filter((t) => t.id !== toast.id) }), TOAST_MS);
}
