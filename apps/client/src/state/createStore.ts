import { useSyncExternalStore } from 'react';

/** Minimal external store for low-frequency UI state (never per-frame data). */
export function createStore<T extends object>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();

  const get = () => value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    get,
    update(patch: Partial<T>) {
      value = { ...value, ...patch };
      for (const listener of listeners) listener();
    },
    use: () => useSyncExternalStore(subscribe, get),
  };
}
