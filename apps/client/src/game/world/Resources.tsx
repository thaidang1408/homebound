import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Object3D,
  type BufferGeometry,
  type InstancedMesh,
} from 'three';
import {
  RESOURCE_NODES,
  terrainHeight,
  type ResourceKind,
  type ResourceNodeDefinition,
} from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

/** One instanced part of a resource (a tree = trunk + two canopy cones). */
interface Part {
  geometry: BufferGeometry;
  color: string;
  /** Instances of this part per node (berries: several per bush). */
  perNode: number;
  /** Place instance `i` of this part for a node; `depleted` swaps to the harvested look. */
  place(o: Object3D, node: ResourceNodeDefinition, i: number, depleted: boolean): void;
}

const HIDDEN = 0.0001;
const WOBBLE_MS = 350;
const CHECK_INTERVAL = 0.15; // s between depletion checks

function base(o: Object3D, n: ResourceNodeDefinition, y: number) {
  o.position.set(n.x, terrainHeight(n.x, n.z) + y * n.scale, n.z);
  o.rotation.set(0, n.rotation, 0);
  o.scale.setScalar(n.scale);
}

const PARTS: Record<ResourceKind, Part[]> = {
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
      perNode: 1,
      place(o, n, _i, depleted) {
        base(o, n, 3.0);
        if (depleted) o.scale.setScalar(HIDDEN);
      },
    },
    {
      geometry: new ConeGeometry(0.8, 1.5, 7),
      color: PALETTE.leavesLight,
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
      if (prev > live) wobbleStart.current[i] = now;
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
          <meshStandardMaterial color={part.color} flatShading />
        </instancedMesh>
      ))}
    </>
  );
}

/** All trees, rocks and bushes: a handful of draw calls for ~160 nodes. */
export function Resources() {
  return (
    <>
      <KindInstances kind="tree" />
      <KindInstances kind="rock" />
      <KindInstances kind="bush" />
    </>
  );
}
