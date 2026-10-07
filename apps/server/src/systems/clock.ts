import { advanceTime, type HomeState } from '@homebound/shared';

/** Advances the world clock; passing midnight starts the next day. Returns true on a new day. */
export function tickClock(state: HomeState, dtMs: number): boolean {
  const { time, wrapped } = advanceTime(state.timeOfDay, dtMs);
  state.timeOfDay = time;
  if (wrapped) state.day += 1;
  return wrapped;
}
