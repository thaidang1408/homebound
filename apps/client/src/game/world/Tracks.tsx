import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CircleGeometry, Color, Object3D, type InstancedMesh } from 'three';
import type { Room } from '@colyseus/sdk';
import { CreatureMode, terrainHeight, type HomeState } from '@homebound/shared';
import { PALETTE } from './palette';

/** Footprints kept at once (a ring buffer), how long they last, and how long they look fresh. */
const MAX_PRINTS = 400;
const LIFETIME_MS = 90_000;
const FRESH_MS = 20_000;
/** A print every this many metres, by kind; side-to-side offset of left/right feet. */
const STRIDE: Record<string, number> = { deer: 0.9, rabbit: 0.5, bear: 1.2, boar: 0.8, wolf: 0.8 };
const SIZE: Record<string, number> = {
  deer: 0.07,
  rabbit: 0.045,
  bear: 0.14,
  boar: 0.07,
  wolf: 0.06,
};
const FOOT_OFFSET = 0.12;
const REFRESH_S = 1;

const OLD = new Color(PALETTE.trunk);
const FRESH = new Color(PALETTE.focus);

/**
 * Tracks: every animal leaves footprints as it moves (drawn from the synced positions, nothing
 * extra on the network). Fresh ones glow faintly; they fade over a minute and a half. One draw
 * call for all of them.
 */
export function Tracks({ room }: { room: Room<HomeState> }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new CircleGeometry(1, 5).rotateX(-Math.PI / 2), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const s = useRef({
    next: 0,
    sinceRefresh: 0,
    bornAt: new Float64Array(MAX_PRINTS).fill(-1e12),
    size: new Float32Array(MAX_PRINTS),
    last: new Map<string, { x: number; z: number; left: boolean }>(),
  });

  const draw = (i: number, now: number) => {
    const m = mesh.current;
    if (!m) return;
    const age = now - (s.current.bornAt[i] ?? -1e12);
    const life = Math.max(0, 1 - age / LIFETIME_MS);
    m.getMatrixAt(i, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    dummy.scale.setScalar(life > 0 ? (s.current.size[i] ?? 0) * (0.6 + 0.4 * life) : 0.0001);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.setColorAt(i, color.copy(OLD).lerp(FRESH, Math.max(0, 1 - age / FRESH_MS) * 0.7));
  };

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const now = performance.now();
    const st = s.current;
    room.state.creatures.forEach((c, id) => {
      const stride = STRIDE[c.kind];
      if (!stride || !c.present || c.mode === CreatureMode.Dead) {
        st.last.delete(id);
        return;
      }
      const prev = st.last.get(id);
      if (!prev) {
        st.last.set(id, { x: c.x, z: c.z, left: false });
        return;
      }
      if (Math.hypot(c.x - prev.x, c.z - prev.z) < stride) return;
      // A print beside the path, alternating feet, facing the way it went.
      const side = prev.left ? 1 : -1;
      const sideX = Math.cos(c.yaw) * FOOT_OFFSET * side;
      const sideZ = -Math.sin(c.yaw) * FOOT_OFFSET * side;
      const i = st.next;
      st.next = (st.next + 1) % MAX_PRINTS;
      st.bornAt[i] = now;
      st.size[i] = SIZE[c.kind] ?? 0.06;
      dummy.position.set(c.x + sideX, terrainHeight(c.x, c.z) + 0.02, c.z + sideZ);
      dummy.rotation.set(0, c.yaw, 0);
      dummy.scale.set(1, 1, 1.4);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      draw(i, now);
      st.last.set(id, { x: c.x, z: c.z, left: !prev.left });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    // Age everything once a second (no per-frame churn).
    st.sinceRefresh += dt;
    if (st.sinceRefresh < REFRESH_S) return;
    st.sinceRefresh = 0;
    for (let i = 0; i < MAX_PRINTS; i++)
      if (now - (st.bornAt[i] ?? 0) < LIFETIME_MS + 2000) draw(i, now);
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={(m) => {
        mesh.current = m;
        if (!m) return;
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        for (let i = 0; i < MAX_PRINTS; i++) {
          m.setMatrixAt(i, dummy.matrix);
          m.setColorAt(i, OLD);
        }
      }}
      args={[geometry, undefined, MAX_PRINTS]}
      frustumCulled={false}
    >
      <meshBasicMaterial transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}
