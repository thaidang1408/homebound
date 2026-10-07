import { createStore } from './createStore';

/** Per-viewer preferences, remembered in this browser only. */
export interface Settings {
  /** Multiplier on the base mouse sensitivity (0.3–2.5). */
  sensitivity: number;
  /** Master volume 0–1. */
  volume: number;
  muted: boolean;
}

const KEY = 'homebound.settings';
const DEFAULTS: Settings = { sensitivity: 1, volume: 0.7, muted: false };

export const SENSITIVITY_RANGE = { min: 0.3, max: 2.5 } as const;

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function load(): Settings {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return DEFAULTS;
    const r = raw as Record<string, unknown>;
    return {
      sensitivity: clamp(r.sensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max, 1),
      volume: clamp(r.volume, 0, 1, DEFAULTS.volume),
      muted: typeof r.muted === 'boolean' ? r.muted : false,
    };
  } catch {
    return DEFAULTS; // private mode / blocked storage: defaults are fine
  }
}

const store = createStore<Settings>(load());

export const getSettings = store.get;
export const useSettings = store.use;

export function updateSettings(patch: Partial<Settings>): void {
  store.update(patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(store.get()));
  } catch {
    // not saved this time; the setting still applies for this session
  }
}
