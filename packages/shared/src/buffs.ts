/** Food buffs (Phase 10): one at a time, the newest replaces the old. Data only. */
export interface BuffDefinition {
  name: string;
  icon: string;
  durationMs: number;
  /** Health regeneration multiplier while active. */
  regen?: number;
  /** Detection range multiplier for creatures noticing you (< 1 = harder to notice). */
  stealth?: number;
}

export const BUFFS = {
  warm: { name: 'Warm stew', icon: '🍲', durationMs: 120_000, regen: 6 },
  keen: { name: 'Light-footed', icon: '🍢', durationMs: 180_000, stealth: 0.7 },
} as const satisfies Record<string, BuffDefinition>;

export type BuffId = keyof typeof BUFFS;

export function isBuffId(value: string): value is BuffId {
  return Object.hasOwn(BUFFS, value);
}

export function getBuff(id: BuffId): BuffDefinition {
  return BUFFS[id];
}
