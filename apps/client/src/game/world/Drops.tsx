import type { Room } from '@colyseus/sdk';
import { terrainHeight, type HomeState } from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

/** Things dropped out of a backpack: a little tied sack each ([E] says what's inside). */
export function Drops({ room }: { room: Room<HomeState> }) {
  useSession(); // re-render on state changes (roomWatcher bumps the version)
  return (
    <>
      {[...room.state.drops.entries()].map(([id, d]) => (
        <group key={id} position={[d.x, terrainHeight(d.x, d.z), d.z]}>
          <mesh position-y={0.13} scale={[1, 0.8, 1]}>
            <icosahedronGeometry args={[0.17, 0]} />
            <meshStandardMaterial color={PALETTE.rope} flatShading />
          </mesh>
          <mesh position-y={0.28}>
            <cylinderGeometry args={[0.04, 0.07, 0.08, 6]} />
            <meshStandardMaterial color={PALETTE.woodDark} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}
