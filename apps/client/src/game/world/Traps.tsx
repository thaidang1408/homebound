import type { Room } from '@colyseus/sdk';
import { terrainHeight, type HomeState } from '@homebound/shared';
import { useSession } from '../../state/session';
import { PALETTE } from './palette';

const SPIKES = [-0.16, -0.08, 0, 0.08, 0.16];

/** A snare: a stake and a rope loop (pulled tight once sprung). */
function Snare({ sprung }: { sprung: boolean }) {
  return (
    <>
      <mesh position-y={0.18}>
        <cylinderGeometry args={[0.025, 0.03, 0.36, 5]} />
        <meshStandardMaterial color={PALETTE.wood} flatShading />
      </mesh>
      <mesh position={[0, 0.04, -0.2]} rotation-x={-Math.PI / 2} scale={sprung ? 0.35 : 1}>
        <torusGeometry args={[0.22, 0.018, 4, 12]} />
        <meshStandardMaterial color={PALETTE.rope} flatShading />
      </mesh>
    </>
  );
}

/** A spike trap: a board with a row of points (knocked flat once sprung). */
function Spikes({ sprung }: { sprung: boolean }) {
  return (
    <>
      <mesh position-y={0.03}>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <meshStandardMaterial color={PALETTE.woodDark} flatShading />
      </mesh>
      {SPIKES.map((x) => (
        <mesh key={x} position={[x, 0.14, 0]} rotation-x={sprung ? 1.2 : 0}>
          <coneGeometry args={[0.03, 0.18, 4]} />
          <meshStandardMaterial color={PALETTE.spike} flatShading />
        </mesh>
      ))}
    </>
  );
}

/** Traps on the ground. Re-renders with the HUD when one is set, sprung or picked up. */
export function Traps({ room }: { room: Room<HomeState> }) {
  useSession(); // re-render on state changes (roomWatcher bumps the version)
  return (
    <>
      {[...room.state.traps.entries()].map(([id, t]) => (
        <group key={id} position={[t.x, terrainHeight(t.x, t.z), t.z]}>
          {t.kind === 'snare' ? <Snare sprung={t.sprung} /> : <Spikes sprung={t.sprung} />}
        </group>
      ))}
    </>
  );
}
