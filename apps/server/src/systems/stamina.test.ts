import { describe, expect, test } from 'vitest';
import {
  DODGE_COOLDOWN_MS,
  DODGE_COST,
  DODGE_IFRAMES_MS,
  PlayerState,
  STAMINA_MAX,
  STAMINA_RECOVER,
  STAMINA_REGEN_DELAY_MS,
} from '@homebound/shared';
import { act, drainSprint, isDodging, tickStamina, tryDodge } from './stamina.js';

describe('stamina', () => {
  test('sprinting drains, resting refills after a pause', () => {
    const p = new PlayerState();
    for (let t = 0; t < 2000; t += 50) drainSprint(p, 50, t);
    expect(p.stamina).toBeLessThan(STAMINA_MAX);
    const drained = p.staminaExact;
    tickStamina(p, 100, 2000 + STAMINA_REGEN_DELAY_MS / 2);
    expect(p.staminaExact).toBe(drained); // still catching breath
    tickStamina(p, 1000, 2000 + STAMINA_REGEN_DELAY_MS);
    expect(p.staminaExact).toBeGreaterThan(drained);
  });

  test('emptying out winds you until STAMINA_RECOVER', () => {
    const p = new PlayerState();
    for (let t = 0; t < 10_000; t += 50) drainSprint(p, 50, t);
    expect(p.stamina).toBe(0);
    expect(p.winded).toBe(true);
    expect(tryDodge(p, 20_000)).toBe(false);
    let now = 20_000;
    while (p.staminaExact < STAMINA_RECOVER) tickStamina(p, 100, (now += 100));
    expect(p.winded).toBe(false);
  });

  test('a dodge costs stamina, has a cooldown and a short invulnerable window', () => {
    const p = new PlayerState();
    expect(tryDodge(p, 1000)).toBe(true);
    expect(p.staminaExact).toBe(STAMINA_MAX - DODGE_COST);
    expect(isDodging(p, 1000 + DODGE_IFRAMES_MS - 1)).toBe(true);
    expect(isDodging(p, 1000 + DODGE_IFRAMES_MS)).toBe(false);
    expect(tryDodge(p, 1000 + DODGE_COOLDOWN_MS - 1)).toBe(false);
    expect(tryDodge(p, 1000 + DODGE_COOLDOWN_MS)).toBe(true);
  });

  test('actions bump a wrapping counter so repeats still animate', () => {
    const p = new PlayerState();
    p.actionSeq = 255;
    act(p, 'chop');
    expect(p.action).toBe('chop');
    expect(p.actionSeq).toBe(0);
  });
});
