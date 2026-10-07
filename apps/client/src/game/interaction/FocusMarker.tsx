import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { boxCenter, findInteractable, terrainHeight } from '@homebound/shared';
import { useUi } from '../../state/ui';
import { PALETTE } from '../world/palette';

/** Soft pulsing ring on the floor under whatever [E] would use. */
export function FocusMarker() {
  const { focusId } = useUi();
  const ring = useRef<Mesh>(null);
  const target = focusId ? findInteractable(focusId) : undefined;

  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.06);
  });

  if (!target) return null;
  const c = boxCenter(target.box);
  const radius =
    Math.hypot(target.box.maxX - target.box.minX, target.box.maxZ - target.box.minZ) / 2 + 0.15;

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
