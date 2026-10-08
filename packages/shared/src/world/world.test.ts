import { describe, expect, test } from 'vitest';
import { HOME_RADIUS, PLAYER_RADIUS, SPAWN_POINTS, WORLD_RADIUS } from '../constants.js';
import { biomeAt, inLake } from './biomes.js';
import { LANDMARKS, WAYSTONES } from './landmarks.js';
import { createRandom } from '../random.js';
import { collides } from './collision.js';
import { findInteractable, INTERACTABLES, WORLD_COLLIDERS } from './interactables.js';
import { RESOURCE_NODES, ROAD, TRAIL_HALF_WIDTH, ZONES, trailDistance } from './layout.js';
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
    expect(kinds).toEqual(new Set(['tree', 'rock', 'bush', 'mushroom', 'nest']));
    expect(new Set(RESOURCE_NODES.map((n) => n.id)).size).toBe(RESOURCE_NODES.length);
  });

  test('mushrooms are an extra pass: the original layout is unchanged', () => {
    const valley = RESOURCE_NODES.filter((n) => Math.hypot(n.x, n.z) < HOME_RADIUS);
    const count = (kind: string) => valley.filter((n) => n.kind === kind).length;
    expect([count('tree'), count('rock'), count('bush')]).toEqual([110, 26, 24]);
    const mushrooms = valley.filter((n) => n.kind === 'mushroom');
    expect(mushrooms).toHaveLength(14);
    for (const m of mushrooms) expect(m.z, m.id).toBeLessThan(0); // the northern woods
  });

  test('egg nests sit far out, clear of every other node', () => {
    const nests = RESOURCE_NODES.filter((n) => n.kind === 'nest');
    expect(nests).toHaveLength(4);
    for (const nest of nests) {
      expect(Math.hypot(nest.x, nest.z), nest.id).toBeGreaterThan(30);
      expect(Math.hypot(nest.x, nest.z), nest.id).toBeLessThan(WORLD_RADIUS - 4);
      const others = RESOURCE_NODES.filter((n) => n !== nest);
      const nearest = Math.min(...others.map((n) => Math.hypot(n.x - nest.x, n.z - nest.z)));
      expect(nearest, nest.id).toBeGreaterThanOrEqual(2);
    }
  });

  test('the wilds: ids continue after the valley; trails, landmarks and waystones stay clear', () => {
    const wilds = RESOURCE_NODES.filter((n) => Math.hypot(n.x, n.z) > HOME_RADIUS);
    expect(wilds.length).toBeGreaterThan(300);
    // The valley's last tree keeps its id; the first wild tree comes right after it.
    expect(RESOURCE_NODES.find((n) => n.id === 'tree-110')?.x).toBe(
      wilds.find((n) => n.kind === 'tree')?.x,
    );
    for (const n of wilds) {
      expect(trailDistance(n), n.id).toBeGreaterThan(TRAIL_HALF_WIDTH);
      expect(inLake(n), n.id).toBe(false);
      for (const l of LANDMARKS) expect(Math.hypot(l.x - n.x, l.z - n.z), n.id).toBeGreaterThan(6);
    }
    for (const w of WAYSTONES) {
      // You can stand next to every waystone (on its home side).
      const d = Math.hypot(w.at.x, w.at.z) || 1;
      const stand = { x: w.at.x - (w.at.x / d) * 1.4, z: w.at.z - (w.at.z / d) * 1.4 };
      expect(collides(stand, PLAYER_RADIUS, WORLD_COLLIDERS), w.id).toBe(false);
    }
  });

  test('biomes by direction past the ridge; the terrain is continuous', () => {
    expect(biomeAt(0, 0)).toBe('valley');
    expect(biomeAt(0, -82)).toBe('forest');
    expect(biomeAt(82, 0)).toBe('hills');
    expect(biomeAt(0, 84)).toBe('lake');
    expect(biomeAt(-80, 0)).toBe('ruins');
    // No cliffs (short of the world rim): points 0.5 m apart never differ by more than 0.8 m.
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      for (let r = 10; r < WORLD_RADIUS - 10; r += 0.5) {
        const h = terrainHeight(Math.cos(a) * r, Math.sin(a) * r);
        const h2 = terrainHeight(Math.cos(a) * (r + 0.5), Math.sin(a) * (r + 0.5));
        expect(Math.abs(h - h2)).toBeLessThan(0.8);
      }
    }
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

  test('a ridge rings the valley, with low passes north, east, south and west', () => {
    const at = (bearing: number) =>
      terrainHeight(Math.sin(bearing) * (HOME_RADIUS + 1), -Math.cos(bearing) * (HOME_RADIUS + 1));
    for (const pass of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      expect(at(pass)).toBeLessThan(at(pass + Math.PI / 4) - 2.5);
    }
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
