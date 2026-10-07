import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { Room } from '@colyseus/sdk';
import type { HomeState } from '@homebound/shared';
import { PALETTE } from '../world/palette';

/** More arrows than two players can have in the air at once. */
const POOL = 12;
/** Extrapolate between server updates at most this long (s). */
const MAX_EXTRAPOLATION = 0.12;

interface Track {
  id: string;
  /** Last server position, when it arrived, and the velocity estimated from the previous one. */
  pos: Vector3;
  vel: Vector3;
  at: number;
}

const scratch = new Vector3();

/**
 * Arrows in flight. The server moves them ~10×/s; between updates each one is extrapolated along
 * its estimated velocity and pointed where it is heading. A fixed pool: no React re-renders.
 */
export function Arrows({ room }: { room: Room<HomeState> }) {
  const meshes = useRef<(Group | null)[]>([]);
  const tracks = useRef<(Track | null)[]>(Array.from({ length: POOL }, () => null));

  useFrame(() => {
    const now = performance.now() / 1000;
    const live = room.state.projectiles;
    const slots = tracks.current;

    // Free slots whose arrow is gone; update the rest.
    slots.forEach((t, i) => {
      if (t && !live.has(t.id)) slots[i] = null;
    });
    live.forEach((p, id) => {
      let t = slots.find((s) => s?.id === id);
      if (!t) {
        const free = slots.indexOf(null);
        if (free < 0) return;
        t = { id, pos: new Vector3(p.x, p.y, p.z), vel: new Vector3(), at: now };
        slots[free] = t;
      } else if (t.pos.x !== p.x || t.pos.y !== p.y || t.pos.z !== p.z) {
        const dt = Math.max(1e-3, now - t.at);
        t.vel.set(p.x - t.pos.x, p.y - t.pos.y, p.z - t.pos.z).divideScalar(dt);
        t.pos.set(p.x, p.y, p.z);
        t.at = now;
      }
    });

    slots.forEach((t, i) => {
      const g = meshes.current[i];
      if (!g) return;
      g.visible = t !== null;
      if (!t) return;
      const ahead = Math.min(now - t.at, MAX_EXTRAPOLATION);
      g.position.copy(t.pos).addScaledVector(t.vel, ahead);
      if (t.vel.lengthSq() > 0) g.lookAt(scratch.copy(g.position).add(t.vel));
    });
  });

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(g) => {
            meshes.current[i] = g;
          }}
        >
          {/* lookAt points +Z at the target: the arrow is modelled along +Z. */}
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.015, 0.015, 0.7, 4]} />
            <meshStandardMaterial color={PALETTE.wood} flatShading />
          </mesh>
          <mesh position-z={0.38} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.035, 0.09, 4]} />
            <meshStandardMaterial color={PALETTE.iron} flatShading />
          </mesh>
          <mesh position-z={-0.3}>
            <boxGeometry args={[0.07, 0.005, 0.12]} />
            <meshStandardMaterial color={PALETTE.fletching} />
          </mesh>
        </group>
      ))}
    </>
  );
}
