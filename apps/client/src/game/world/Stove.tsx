import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { StoveStatus } from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

const RAW = new Color(PALETTE.rawMeat);
const COOKED = new Color(PALETTE.cookedMeat);
const PUFFS = 4;
const PUFF_RISE = 0.9; // m
const PUFF_PERIOD = 1.6; // s

/**
 * The stove reads the synced stove state every frame: meat browns with progress, smoke rises
 * while cooking, the progress bar fills, and finished food bobs to say "take me".
 */
export function Stove({ w, d, h }: { w: number; d: number; h: number }) {
  const barWidth = w - 0.2;
  const { room } = useSession();
  const meat = useRef<Mesh>(null);
  const bar = useRef<Mesh>(null);
  const smoke = useRef<Group>(null);

  useFrame(({ clock }) => {
    const stove = room?.state.stove;
    if (!stove || !meat.current || !bar.current || !smoke.current) return;
    const t = clock.elapsedTime;
    const cooking = stove.status === StoveStatus.Cooking;
    const done = stove.status === StoveStatus.Done;

    meat.current.visible = cooking || done;
    const material = meat.current.material as MeshStandardMaterial;
    material.color.lerpColors(RAW, COOKED, done ? 1 : stove.progress);
    // Sizzle while cooking, gentle bob when ready.
    meat.current.position.y = h + 0.1 + (cooking ? Math.abs(Math.sin(t * 18)) * 0.01 : 0);
    meat.current.position.y += done ? Math.sin(t * 3) * 0.03 + 0.03 : 0;

    bar.current.visible = cooking;
    const progress = Math.max(0.001, stove.progress);
    bar.current.scale.x = progress;
    bar.current.position.x = (barWidth * progress) / 2; // keep the left edge fixed

    smoke.current.visible = cooking;
    smoke.current.children.forEach((puff, i) => {
      const phase = (t / PUFF_PERIOD + i / PUFFS) % 1;
      puff.position.set(Math.sin((t + i) * 1.3) * 0.06, h + 0.15 + phase * PUFF_RISE, 0);
      puff.scale.setScalar(0.4 + phase * 0.8);
    });
  });

  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={PALETTE.iron} flatShading />
      </mesh>
      {/* Pan */}
      <mesh position={[0, h + 0.03, 0]}>
        <cylinderGeometry args={[0.28, 0.24, 0.06, 10]} />
        <meshStandardMaterial color={PALETTE.ironLight} flatShading />
      </mesh>
      <mesh ref={meat} visible={false}>
        <boxGeometry args={[0.3, 0.07, 0.2]} />
        <meshStandardMaterial color={PALETTE.rawMeat} flatShading />
      </mesh>
      <group ref={smoke} visible={false}>
        {Array.from({ length: PUFFS }, (_, i) => (
          <mesh key={i}>
            <icosahedronGeometry args={[0.07, 0]} />
            <meshStandardMaterial color={PALETTE.smoke} transparent opacity={0.6} flatShading />
          </mesh>
        ))}
      </group>
      {/* Progress bar above the stove, anchored on its left so it fills to the right. */}
      <group position={[-w / 2 + 0.1, h + 1.25, 0]}>
        <mesh ref={bar} visible={false}>
          <boxGeometry args={[barWidth, 0.06, 0.06]} />
          <meshStandardMaterial
            color={PALETTE.progress}
            emissive={PALETTE.progress}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>
    </>
  );
}
