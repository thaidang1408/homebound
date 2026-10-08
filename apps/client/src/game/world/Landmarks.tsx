import type { Room } from '@colyseus/sdk';
import {
  LANDMARKS,
  WAYSTONES,
  terrainHeight,
  type HomeState,
  type LandmarkDefinition,
} from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

/**
 * The wilds' landmarks (Phase 12): big, simple silhouettes you can spot from the ridge. The giant
 * tree and the shrine's beam of light reach above the forest; waystones glow once lit.
 */

function Std({ color, glow = 0 }: { color: string; glow?: number }) {
  return (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} flatShading />
  );
}

function GiantTree() {
  return (
    <>
      <mesh position-y={7}>
        <cylinderGeometry args={[0.9, 1.4, 14, 7]} />
        <Std color={PALETTE.giantBark} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 1.6) * 1.4, 0.3, Math.sin(i * 1.6) * 1.4]}
          rotation-y={i}
        >
          <boxGeometry args={[1.6, 0.6, 0.5]} />
          <Std color={PALETTE.giantBark} />
        </mesh>
      ))}
      <mesh position-y={14}>
        <icosahedronGeometry args={[6.5, 0]} />
        <Std color={PALETTE.giantLeaves} />
      </mesh>
      <mesh position={[2.5, 17.5, -1]}>
        <icosahedronGeometry args={[4.2, 0]} />
        <Std color={PALETTE.leavesLight} />
      </mesh>
    </>
  );
}

function Cave() {
  // Open to the west (toward home): the back wall and two sides of rock under a roof slab.
  return (
    <>
      <mesh position={[3.4, 1.6, 0]} scale={[1, 1.3, 2.4]}>
        <dodecahedronGeometry args={[1.8, 0]} />
        <Std color={PALETTE.caveRock} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 1.4, side * 3.6]} scale={[2.2, 1.1, 0.8]}>
          <dodecahedronGeometry args={[1.8, 0]} />
          <Std color={PALETTE.caveRock} />
        </mesh>
      ))}
      <mesh position={[0.6, 3.4, 0]} scale={[2.4, 0.6, 2.2]}>
        <dodecahedronGeometry args={[2, 0]} />
        <Std color={PALETTE.rock} />
      </mesh>
    </>
  );
}

function Camp() {
  return (
    <>
      <mesh position={[1.2, 1, 1.6]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[1.8, 2, 4]} />
        <Std color={PALETTE.tent} />
      </mesh>
      {/* the cold campfire: a ring of stones and charred logs, still glowing a little */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos(i) * 0.6 - 1, 0.1, Math.sin(i) * 0.6 - 1]}>
          <dodecahedronGeometry args={[0.16, 0]} />
          <Std color={PALETTE.rock} />
        </mesh>
      ))}
      <mesh position={[-1, 0.15, -1]} rotation={[0, 0.6, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.9, 5]} />
        <Std color={PALETTE.ember} glow={0.6} />
      </mesh>
      <mesh position={[-2.6, 0.2, 0.4]} rotation={[0, 0.3, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1.8, 6]} />
        <Std color={PALETTE.trunk} />
      </mesh>
    </>
  );
}

function Watchtower() {
  const posts: [number, number][] = [
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ];
  return (
    <>
      {posts.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 4.5, z]}>
          <boxGeometry args={[0.3, 9, 0.3]} />
          <Std color={PALETTE.woodDark} />
        </mesh>
      ))}
      <mesh position-y={9}>
        <boxGeometry args={[3.6, 0.3, 3.6]} />
        <Std color={PALETTE.wood} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 9.6, side * 1.75]}>
          <boxGeometry args={[3.6, 0.8, 0.12]} />
          <Std color={PALETTE.woodDark} />
        </mesh>
      ))}
      <mesh position-y={11.4} rotation-y={Math.PI / 4}>
        <coneGeometry args={[2.8, 1.8, 4]} />
        <Std color={PALETTE.roof} />
      </mesh>
      {/* a ladder up the west side, toward home */}
      <mesh position={[1.45, 4.5, 0]} rotation-z={0.04}>
        <boxGeometry args={[0.1, 9, 0.8]} />
        <Std color={PALETTE.wood} />
      </mesh>
      {/* broken walls and pillars of the old ruins around it */}
      {(
        [
          [-6, 4, 0.3, 2.4],
          [5, -6, 1.2, 1.6],
          [-4, -7, 2.1, 3],
          [7, 5, 0.8, 1.2],
        ] as const
      ).map(([x, z, rot, h], i) => (
        <mesh key={i} position={[x, h / 2, z]} rotation-y={rot}>
          <boxGeometry args={[i % 2 ? 0.7 : 2.6, h, 0.7]} />
          <Std color={i % 2 ? PALETTE.ruinStone : PALETTE.ruinStoneDark} />
        </mesh>
      ))}
    </>
  );
}

