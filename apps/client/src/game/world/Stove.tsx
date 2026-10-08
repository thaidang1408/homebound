import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { STOVE_PANS, StoveStatus } from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

const RAW = new Color(PALETTE.rawMeat);
const RAW_MUSHROOM = new Color(PALETTE.mushroomCap);
const COOKED = new Color(PALETTE.cookedMeat);
const PUFFS = 3;
const PUFF_RISE = 0.9; // m
const PUFF_PERIOD = 1.6; // s
const PAN_RADIUS = 0.15; // m
const BAR_WIDTH = 0.26; // m

/**
 * One pan (ADR-027): reads its synced state every frame — food browns with progress, smoke rises
 * while cooking, its progress bar fills, and finished food bobs to say "take me".
 */
function Pan({ index, x, h }: { index: number; x: number; h: number }) {
  const { room } = useSession();
  const food = useRef<Mesh>(null);
  const bar = useRef<Mesh>(null);
  const smoke = useRef<Group>(null);

  useFrame(({ clock }) => {
    const pan = room?.state.pans.at(index);
    if (!pan || !food.current || !bar.current || !smoke.current) return;
    const t = clock.elapsedTime + index;
    const cooking = pan.status === StoveStatus.Cooking;
    const done = pan.status === StoveStatus.Done;

    food.current.visible = cooking || done;
    const material = food.current.material as MeshStandardMaterial;
    const raw = pan.itemId === 'mushroom' ? RAW_MUSHROOM : RAW;
    material.color.lerpColors(raw, COOKED, done ? 1 : pan.progress);
    // Sizzle while cooking, gentle bob when ready.
    food.current.position.y = h + 0.09 + (cooking ? Math.abs(Math.sin(t * 18)) * 0.01 : 0);
    food.current.position.y += done ? Math.sin(t * 3) * 0.03 + 0.03 : 0;

    bar.current.visible = cooking;
    const progress = Math.max(0.001, pan.progress);
    bar.current.scale.x = progress;
    bar.current.position.x = (BAR_WIDTH * progress) / 2; // keep the left edge fixed

    smoke.current.visible = cooking;
    smoke.current.children.forEach((puff, i) => {
      const phase = (t / PUFF_PERIOD + i / PUFFS) % 1;
      puff.position.set(Math.sin((t + i) * 1.3) * 0.05, h + 0.15 + phase * PUFF_RISE, 0);
      puff.scale.setScalar(0.4 + phase * 0.8);
    });
  });

  return (
    <group position-x={x}>
      <mesh position={[0, h + 0.03, 0]}>
        <cylinderGeometry args={[PAN_RADIUS, PAN_RADIUS * 0.85, 0.05, 10]} />
        <meshStandardMaterial color={PALETTE.ironLight} flatShading />
      </mesh>
      <mesh ref={food} visible={false}>
        <boxGeometry args={[0.17, 0.06, 0.13]} />
        <meshStandardMaterial color={PALETTE.rawMeat} flatShading />
      </mesh>
      <group ref={smoke} visible={false}>
        {Array.from({ length: PUFFS }, (_, i) => (
          <mesh key={i}>
            <icosahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial color={PALETTE.smoke} transparent opacity={0.6} flatShading />
          </mesh>
        ))}
      </group>
      {/* Progress bar above the pan, anchored on its left so it fills to the right. */}
      <group position={[-BAR_WIDTH / 2, h + 1.25, 0]}>
        <mesh ref={bar} visible={false}>
          <boxGeometry args={[BAR_WIDTH, 0.05, 0.05]} />
          <meshStandardMaterial
            color={PALETTE.progress}
            emissive={PALETTE.progress}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>
    </group>
  );
}

/** The kitchen stove with STOVE_PANS pans side by side. */
export function Stove({ w, d, h }: { w: number; d: number; h: number }) {
  const step = w / STOVE_PANS;
  return (
    <>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={PALETTE.iron} flatShading />
      </mesh>
      {Array.from({ length: STOVE_PANS }, (_, i) => (
        <Pan key={i} index={i} x={-w / 2 + step * (i + 0.5)} h={h} />
      ))}
    </>
  );
}
