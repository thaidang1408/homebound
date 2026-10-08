import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, MeshBasicMaterial } from 'three';
import type { Room } from '@colyseus/sdk';
import { PING_MS, terrainHeight, type HomeState } from '@homebound/shared';
import { usePings, type Ping } from '../../state/pings';
import { playerColor } from '../player/playerColors';

const BEAM_HEIGHT = 7;
const FADE_MS = 1500;
const PULSE_MS = 900;

/** A tall light beam with a pulsing ring: visible across the meadow, fades near the end. */
function Marker({ ping, color }: { ping: Ping; color: string }) {
  const ring = useRef<Group>(null);
  const beam = useRef<MeshBasicMaterial>(null);
  const disc = useRef<MeshBasicMaterial>(null);

  useFrame(() => {
    const age = performance.now() - ping.at;
    const fade = Math.min(1, Math.max(0, (PING_MS - age) / FADE_MS));
    const pulse = (age % PULSE_MS) / PULSE_MS;
    if (ring.current) ring.current.scale.setScalar(0.6 + pulse * 1.4);
    if (disc.current) disc.current.opacity = (1 - pulse) * 0.8 * fade;
    if (beam.current) beam.current.opacity = 0.45 * fade;
  });

  return (
    <group position={[ping.x, terrainHeight(ping.x, ping.z), ping.z]}>
      <mesh position-y={BEAM_HEIGHT / 2}>
        <cylinderGeometry args={[0.07, 0.12, BEAM_HEIGHT, 6, 1, true]} />
        <meshBasicMaterial ref={beam} color={color} transparent depthWrite={false} />
      </mesh>
      <group ref={ring} position-y={0.06} rotation-x={-Math.PI / 2}>
        <mesh>
          <ringGeometry args={[0.45, 0.6, 24]} />
          <meshBasicMaterial ref={disc} color={color} transparent depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Live "look here" marks, in the color of whoever placed them. */
export function PingMarkers({ room }: { room: Room<HomeState> }) {
  const { pings } = usePings();
  return (
    <>
      {pings.map((p) => (
        <Marker
          key={p.id}
          ping={p}
          color={playerColor(room.state.players.get(p.from)?.slot ?? 1)}
        />
      ))}
    </>
  );
}