function Shrine() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 3, 1.1, Math.sin(a) * 3]} rotation-y={-a}>
            <boxGeometry args={[0.6, 2.2, 0.6]} />
            <Std color={PALETTE.ruinStone} />
          </mesh>
        );
      })}
      <mesh position-y={0.7}>
        <octahedronGeometry args={[0.6, 0]} />
        <Std color={PALETTE.shrineGlow} glow={1.2} />
      </mesh>
      {/* a beam of light you can see from the ridge */}
      <mesh position-y={14}>
        <cylinderGeometry args={[0.25, 0.4, 26, 6, 1, true]} />
        <meshBasicMaterial color={PALETTE.shrineGlow} transparent opacity={0.35} fog={false} />
      </mesh>
    </>
  );
}

const MODELS = {
  giant_tree: GiantTree,
  cave: Cave,
  camp: Camp,
  watchtower: Watchtower,
  shrine: Shrine,
} as const;

function Cache({ landmark, opened }: { landmark: LandmarkDefinition; opened: boolean }) {
  const at = landmark.cache?.at;
  if (!at) return null;
  return (
    <group position={[at.x, terrainHeight(at.x, at.z), at.z]}>
      <mesh position-y={0.25}>
        <boxGeometry args={[0.8, 0.5, 0.55]} />
        <Std color={PALETTE.cacheWood} />
      </mesh>
      {/* the lid: tipped open once it's been emptied today */}
      <mesh position={[0, 0.55, opened ? 0.3 : 0]} rotation-x={opened ? -1.2 : 0}>
        <boxGeometry args={[0.84, 0.12, 0.6]} />
        <Std color={PALETTE.cacheBand} glow={opened ? 0 : 0.35} />
      </mesh>
    </group>
  );
}

function Waystone({ x, z, lit }: { x: number; z: number; lit: boolean }) {
  return (
    <group position={[x, terrainHeight(x, z), z]}>
      <mesh position-y={0.85} rotation-y={0.3}>
        <boxGeometry args={[0.55, 1.7, 0.45]} />
        <Std color={PALETTE.waystone} />
      </mesh>
      <mesh position={[0, 1.15, 0]} rotation-y={0.3}>
        <boxGeometry args={[0.6, 0.18, 0.5]} />
        <Std color={lit ? PALETTE.waystoneLit : PALETTE.ruinStoneDark} glow={lit ? 1.1 : 0} />
      </mesh>
    </group>
  );
}

/** Landmarks, their caches and every waystone. Re-renders with the HUD (discoveries, caches). */
export function Landmarks({ room }: { room: Room<HomeState> }) {
  useSession(); // roomWatcher bumps the version when something is discovered or looted
  const { discovered, caches } = room.state;
  return (
    <>
      {LANDMARKS.map((l) => {
        const Model = MODELS[l.kind];
        return (
          <group key={l.id}>
            <group position={[l.x, terrainHeight(l.x, l.z), l.z]}>
              <Model />
            </group>
            <Cache landmark={l} opened={caches.has(l.id)} />
          </group>
        );
      })}
      {WAYSTONES.map((w) => (
        <Waystone
          key={w.id}
          x={w.at.x}
          z={w.at.z}
          lit={w.landmark === '' || discovered.has(w.landmark)}
        />
      ))}
    </>
  );
}
