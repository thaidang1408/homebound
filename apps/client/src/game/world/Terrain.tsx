import { useMemo } from 'react';
import { BufferAttribute, Color, PlaneGeometry } from 'three';
import {
  BIOMES,
  LAKE,
  ROAD,
  TRAIL_HALF_WIDTH,
  WORLD_RADIUS,
  ZONES,
  biomeMix,
  terrainHeight,
  trailDistance,
  type BiomeId,
} from '@homebound/shared';
import { PALETTE } from './palette';

const SIZE = (WORLD_RADIUS + 12) * 2;
const SEGMENTS = 128; // ~1.75 m facets over the whole world (Phase 12)
/** The lake's water surface (the bowl's bottom is below it). */
export const WATER_LEVEL = -0.3;

function roadAmount(x: number, z: number): number {
  if (z < ROAD.fromZ - 0.5 || z > ROAD.toZ + 4) return 0;
  return Math.max(0, 1 - Math.abs(x) / (ROAD.halfWidth + 0.6));
}

const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];
const GROUND = BIOME_IDS.map((id) => [
  new Color(BIOMES[id].ground),
  new Color(BIOMES[id].groundDark),
]);

/**
 * Low-poly ground: one displaced plane, flat-shaded, colored per vertex (each biome's grass, the
 * road and trails, the grove, the lake shore). One draw call, built once.
 */
export function Terrain() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    if (!pos) throw new Error('plane has no positions');
    const colors = new Float32Array(pos.count * 3);
    const road = new Color(PALETTE.road);
    const sand = new Color(PALETTE.sand);
    const light = new Color();
    const dark = new Color();
    const c = new Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      pos.setY(i, y);
      // This point's biome colors, blended across borders.
      const mix = biomeMix(x, z);
      light.setRGB(0, 0, 0);
      dark.setRGB(0, 0, 0);
      BIOME_IDS.forEach((id, k) => {
        const [base, deep] = GROUND[k] ?? [];
        if (!base || !deep || mix[id] === 0) return;
        light.r += base.r * mix[id];
        light.g += base.g * mix[id];
        light.b += base.b * mix[id];
        dark.r += deep.r * mix[id];
        dark.g += deep.g * mix[id];
        dark.b += deep.b * mix[id];
      });
      // Cheap deterministic shade variation so the low-poly facets read.
      const shade = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.cos(x * 0.6 - z * 1.1);
      c.copy(light).lerp(dark, shade * 0.45);
      const g0 = ZONES.grove.center;
      if (Math.hypot(x - g0.x, z - g0.z) < ZONES.grove.radius) c.lerp(dark, 0.35);
      if (Math.hypot(x - LAKE.center.x, z - LAKE.center.z) < LAKE.radius + 3) {
        // Sandy shore and lake bed (clamped: a lerp outside 0–1 makes garish colors).
        c.lerp(sand, Math.min(1, Math.max(0, (WATER_LEVEL + 0.6 - y) * 1.5)));
      }
      c.lerp(road, roadAmount(x, z));
      c.lerp(road, Math.max(0, 1 - trailDistance({ x, z }) / (TRAIL_HALF_WIDTH + 0.4)) * 0.8);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors flatShading />
      </mesh>
      {/* Misty Lake: shallow water you wade through */}
      <mesh position={[LAKE.center.x, WATER_LEVEL, LAKE.center.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[LAKE.radius + 2.5, 28]} />
        <meshStandardMaterial
          color={PALETTE.water}
          transparent
          opacity={0.72}
          roughness={0.2}
          flatShading
        />
      </mesh>
    </>
  );
}
