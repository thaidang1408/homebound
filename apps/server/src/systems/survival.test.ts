import { describe, expect, test } from 'vitest';
import {
  BLEED_OUT_MS,
  CREATURES,
  CREATURE_HIT_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PROJECTILE_GRAVITY,
  HEALTH_MAX,
  HEALTH_REGEN_PER_SECOND,
  HomeState,
  PlayerState,
  RESPAWN_HEALTH,
  RESPAWN_MIN_HUNGER,
  REVIVE_HEALTH,
  REVIVE_MS,
  SIMULATION_TICK_MS,
  SPAWN_POINTS,
  STARVING_DAMAGE_PER_SECOND,
  WEAPONS,
  ZONES,
  createRandom,
  terrainHeight,
  weaponOf,
  type CreatureState,
} from '@homebound/shared';
import { addItem, countItem, createSlots } from '../inventory/inventory.js';
import { craft } from './crafting.js';
import { initCreatures } from './creatures.js';
import { knockDown, pingRevive, respawn, tickDowned, type DownedEvent } from './downed.js';
import { hurtPlayer, tickNeeds } from './needs.js';
import { shoot, tickProjectiles, type ProjectileHit } from './projectiles.js';

function twoPlayers() {
  const state = new HomeState();
  const [a, b] = [1, 2].map((slot) => {
    const p = new PlayerState();
    p.slot = slot;
    p.inventory = createSlots(10);
    state.players.set(`p${slot}`, p);
    return p;
  }) as [PlayerState, PlayerState];
  return { state, a, b };
}

describe('health and hunger', () => {
  test('fed players heal; starving players lose health and finally fall', () => {
    const { state, a } = twoPlayers();
    hurtPlayer(a, 30);
    tickNeeds(state, 10);
    expect(a.healthExact).toBeCloseTo(HEALTH_MAX - 30 + HEALTH_REGEN_PER_SECOND * 10);

    a.hungerExact = 0;
    const before = a.healthExact;
    tickNeeds(state, 10);
    expect(a.healthExact).toBeCloseTo(before - STARVING_DAMAGE_PER_SECOND * 10);
    expect(tickNeeds(state, 1e4)).toEqual(['p1']);
    expect(a.health).toBe(0);
  });

  test('the last blow reports a fall once', () => {
    const p = new PlayerState();
    expect(hurtPlayer(p, HEALTH_MAX - 1)).toBe(false);
    expect(hurtPlayer(p, 5)).toBe(true);
    expect(p.health).toBe(0);
    expect(hurtPlayer(p, 5)).toBe(false);
  });
});

describe('downed and revive', () => {
  function downedPair() {
    const { state, a, b } = twoPlayers();
    hurtPlayer(a, HEALTH_MAX);
    expect(knockDown(state, 'p1')).toBe('downed');
    a.x = 20;
    b.x = 21;
    return { state, a, b };
  }
  const run = (state: HomeState, ms: number, ping?: () => void): DownedEvent[] => {
    const events: DownedEvent[] = [];
    for (let t = 0; t < ms; t += SIMULATION_TICK_MS) {
      ping?.();
      events.push(...tickDowned(state, SIMULATION_TICK_MS, t));
    }
    return events;
  };

  test('alone there is nobody to help: straight to death', () => {
    const state = new HomeState();
    state.players.set('solo', new PlayerState());
    expect(knockDown(state, 'solo')).toBe('dead');
  });

  test('a partner holding E long enough gets you up', () => {
    const { state, a } = downedPair();
    let now = 0;
    const events = run(state, REVIVE_MS + 200, () => {
      pingRevive(state, 'p2', 'p1', now);
      now += SIMULATION_TICK_MS;
    });
    expect(events).toEqual([{ type: 'revived', sessionId: 'p1', reviverId: 'p2' }]);
    expect(a.downed).toBe(false);
    expect(a.health).toBe(REVIVE_HEALTH);
  });

  test('reviving needs to be next to them', () => {
    const { state, b } = downedPair();
    b.x = 30;
    expect(pingRevive(state, 'p2', 'p1', 0)).toBe(false);
  });

  test('left alone you bleed out and die', () => {
    const { state, a } = downedPair();
    const events = run(state, BLEED_OUT_MS + SIMULATION_TICK_MS);
    expect(events.at(-1)).toEqual({ type: 'died', sessionId: 'p1' });
    expect(a.bleedOut).toBe(0);
  });

  test('if the partner goes down too, nobody can help', () => {
    const { state, b } = downedPair();
    b.downed = true;
    expect(run(state, SIMULATION_TICK_MS)).toContainEqual({ type: 'died', sessionId: 'p1' });
  });

  test('death wakes you at home with some health and food, items kept', () => {
    const { a } = downedPair();
    addItem(a.inventory, 'spear', 1);
    a.hungerExact = 0;
    respawn(a);
    expect(a).toMatchObject({ downed: false, health: RESPAWN_HEALTH, x: SPAWN_POINTS[0]?.x });
    expect(a.hungerExact).toBe(RESPAWN_MIN_HUNGER);
    expect(countItem(a.inventory, 'spear')).toBe(1);
  });
});

