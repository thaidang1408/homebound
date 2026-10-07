import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, type InstancedMesh } from 'three';
import { PALETTE } from '../world/palette';

/**
 * One pooled instanced mesh for every little burst in the world: wood chips, stone grit, leaves,
 * hit puffs and dust. Game code calls `emitBurst()`; this component simulates the pieces.
 */

export type BurstKind = 'wood' | 'stone' | 'leaves' | 'hit' | 'dust';

interface Recipe {
  colors: readonly string[];
  count: number;
  speed: number;
  /** Upward kick (m/s). */
  lift: number;
  size: number;
  life: number; // s
  gravity: number;
}

const RECIPES: Record<BurstKind, Recipe> = {
  wood: {
    colors: [PALETTE.trunk, PALETTE.wood],
    count: 8,
    speed: 2.2,
    lift: 2.5,
    size: 0.07,
    life: 0.7,
    gravity: 9,
  },
  stone: {
    colors: [PALETTE.rock, PALETTE.ironLight],
    count: 8,
    speed: 2.6,
    lift: 2.2,
    size: 0.06,
    life: 0.6,
    gravity: 11,
  },
  leaves: {
    colors: [PALETTE.leaves, PALETTE.bush, PALETTE.berry],
    count: 7,
    speed: 1.4,
    lift: 1.6,
    size: 0.08,
    life: 0.9,
    gravity: 3,
  },
  hit: {
    colors: [PALETTE.fletching, PALETTE.focus],
    count: 9,
    speed: 3,
    lift: 1.5,
    size: 0.06,
    life: 0.35,
    gravity: 4,
  },
  dust: {
    colors: [PALETTE.road, PALETTE.ceiling],
    count: 12,
    speed: 1.6,
    lift: 0.8,
    size: 0.12,
    life: 0.9,
    gravity: 0.5,
  },
};

const POOL = 192;

interface Piece {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  gravity: number;
  spin: number;
}

const pieces: Piece[] = Array.from({ length: POOL }, () => ({
  alive: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  life: 1,
  size: 0,
  gravity: 0,
  spin: 0,
}));
/** Colors assigned since the last frame (index → color), applied by the component. */
const recolor = new Map<number, string>();
let cursor = 0;

/** Spawns a burst at a world position. Cheap: reuses the oldest pieces when the pool is full. */
export function emitBurst(kind: BurstKind, x: number, y: number, z: number): void {
  const r = RECIPES[kind];
  for (let i = 0; i < r.count; i++) {
    const p = pieces[cursor];
    if (!p) break;
    const angle = Math.random() * Math.PI * 2;
    const speed = r.speed * (0.4 + Math.random() * 0.6);
    Object.assign(p, {
      alive: true,
      x,
      y,
      z,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed,
      vy: r.lift * (0.5 + Math.random() * 0.5),
      age: 0,
      life: r.life * (0.7 + Math.random() * 0.5),
      size: r.size * (0.7 + Math.random() * 0.6),
      gravity: r.gravity,
      spin: (Math.random() - 0.5) * 12,
    });
    recolor.set(cursor, r.colors[i % r.colors.length] ?? PALETTE.focus);
    cursor = (cursor + 1) % POOL;
  }
}

const dummy = new Object3D();
const color = new Color();

export function Particles() {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < POOL; i++) {
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, color.set(PALETTE.focus));
    }
  }, []);

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    if (recolor.size > 0) {
      for (const [i, c] of recolor) m.setColorAt(i, color.set(c));
      recolor.clear();
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    let any = false;
    pieces.forEach((p, i) => {
      if (!p.alive) return;
      any = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        dummy.scale.setScalar(0);
      } else {
        p.vy -= p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.age * p.spin, p.age * p.spin * 0.7, 0);
        dummy.scale.setScalar(p.size * (1 - p.age / p.life));
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    if (any) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial flatShading />
    </instancedMesh>
  );
}
