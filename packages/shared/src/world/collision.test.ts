import { describe, expect, test } from 'vitest';
import { PLAYER_RADIUS, SPAWN_POINTS } from '../constants.js';
import { collides, resolveCircle, type Box } from './collision.js';
import { BED_SPOTS, FURNITURE, HOUSE_COLLIDERS, distanceToBox } from './house.js';

const wall: Box = { minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1 };

describe('circle vs box collision', () => {
  test('detects overlap and clearance', () => {
    expect(collides({ x: 0, z: 0.3 }, 0.3, [wall])).toBe(true);
    expect(collides({ x: 0, z: 0.5 }, 0.3, [wall])).toBe(false);
  });

  test('pushes out to exactly touching', () => {
    const out = resolveCircle({ x: 0, z: 0.2 }, 0.3, [wall]);
    expect(out.x).toBeCloseTo(0);
    expect(out.z).toBeCloseTo(0.4);
  });

  test('slides along a wall instead of stopping', () => {
    // Moving diagonally into the wall keeps the sideways component.
    const out = resolveCircle({ x: 0.5, z: 0.25 }, 0.3, [wall]);
    expect(out.x).toBeCloseTo(0.5);
    expect(out.z).toBeCloseTo(0.4);
  });

  test('a centre inside the box leaves through the nearest face', () => {
    const out = resolveCircle({ x: 0.9, z: 0 }, 0.3, [wall]);
    expect(out.x).toBeCloseTo(1.3);
  });
});

describe('house layout', () => {
  test('spawn points and bed spots are walkable', () => {
    for (const s of SPAWN_POINTS) expect(collides(s, PLAYER_RADIUS, HOUSE_COLLIDERS)).toBe(false);
    for (const b of BED_SPOTS) expect(collides(b.wake, PLAYER_RADIUS, HOUSE_COLLIDERS)).toBe(false);
  });

  test('the front door is passable and walls are not', () => {
    expect(collides({ x: 0, z: 5 }, PLAYER_RADIUS, HOUSE_COLLIDERS)).toBe(false);
    expect(collides({ x: 2, z: 5 }, PLAYER_RADIUS, HOUSE_COLLIDERS)).toBe(true);
  });

  test('every interactable can be reached from a walkable spot', () => {
    for (const f of FURNITURE.filter((f) => f.kind !== 'decor')) {
      // Sample points 0.6 m outside each edge midpoint.
      const { minX, maxX, minZ, maxZ } = f.box;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const around = [
        { x: minX - 0.6, z: cz },
        { x: maxX + 0.6, z: cz },
        { x: cx, z: minZ - 0.6 },
        { x: cx, z: maxZ + 0.6 },
      ];
      const reachable = around.some(
        (p) => !collides(p, PLAYER_RADIUS, HOUSE_COLLIDERS) && distanceToBox(p, f.box) < 1.4,
      );
      expect(reachable, f.id).toBe(true);
    }
  });
});
