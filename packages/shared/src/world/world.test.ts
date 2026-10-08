import { describe, expect, test } from 'vitest';
import { PLAYER_RADIUS, SPAWN_POINTS, WORLD_RADIUS } from '../constants.js';
import { createRandom } from '../random.js';
import { collides } from './collision.js';
import { findInteractable, INTERACTABLES, WORLD_COLLIDERS } from './interactables.js';
import { RESOURCE_NODES, ROAD, ZONES } from './layout.js';
import { terrainHeight } from './terrain.js';
import { advanceTime, canSleepAt, clockLabel, dayPhase, NEW_HOME_TIME, SUNRISE } from './time.js';

describe('random', () => {
  test('is deterministic per seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(createRandom(43)()).not.toBe(createRandom(42)());
  });
});

describe('world layout', () => {
  test('has every resource kind with unique ids', () => {
    const kinds = new Set(RESOURCE_NODES.map((n) => n.kind));
    expect(kinds).toEqual(new Set(['tree', 'rock', 'bush', 'mushroom']));
    expect(new Set(RESOURCE_NODES.map((n) => n.id)).size).toBe(RESOURCE_NODES.length);
  });

  test('mushrooms are an extra pass: the original layout is unchanged', () => {
    const count = (kind: string) => RESOURCE_NODES.filter((n) => n.kind === kind).length;
    expect([count('tree'), count('rock'), count('bush')]).toEqual([110, 26, 24]);
    const mushrooms = RESOURCE_NODES.filter((n) => n.kind === 'mushroom');
    expect(mushrooms).toHaveLength(14);
    for (const m of mushrooms) expect(m.z, m.id).toBeLessThan(0); // the northern woods
  });

  test('keeps the yard, the road and the clearing free', () => {
    for (const n of RESOURCE_NODES) {
      expect(Math.hypot(n.x, n.z), n.id).toBeGreaterThanOrEqual(ZONES.yard.radius);
      const onRoad = Math.abs(n.x) < ROAD.halfWidth && n.z > ROAD.fromZ && n.z < ROAD.toZ;
      expect(onRoad, n.id).toBe(false);
      const c = ZONES.clearing.center;
      expect(Math.hypot(n.x - c.x, n.z - c.z), n.id).toBeGreaterThanOrEqual(ZONES.clearing.radius);
    }
  });

  test('everything stays inside the world', () => {
    for (const n of RESOURCE_NODES) expect(Math.hypot(n.x, n.z)).toBeLessThan(WORLD_RADIUS);
  });

  test('spawns and the walk out of the front door to the clearing are clear', () => {
    for (const s of SPAWN_POINTS) expect(collides(s, PLAYER_RADIUS, WORLD_COLLIDERS)).toBe(false);
    for (let z = 6; z <= ROAD.toZ; z += 0.5) {
      expect(collides({ x: 0, z }, PLAYER_RADIUS, WORLD_COLLIDERS), `road z=${z}`).toBe(false);
    }
  });

  test('house furniture and outdoor nodes are both interactable', () => {
    expect(findInteractable('stove')?.kind).toBe('stove');
    expect(findInteractable('tree-0')?.kind).toBe('tree');
    expect(INTERACTABLES.some((i) => i.id === 'sofa')).toBe(false); // decor
  });
});

describe('terrain', () => {
  test('the yard is flat and the rim rises', () => {
    expect(terrainHeight(0, 0)).toBe(0);
    expect(terrainHeight(8, -8)).toBe(0);
    expect(terrainHeight(WORLD_RADIUS, 0)).toBeGreaterThan(3);
  });
});

describe('time of day', () => {
  test('phases and bedtime', () => {
    expect(dayPhase(0.0)).toBe('night');
    expect(dayPhase(NEW_HOME_TIME)).toBe('morning');
    expect(dayPhase(0.5)).toBe('day');
    expect(dayPhase(0.72)).toBe('evening');
    expect(canSleepAt(0.5)).toBe(false);
    expect(canSleepAt(0.72)).toBe(true);
    expect(canSleepAt(0.1)).toBe(true);
    expect(canSleepAt(SUNRISE)).toBe(false);
  });

  test('advancing past midnight wraps', () => {
    expect(advanceTime(0.99, 12 * 60 * 1000 * 0.02)).toEqual({
      time: expect.closeTo(0.01, 6),
      wrapped: true,
    });
    expect(advanceTime(0.5, 1000).wrapped).toBe(false);
  });

  test('clock label', () => {
    expect(clockLabel(0.5)).toBe('12:00');
    expect(clockLabel(0.75)).toBe('18:00');
  });
});
