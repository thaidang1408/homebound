import { useMemo } from 'react';
import { BufferAttribute, Color, PlaneGeometry } from 'three';
import { ROAD, WORLD_RADIUS, ZONES, terrainHeight } from '@homebound/shared';
import { PALETTE } from './palette';

const SIZE = (WORLD_RADIUS + 12) * 2;
const SEGMENTS = 110;

function roadAmount(x: number, z: number): number {
  if (z < ROAD.fromZ - 0.5 || z > ROAD.toZ + 4) return 0;
  return Math.max(0, 1 - Math.abs(x) / (ROAD.halfWidth + 0.6));
}

/**
 * Low-poly ground: one displaced plane, flat-shaded, colored per vertex (grass shades, the road,
 * the darker grove). One draw call, built once.
 */
export function Terrain() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    if (!pos) throw new Error('plane has no positions');
    const colors = new Float32Array(pos.count * 3);
    const grass = new Color(PALETTE.grass);
    const grassDark = new Color(PALETTE.grassDark);
    const road = new Color(PALETTE.road);
    const c = new Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
      // Cheap deterministic shade variation so the low-poly facets read.
      const shade = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.cos(x * 0.6 - z * 1.1);
      c.copy(grass).lerp(grassDark, shade * 0.45);
      const g0 = ZONES.grove.center;
      if (Math.hypot(x - g0.x, z - g0.z) < ZONES.grove.radius) c.lerp(grassDark, 0.35);
      c.lerp(road, roadAmount(x, z));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  );
}
