import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import {
  CREATURES,
  boxCenter,
  findInteractable,
  isCreatureKind,
  terrainHeight,
  type Box,
} from '@homebound/shared';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { PALETTE } from '../world/palette';

/** Footprint of the focused thing: furniture/resource box, or a square around a carcass. */
function focusBox(id: string, creature?: { kind: string; x: number; z: number }): Box | undefined {
  if (creature && isCreatureKind(creature.kind)) {
    const r = CREATURES[creature.kind].radius;
    return {
      minX: creature.x - r,
      maxX: creature.x + r,
      minZ: creature.z - r,
      maxZ: creature.z + r,
    };
  }
  return findInteractable(id)?.box;
}

/** Soft pulsing ring on the floor under whatever [E] would use. */
export function FocusMarker() {
  const { focusId } = useUi();
  const ring = useRef<Mesh>(null);
  const { room } = useSession();
  const box = focusId ? focusBox(focusId, room?.state.creatures.get(focusId)) : undefined;

  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.06);
  });

  if (!box) return null;
  const c = boxCenter(box);
  const radius = Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 0.15;

  return (
    <mesh
      ref={ring}
      position={[c.x, terrainHeight(c.x, c.z) + 0.04, c.z]}
      rotation-x={-Math.PI / 2}
    >
      <ringGeometry args={[radius, radius + 0.08, 24]} />
      <meshBasicMaterial color={PALETTE.focus} transparent opacity={0.8} />
    </mesh>
  );
}
