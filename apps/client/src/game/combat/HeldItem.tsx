import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import type { Room } from '@colyseus/sdk';
import type { HomeState, PlayerAction, WeaponId } from '@homebound/shared';
import { MAX_FRAME_DT } from '../../config/controls';
import { angleDelta } from '../angles';
import { heldWeaponId } from '../player/held';
import { localPose } from '../player/localPose';
import { playerColor } from '../player/playerColors';
import { PALETTE } from '../world/palette';
import { BowModel, SpearModel } from './WeaponModels';

/** Where the hand rests in view space (right side, below the crosshair). */
const REST = { x: 0.32, y: -0.3, z: -0.55 };

/** Offsets from REST: x, y, z (m) and tilt rx, rz (radians). */
type Pose = readonly [number, number, number, number, number];
const STILL: Pose = [0, 0, 0, 0, 0];
type Clip = { ms: number; keys: readonly (readonly [number, Pose])[] };

const MOUTH: Pose = [-0.26, 0.12, 0.2, 0.4, 0];
const CHEW: Pose = [-0.26, 0.09, 0.2, 0.4, 0];
const WAVE_L: Pose = [0.04, 0.32, 0, 0, 0.4];
const WAVE_R: Pose = [0.04, 0.32, 0, 0, -0.3];
const POINT: Pose = [-0.12, 0.1, -0.25, -0.2, 0];

/** Each animation is a few key poses over time (0 → 1), eased between. */
const CLIPS = {
  punch: {
    ms: 240,
    keys: [
      [0, STILL],
      [0.35, [-0.04, 0.04, -0.26, 0, 0]],
      [1, STILL],
    ],
  },
  stab: {
    ms: 300,
    keys: [
      [0, STILL],
      [0.3, [-0.03, 0.02, -0.42, -0.1, 0]],
      [1, STILL],
    ],
  },
  shoot: {
    ms: 360,
    keys: [
      [0, STILL],
      [0.4, [0.02, 0, 0.12, 0, 0]],
      [0.5, [0, 0, -0.04, 0, 0]],
      [1, STILL],
    ],
  },
  chop: {
    ms: 340,
    keys: [
      [0, STILL],
      [0.4, [0.02, 0.2, 0.06, 0.9, 0]],
      [0.6, [-0.04, -0.14, -0.14, -0.7, 0]],
      [1, STILL],
    ],
  },
  mine: {
    ms: 400,
    keys: [
      [0, STILL],
      [0.45, [0.02, 0.24, 0.08, 1, 0]],
      [0.62, [-0.04, -0.18, -0.12, -0.8, 0]],
      [1, STILL],
    ],
  },
  pick: {
    ms: 320,
    keys: [
      [0, STILL],
      [0.45, [-0.08, -0.08, -0.22, -0.3, 0]],
      [1, STILL],
    ],
  },
  eat: {
    ms: 700,
    keys: [
      [0, STILL],
      [0.25, MOUTH],
      [0.4, CHEW],
      [0.55, MOUTH],
      [0.7, CHEW],
      [1, STILL],
    ],
  },
  wave: {
    ms: 1100,
    keys: [
      [0, STILL],
      [0.2, WAVE_L],
      [0.4, WAVE_R],
      [0.6, WAVE_L],
      [0.8, WAVE_R],
      [1, STILL],
    ],
  },
  point: {
    ms: 900,
    keys: [
      [0, STILL],
      [0.25, POINT],
      [0.8, POINT],
      [1, STILL],
    ],
  },
  dodge: {
    ms: 380,
    keys: [
      [0, STILL],
      [0.3, [0, -0.3, 0.05, 0.3, 0]],
      [1, STILL],
    ],
  },
  jump: {
    ms: 300,
    keys: [
      [0, STILL],
      [0.3, [0, 0.05, 0, 0, 0]],
      [1, STILL],
    ],
  },
} satisfies Record<string, Clip>;

