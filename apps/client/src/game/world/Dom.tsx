import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, MeshStandardMaterial } from 'three';
import { findFurniture, boxCenter } from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

const TABLE_TOP = 0.78;
/** Brighter with every great lantern lit (Phase 13). */
const GLOW_BASE = 0.9;
const GLOW_PER_LANTERN = 0.25;

/**
 * Đốm, the little talking lantern on the kitchen table: a glass lantern with a face that bobs and
 * flickers. Glows warmer as the great lanterns are lit again.
 */
export function Dom() {
  const { room } = useSession();
  const root = useRef<Group>(null);
  const glass = useRef<MeshStandardMaterial>(null);
  const spot = findFurniture('dom');

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.position.y = TABLE_TOP + 0.08 + Math.sin(t * 2) * 0.03;
      root.current.rotation.y = Math.sin(t * 0.7) * 0.4;
    }
    if (glass.current) {
      const lit = room?.state.lanterns.size ?? 0;
      const flicker = 0.12 * Math.sin(t * 11) * Math.sin(t * 7.3);
      glass.current.emissiveIntensity = GLOW_BASE + lit * GLOW_PER_LANTERN + flicker;
    }
  });

  if (!spot) return null;
  const { x, z } = boxCenter(spot.box);
  return (
    <group position={[x, 0, z]}>
      <group ref={root}>
        <mesh position-y={0.14}>
          <boxGeometry args={[0.2, 0.22, 0.2]} />
          <meshStandardMaterial
            ref={glass}
            color={PALETTE.lamp}
            emissive={PALETTE.lamp}
            emissiveIntensity={GLOW_BASE}
            transparent
            opacity={0.9}
            flatShading
          />
        </mesh>
        {[0.02, 0.27].map((y) => (
          <mesh key={y} position-y={y}>
            <boxGeometry args={[0.24, 0.04, 0.24]} />
            <meshStandardMaterial color={PALETTE.iron} flatShading />
          </mesh>
        ))}
        <mesh position-y={0.33}>
          <torusGeometry args={[0.05, 0.012, 4, 8]} />
          <meshStandardMaterial color={PALETTE.iron} flatShading />
        </mesh>
        {/* a face on the glass, toward the room (+Z) */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.045, 0.17, 0.101]}>
            <boxGeometry args={[0.025, 0.04, 0.005]} />
            <meshBasicMaterial color={PALETTE.eye} />
          </mesh>
        ))}
        <mesh position={[0, 0.115, 0.101]}>
          <boxGeometry args={[0.05, 0.012, 0.005]} />
          <meshBasicMaterial color={PALETTE.eye} />
        </mesh>
      </group>
    </group>
  );
}