describe('weapons', () => {
  test('hotbar items map to weapons; anything else is fists', () => {
    expect(weaponOf('spear')).toBe('spear');
    expect(weaponOf('bow')).toBe('bow');
    expect(weaponOf('raw_meat')).toBe('fists');
    expect(weaponOf('')).toBe('fists');
  });

  test('an arrow flies, drops and hits a boar in its path', () => {
    const state = new HomeState();
    initCreatures(state, createRandom(1));
    const boar = state.creatures.get('boar-0') as CreatureState;
    const shooter = new PlayerState();
    const { x, z } = ZONES.meadow.center;
    Object.assign(shooter, { x: x - 10, z });
    Object.assign(boar, { x, z, mode: 'idle' });
    for (const [id, c] of state.creatures) if (id !== 'boar-0') Object.assign(c, { x: 44, z: -14 });

    // Aim east (yaw −π/2) at the middle of its body, allowing for the arrow's drop over 10 m.
    const eye = terrainHeight(shooter.x, shooter.z) + PLAYER_EYE_HEIGHT;
    const flight = 10 / WEAPONS.bow.speed;
    const drop = 0.5 * PROJECTILE_GRAVITY * flight ** 2;
    const aimY = terrainHeight(x, z) + CREATURE_HIT_HEIGHT / 2 + drop;
    shoot(state, 'p1', shooter, WEAPONS.bow, -Math.PI / 2, Math.atan2(aimY - eye, 10));
    const hits: ProjectileHit[] = [];
    for (let t = 0; t < 1000; t += SIMULATION_TICK_MS) {
      hits.push(...tickProjectiles(state, SIMULATION_TICK_MS));
    }
    expect(hits).toEqual([{ owner: 'p1', creatureId: 'boar-0', outcome: 'hit' }]);
    expect(boar.health).toBe(CREATURES.boar.maxHealth - WEAPONS.bow.damage);
    expect(boar.target).toBe('p1');
    expect(state.projectiles.size).toBe(0);
  });

  test('an arrow shot at the ground stops there', () => {
    const state = new HomeState();
    const shooter = new PlayerState();
    Object.assign(shooter, { x: 30, z: -2 });
    shoot(state, 'p1', shooter, WEAPONS.bow, 0, -1.2);
    expect(tickProjectiles(state, SIMULATION_TICK_MS)).toEqual([]);
    expect(state.projectiles.size).toBe(0);
  });
});

describe('crafting', () => {
  test('consumes the inputs and gives the output, all or nothing', () => {
    const inv = createSlots(5);
    expect(craft(inv, 'spear')).toBe('missing-materials');
    addItem(inv, 'wood', 4);
    addItem(inv, 'stone', 2);
    expect(craft(inv, 'spear')).toBe('crafted');
    expect(countItem(inv, 'spear')).toBe(1);
    expect(countItem(inv, 'wood')).toBe(1);
    expect(countItem(inv, 'stone')).toBe(0);
    expect(craft(inv, 'bow')).toBe('missing-materials');
    expect(countItem(inv, 'wood')).toBe(1);
  });

  test('arrows come in bundles', () => {
    const inv = createSlots(5);
    addItem(inv, 'wood', 1);
    addItem(inv, 'stone', 1);
    expect(craft(inv, 'arrows')).toBe('crafted');
    expect(countItem(inv, 'arrow')).toBe(5);
  });
});
