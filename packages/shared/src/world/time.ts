/**
 * Time of day as a fraction of a full day: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
 * The server owns it; clients only render it.
 */
export const DAY_LENGTH_MS = 12 * 60 * 1000;

export const SUNRISE = 0.25;
export const SUNSET = 0.75;
/** You can go to bed from early evening until dawn. */
export const BEDTIME_START = 0.7;
/** A new home starts mid-morning; sleeping wakes you at dawn. */
export const NEW_HOME_TIME = 0.3;
export const WAKE_UP_TIME = 0.26;

export type DayPhase = 'night' | 'morning' | 'day' | 'evening';

export function dayPhase(t: number): DayPhase {
  if (t < SUNRISE - 0.03 || t >= SUNSET + 0.05) return 'night';
  if (t < SUNRISE + 0.1) return 'morning';
  if (t < BEDTIME_START) return 'day';
  return 'evening';
}

export function canSleepAt(t: number): boolean {
  return t >= BEDTIME_START || t < SUNRISE;
}

/** Advances time; `wrapped` is true when midnight passed (the day counter goes up). */
export function advanceTime(t: number, dtMs: number): { time: number; wrapped: boolean } {
  const next = t + dtMs / DAY_LENGTH_MS;
  return next >= 1 ? { time: next - 1, wrapped: true } : { time: next, wrapped: false };
}

/** "18:30"-style clock for the HUD. */
export function clockLabel(t: number): string {
  const minutes = Math.floor(t * 24 * 60) % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m - (m % 10)).padStart(2, '0')}`;
}
