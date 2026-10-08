import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  ConeGeometry,
  CylinderGeometry,
  TorusGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Color,
  Object3D,
  type BufferGeometry,
  type InstancedMesh,
} from 'three';
import {
  BIOMES,
  RESOURCE_NODES,
  biomeAt,
  terrainHeight,
  type ResourceKind,
  type ResourceNodeDefinition,
} from '@homebound/shared';
import { useSession } from '../../state/session';
import { playHarvestAt } from '../../audio/sounds';
import { emitBurst, type BurstKind } from '../fx/Particles';
import { PALETTE } from './palette';

/** One instanced part of a resource (a tree = trunk + two canopy cones). */
interface Part {
  geometry: BufferGeometry;
  color: string;
  /** Self-lit this much (the egg in a nest glows so you can spot it). */
  glow?: number;
  /** Which biome tint applies: leaves (trees, bushes) or rock. None: always its own color. */
  tint?: 'leafTint' | 'rockTint';
  /** Instances of this part per node (berries: several per bush). */
  perNode: number;
  /** Place instance `i` of this part for a node; `depleted` swaps to the harvested look. */
  place(o: Object3D, node: ResourceNodeDefinition, i: number, depleted: boolean): void;
}

const HIDDEN = 0.0001;
const BURST: Record<ResourceKind, BurstKind> = {
  tree: 'wood',
  rock: 'stone',
  bush: 'leaves',
  mushroom: 'leaves',
  nest: 'leaves',
};
/** Mushrooms grow in little clusters of three. */
const CLUSTER = [
  { dx: 0, dz: 0, s: 1 },
  { dx: 0.2, dz: 0.1, s: 0.7 },
  { dx: -0.12, dz: 0.18, s: 0.55 },
];
const WOBBLE_MS = 350;
const CHECK_INTERVAL = 0.15; // s between depletion checks

function base(o: Object3D, n: ResourceNodeDefinition, y: number) {
  o.position.set(n.x, terrainHeight(n.x, n.z) + y * n.scale, n.z);
  o.rotation.set(0, n.rotation, 0);
  o.scale.setScalar(n.scale);
}

const PARTS: Record<ResourceKind, Part[]> = {
  nest: [
    {
      geometry: new TorusGeometry(0.32, 0.1, 5, 10),
      color: PALETTE.nest,
      perNode: 1,
      place(o, n) {
        base(o, n, 0.08);
        o.rotation.x = -Math.PI / 2;
      },
    },
    {
      geometry: new IcosahedronGeometry(0.17, 1),
      color: PALETTE.eggSpot,
      glow: 0.8,
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, 0.24);
        o.scale.y *= 1.3;
        if (depleted) o.scale.setScalar(HIDDEN); // taken: a new one is laid later
      },
    },
  ],
  tree: [
    {
      // Tall trunk so the canopy starts above eye height: you never stand inside the leaves.
      geometry: new CylinderGeometry(0.17, 0.24, 2.2, 6),
      color: PALETTE.trunk,
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, depleted ? 0.16 : 1.1);
        if (depleted) o.scale.y *= 0.15; // stump
      },
    },
    {
      geometry: new ConeGeometry(1.15, 1.9, 7),
      color: PALETTE.leaves,
      tint: 'leafTint',
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, 3.0);
        if (depleted) o.scale.setScalar(HIDDEN);
      },
    },
    {
      geometry: new ConeGeometry(0.8, 1.5, 7),
      color: PALETTE.leavesLight,
      tint: 'leafTint',
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, 3.9);
        if (depleted) o.scale.setScalar(HIDDEN);
      },
    },
  ],
  rock: [
    {
      geometry: new DodecahedronGeometry(0.65, 0),
      color: PALETTE.rock,
      tint: 'rockTint',
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, 0.3);
        o.scale.y *= 0.7;
        if (depleted) o.scale.multiplyScalar(0.35); // rubble
      },
    },
  ],
  bush: [
    {
      geometry: new IcosahedronGeometry(0.6, 0),
      color: PALETTE.bush,
      tint: 'leafTint',
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, 0.45);
        o.scale.y *= 0.8;
        if (depleted) o.scale.multiplyScalar(0.8);
      },
    },
    {
      geometry: new IcosahedronGeometry(0.09, 0),
      color: PALETTE.berry,
      perNode: 5,
      place(o, n, i, depleted) {
        const a = n.rotation + (i / 5) * Math.PI * 2;
        o.position.set(
          n.x + Math.cos(a) * 0.45 * n.scale,
          terrainHeight(n.x, n.z) + (0.45 + (i % 2) * 0.2) * n.scale,
          n.z + Math.sin(a) * 0.45 * n.scale,
        );
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(depleted ? HIDDEN : 1);
      },
    },
  ],
  mushroom: [
    {
      geometry: new CylinderGeometry(0.035, 0.045, 0.18, 5),
      color: PALETTE.mushroomStem,
      perNode: CLUSTER.length,
      place(o, n, i, depleted) {
        const c = CLUSTER[i] ?? { dx: 0, dz: 0, s: 1 };
        o.position.set(n.x + c.dx, terrainHeight(n.x, n.z) + 0.09 * c.s, n.z + c.dz);
        o.rotation.set(0, n.rotation, 0);
        o.scale.setScalar(depleted ? HIDDEN : c.s * n.scale);
      },
    },
    {
      geometry: new ConeGeometry(0.13, 0.1, 6),
      color: PALETTE.mushroomCap,
      perNode: CLUSTER.length,
      place(o, n, i, depleted) {
        const c = CLUSTER[i] ?? { dx: 0, dz: 0, s: 1 };
        o.position.set(n.x + c.dx, terrainHeight(n.x, n.z) + 0.2 * c.s, n.z + c.dz);
        o.rotation.set(0, n.rotation, 0);
        o.scale.setScalar(depleted ? HIDDEN : c.s * n.scale);
      },
    },
  ],
};

