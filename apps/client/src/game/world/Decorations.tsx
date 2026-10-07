import { useLayoutEffect, useMemo, useRef } from 'react';
import { ConeGeometry, IcosahedronGeometry, Object3D, type InstancedMesh } from 'three';
import {
  HOUSE_HALF_DEPTH,
  HOUSE_HALF_WIDTH,
  ROAD,
  WORLD_RADIUS,
  createRandom,
  terrainHeight,
} from '@homebound/shared';
import { PALETTE } from './palette';

/** Client-only seed: decorations are cosmetic and never affect gameplay. */
const DECOR_SEED = 7;
const GRASS = 900;
const FLOWERS = 140;

function scatter(count: number, seed: number) {
  const random = createRandom(seed);
  const points: { x: number; z: number; s: number; r: number }[] = [];
  while (points.length < count) {
    const a = random() * Math.PI * 2;
    const d = 4 + Math.sqrt(random()) * (WORLD_RADIUS - 6);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const inHouse = Math.abs(x) < HOUSE_HALF_WIDTH + 0.5 && Math.abs(z) < HOUSE_HALF_DEPTH + 0.5;
    const onRoad = Math.abs(x) < ROAD.halfWidth && z > ROAD.fromZ && z < ROAD.toZ;
    if (inHouse || onRoad) continue;
    points.push({ x, z, s: 0.6 + random() * 0.8, r: random() * Math.PI });
  }
  return points;
}

function Scatter({
  count,
  seed,
  geometry,
  color,
  lift,
}: {
  count: number;
  seed: number;
  geometry: ConeGeometry | IcosahedronGeometry;
  color: string;
  lift: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const points = useMemo(() => scatter(count, seed), [count, seed]);

  useLayoutEffect(() => {
    const o = new Object3D();
    points.forEach((p, i) => {
      o.position.set(p.x, terrainHeight(p.x, p.z) + lift * p.s, p.z);
      o.rotation.set(0, p.r, 0);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      mesh.current?.setMatrixAt(i, o.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [points, lift]);

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={color} flatShading />
    </instancedMesh>
  );
}

const GRASS_GEOMETRY = new ConeGeometry(0.08, 0.35, 3);
const FLOWER_GEOMETRY = new IcosahedronGeometry(0.07, 0);

/** Grass tufts and flowers: life on the ground, three draw calls total. */
export function Decorations() {
  return (
    <>
      <Scatter
        count={GRASS}
        seed={DECOR_SEED}
        geometry={GRASS_GEOMETRY}
        color={PALETTE.leavesLight}
        lift={0.17}
      />
      <Scatter
        count={FLOWERS}
        seed={DECOR_SEED + 1}
        geometry={FLOWER_GEOMETRY}
        color={PALETTE.flower}
        lift={0.12}
      />
      <Scatter
        count={FLOWERS}
        seed={DECOR_SEED + 2}
        geometry={FLOWER_GEOMETRY}
        color={PALETTE.flowerPink}
        lift={0.12}
      />
    </>
  );
}