function clipFor(action: PlayerAction | '', weapon: WeaponId): Clip | null {
  if (action === '') return null;
  if (action === 'attack') return weapon === 'spear' ? CLIPS.stab : CLIPS.punch;
  return CLIPS[action];
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** The pose `elapsed` ms into a clip (STILL once it's over). */
function sample(clip: Clip, elapsed: number): Pose {
  const t = elapsed / clip.ms;
  if (t <= 0 || t >= 1) return STILL;
  for (let i = 1; i < clip.keys.length; i++) {
    const [t1, b] = clip.keys[i] ?? [1, STILL];
    if (t > t1) continue;
    const [t0, a] = clip.keys[i - 1] ?? [0, STILL];
    const k = smooth((t - t0) / (t1 - t0));
    return [
      MathUtils.lerp(a[0], b[0], k),
      MathUtils.lerp(a[1], b[1], k),
      MathUtils.lerp(a[2], b[2], k),
      MathUtils.lerp(a[3], b[3], k),
      MathUtils.lerp(a[4], b[4], k),
    ];
  }
  return STILL;
}

/** The arm lags behind fast turns a little, and bobs with each step. */
const SWAY = 0.6;
const SWAY_MAX = 0.06;
const BOB_X = 0.012;
const BOB_Y = 0.01;

/**
 * First-person arm: a sleeve and a hand holding the current weapon. It plays a short animation for
 * every local action (localAction), sways with the view and bobs while walking. Rendered after
 * LocalPlayer so the camera is final.
 */
export function HeldItem({ room }: { room: Room<HomeState> }) {
  const root = useRef<Group>(null);
  const hand = useRef<Group>(null);
  const spear = useRef<Group>(null);
  const bow = useRef<Group>(null);
  const sway = useRef({ x: 0, y: 0, yaw: 0, pitch: 0 });
  const me = room.state.players.get(room.sessionId);
  const sleeve = playerColor(me?.slot ?? 1);

  useFrame(({ camera }, rawDt) => {
    const g = root.current;
    if (!g || !hand.current) return;
    const dt = Math.min(rawDt, MAX_FRAME_DT);
    const self = room.state.players.get(room.sessionId);
    g.visible = !!self && !self.sleeping && !self.downed;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    const weapon = heldWeaponId(room);
    if (spear.current) spear.current.visible = weapon === 'spear';
    if (bow.current) bow.current.visible = weapon === 'bow';

    // Sway: turning right leaves the arm a little to the left, then it catches up.
    const s = sway.current;
    const turnX = MathUtils.clamp(angleDelta(localPose.yaw, s.yaw) * SWAY, -SWAY_MAX, SWAY_MAX);
    const turnY = MathUtils.clamp((localPose.pitch - s.pitch) * SWAY, -SWAY_MAX, SWAY_MAX);
    s.yaw = localPose.yaw;
    s.pitch = localPose.pitch;
    s.x = MathUtils.damp(s.x, turnX, 10, dt);
    s.y = MathUtils.damp(s.y, -turnY, 10, dt);

    const clip = clipFor(localPose.action, weapon);
    const [ax, ay, az, rx, rz] = clip
      ? sample(clip, performance.now() - localPose.actionAt)
      : STILL;
    const bob = localPose.walking;
    hand.current.position.set(
      REST.x + ax + s.x + Math.sin(localPose.bobPhase) * BOB_X * bob,
      REST.y + ay + s.y - Math.abs(Math.cos(localPose.bobPhase)) * BOB_Y * bob,
      REST.z + az,
    );
    hand.current.rotation.set(rx, 0, rz);
  });

  return (
    <group ref={root}>
      <group ref={hand}>
        {/* Sleeve from the hand back toward the shoulder, below the view. */}
        <mesh position={[0.02, -0.035, 0.2]} rotation-x={0.12}>
          <boxGeometry args={[0.075, 0.075, 0.34]} />
          <meshStandardMaterial color={sleeve} flatShading />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.08, 0.075, 0.1]} />
          <meshStandardMaterial color={PALETTE.skin} flatShading />
        </mesh>
        <group ref={spear} position-x={0.02} rotation-y={0.1} scale={0.8}>
          <SpearModel />
        </group>
        <group ref={bow} position={[-0.02, 0.04, -0.12]} rotation-z={-0.35} scale={0.55}>
          <BowModel />
        </group>
      </group>
    </group>
  );
}