function KindInstances({ kind }: { kind: ResourceKind }) {
  const { room } = useSession();
  const nodes = useMemo(() => RESOURCE_NODES.filter((n) => n.kind === kind), [kind]);
  const parts = PARTS[kind];
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  // Per node: last seen charges, and when its wobble started (−1 = still).
  const charges = useRef<number[]>(nodes.map(() => -1));
  const wobbleStart = useRef<number[]>(nodes.map(() => -1));
  const sinceCheck = useRef(0);

  const placeNode = (index: number, depleted: boolean, wobble = 0) => {
    const node = nodes[index];
    if (!node) return;
    parts.forEach((part, p) => {
      const mesh = meshes.current[p];
      if (!mesh) return;
      for (let i = 0; i < part.perNode; i++) {
        part.place(dummy, node, i, depleted);
        dummy.rotation.z += wobble;
        dummy.updateMatrix();
        mesh.setMatrixAt(index * part.perNode + i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  };

  useLayoutEffect(() => {
    nodes.forEach((_, i) => placeNode(i, false));
    // Each biome tints its trees and rocks (one draw call per part still: instance colors).
    const color = new Color();
    parts.forEach((part, p) => {
      const mesh = meshes.current[p];
      if (!mesh) return;
      nodes.forEach((node, index) => {
        color.set(part.color);
        if (part.tint) color.multiply(new Color(BIOMES[biomeAt(node.x, node.z)][part.tint]));
        for (let i = 0; i < part.perNode; i++) mesh.setColorAt(index * part.perNode + i, color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    // placeNode only reads refs and static data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  useFrame((_, dt) => {
    const now = performance.now();
    // Wobble nodes that were just harvested (game feel: the hit visibly lands).
    wobbleStart.current.forEach((start, i) => {
      if (start < 0) return;
      const t = (now - start) / WOBBLE_MS;
      const live = charges.current[i] ?? 0;
      if (t >= 1) {
        wobbleStart.current[i] = -1;
        placeNode(i, live === 0);
        return;
      }
      placeNode(i, live === 0, Math.sin(t * Math.PI * 4) * 0.08 * (1 - t));
    });

    sinceCheck.current += dt;
    if (!room || sinceCheck.current < CHECK_INTERVAL) return;
    sinceCheck.current = 0;
    nodes.forEach((node, i) => {
      const live = room.state.resources.get(node.id)?.charges ?? 0;
      const prev = charges.current[i] ?? -1;
      if (live === prev) return;
      charges.current[i] = live;
      if (prev > live && prev >= 0) {
        wobbleStart.current[i] = now;
        playHarvestAt(kind, node.x, node.z);
        emitBurst(BURST[kind], node.x, terrainHeight(node.x, node.z) + 1, node.z);
      }
      placeNode(i, live === 0);
    });
  });

  return (
    <>
      {parts.map((part, p) => (
        <instancedMesh
          key={p}
          ref={(m) => {
            meshes.current[p] = m;
          }}
          args={[part.geometry, undefined, nodes.length * part.perNode]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color={PALETTE.white}
            emissive={part.color}
            emissiveIntensity={part.glow ?? 0}
            flatShading
          />
        </instancedMesh>
      ))}
    </>
  );
}

/** All trees, rocks, bushes and mushrooms: a handful of draw calls for ~175 nodes. */
export function Resources() {
  return (
    <>
      <KindInstances kind="tree" />
      <KindInstances kind="rock" />
      <KindInstances kind="bush" />
      <KindInstances kind="mushroom" />
      <KindInstances kind="nest" />
    </>
  );
}
