import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MathUtils, type Group } from 'three';
import type { Room } from '@colyseus/sdk';
import type { HomeState } from '@homebound/shared';
import { MAX_FRAME_DT, REMOTE_SMOOTHING } from '../../config/controls';
import { playerColor } from './playerColors';
import styles from './RemotePlayer.module.css';

const TWO_PI = Math.PI * 2;

/** Shortest signed angle from `from` to `to`, so yaw never unwinds the long way round. */
function angleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, TWO_PI) - Math.PI;
}

interface Props {
  room: Room<HomeState>;
  sessionId: string;
  name: string;
  slot: number;
  connected: boolean;
}

/** The partner's body. Reads synced state every frame and smooths toward it. */
export function RemotePlayer({ room, sessionId, name, slot, connected }: Props) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const placed = useRef(false);
  const color = playerColor(slot);

  useFrame((_, rawDt) => {
    const state = room.state.players.get(sessionId);
    if (!state || !body.current || !head.current) return;
    const g = body.current;

    if (!placed.current) {
      g.position.set(state.x, 0, state.z);
      g.rotation.y = state.yaw;
      placed.current = true;
    }

    const dt = Math.min(rawDt, MAX_FRAME_DT);
    g.position.x = MathUtils.damp(g.position.x, state.x, REMOTE_SMOOTHING, dt);
    g.position.z = MathUtils.damp(g.position.z, state.z, REMOTE_SMOOTHING, dt);
    const t = 1 - Math.exp(-REMOTE_SMOOTHING * dt);
    g.rotation.y += angleDelta(g.rotation.y, state.yaw) * t;
    head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, state.pitch, t);
  });

  return (
    <group ref={body}>
      {/* Low-poly body: capsule torso + boxy head with a visor showing where they look. */}
      <mesh position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.32, 0.9, 3, 8]} />
        <meshStandardMaterial
          color={color}
          flatShading
          transparent={!connected}
          opacity={connected ? 1 : 0.35}
        />
      </mesh>
      <group ref={head} position={[0, 1.6, 0]}>
        <mesh>
          <boxGeometry args={[0.42, 0.38, 0.42]} />
          <meshStandardMaterial color="#f2d4b0" flatShading />
        </mesh>
        <mesh position={[0, 0.04, -0.215]}>
          <boxGeometry args={[0.3, 0.1, 0.02]} />
          <meshStandardMaterial color="#2a3430" />
        </mesh>
      </group>
      <Html position={[0, 2.15, 0]} center distanceFactor={10} className={styles.label}>
        {connected ? name : `${name} (reconnecting…)`}
      </Html>
    </group>
  );
}
