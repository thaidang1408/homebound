import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, MeshStandardMaterial, type Group } from 'three';
import type { Room } from '@colyseus/sdk';
import {
  DODGE_MS,
  GRAVITY,
  JUMP_SPEED,
  PLAYER_WALK_SPEED,
  terrainHeight,
  type HomeState,
  type PlayerAction,
  type WeaponId,
} from '@homebound/shared';
import { MAX_FRAME_DT, REMOTE_SMOOTHING } from '../../config/controls';
import { playerColor } from './playerColors';
import { NameTag } from './NameTag';
import { BowModel, SpearModel } from '../combat/WeaponModels';
import { angleDelta } from '../angles';
import { PALETTE } from '../world/palette';

/** Lying in bed: body tipped back onto the mattress, head toward the headboard (−Z). */
const SLEEP_TILT = -Math.PI / 2;
const SLEEP_HEIGHT = 0.62;
const SLEEP_FEET_OFFSET = 0.85;
const DOWNED_TILT = 1.2;
const DOWNED_HEIGHT = 0.3;
const TAG_HIGH = 2.15;
const TAG_LOW = 1.2;
const TAG_HIDE_DISTANCE = 2.5;

/** Body proportions (m): hips, shoulders, head, limb lengths. */
const HIP = 0.9;
const SHOULDER = 0.55; // above the hips
const ARM = 0.6;
const LEG = 0.86;
/** Leg swing radians per metre, swing amplitudes for legs and arms. */
const STRIDE = 4.2;
const LEG_SWING = 0.6;
const ARM_SWING = 0.45;
/** Sneaking: hips this much lower, leaning this far forward. */
const CROUCH_DROP = 0.32;
const CROUCH_LEAN = 0.3;

/** How long each action plays on the partner's body. */
const ACTION_MS: Record<PlayerAction, number> = {
  attack: 320,
  shoot: 420,
  chop: 380,
  mine: 420,
  pick: 360,
  eat: 800,
  dodge: DODGE_MS,
  jump: (2 * JUMP_SPEED * 1000) / GRAVITY,
  wave: 1200,
  point: 1200,
};

/** Arms and posture for one moment of an action: shoulder pitch (+ = forward/up) and roll. */
interface Limbs {
  rightX: number;
  rightZ: number;
  leftX: number;
  leftZ: number;
  /** Lean forward (+) at the hips; extra height (jump); full-body roll (dodge). */
  lean: number;
  lift: number;
  roll: number;
}
const REST: Limbs = { rightX: 0, rightZ: 0, leftX: 0, leftZ: 0, lean: 0, lift: 0, roll: 0 };
const bump = (t: number) => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);

function actionPose(action: PlayerAction, t: number, weapon: WeaponId): Limbs {
  switch (action) {
    case 'attack':
      return weapon === 'spear'
        ? { ...REST, rightX: 1.45 * bump(t), leftX: 0.9 * bump(t), lean: 0.15 * bump(t) }
        : { ...REST, rightX: 1.55 * bump(t * 1.2), lean: 0.1 * bump(t) };
    case 'shoot': {
      const hold = bump(t);
      return { ...REST, rightX: 1.35 * hold, leftX: 1.55 * hold, rightZ: -0.25 * hold };
    }
    case 'chop':
    case 'mine': {
      // Raise over the head, then bring it down hard.
      const up = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
      return { ...REST, rightX: 2.7 * up + (t > 0.45 ? 0.5 * bump((t - 0.45) / 0.55) : 0) };
    }
    case 'pick':
      return { ...REST, rightX: 1.0 * bump(t), lean: 0.35 * bump(t) };
    case 'eat':
      return { ...REST, rightX: 2.3 * bump(t), rightZ: -0.5 * bump(t) };
    case 'wave':
      return { ...REST, rightZ: 2.6 * bump(t) + Math.sin(t * Math.PI * 6) * 0.35 * bump(t) };
    case 'point':
      return { ...REST, rightX: 1.55 * bump(t) };
    case 'jump': {
      const s = (t * ACTION_MS.jump) / 1000;
      const lift = Math.max(0, JUMP_SPEED * s - 0.5 * GRAVITY * s * s);
      return { ...REST, lift, rightZ: 0.4 * bump(t), leftZ: -0.4 * bump(t) };
    }
    case 'dodge':
      return { ...REST, roll: -Math.PI * 2 * (t * t * (3 - 2 * t)), lift: -0.4 * bump(t) };
  }
}

interface Props {
  room: Room<HomeState>;
  sessionId: string;
  name: string;
  slot: number;
  connected: boolean;
  sleeping: boolean;
  downed: boolean;
  level: number;
  holding: WeaponId;
  /** Worn item ids in EQUIP_SLOTS order, comma-joined (a string, so React compares it cheaply). */
  wear: string;
}

/** Worn gear on the torso (Phase 14): a vest or coat, a bag on the back. Cap and boots ride the head and legs. */
function Gear({
  wear,
  mats,
}: {
  wear: string;
  mats: Record<'leather' | 'fur' | 'boot' | 'bag', MeshStandardMaterial>;
}) {
  const [, body, , back] = wear.split(',');
  return (
    <>
      {body === 'leather_armor' && (
        <mesh position-y={0.36} material={mats.leather}>
          <boxGeometry args={[0.54, 0.5, 0.34]} />
        </mesh>
      )}
      {body === 'bear_coat' && (
        <mesh position-y={0.32} material={mats.fur}>
          <boxGeometry args={[0.58, 0.64, 0.38]} />
        </mesh>
      )}
      {back && (
        <mesh
          position={[0, 0.36, back === 'big_backpack' ? 0.3 : 0.22]}
          material={mats.bag}
          scale={back === 'big_backpack' ? 1.35 : 0.85}
        >
          <boxGeometry args={[0.36, 0.42, 0.18]} />
        </mesh>
      )}
    </>
  );
}

/**
 * The partner's body: torso, head, arms and legs on pivots. Reads synced state every frame,
 * smooths toward it, walks with the distance covered and acts out each announced action
 * (PlayerState.action / actionSeq).
 */
export function RemotePlayer({
  room,
  sessionId,
  name,
  slot,
  connected,
  sleeping,
  downed,
  level,
  holding,
  wear,
}: Props) {
  const body = useRef<Group>(null);
  const pose = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const legs = useRef<(Group | null)[]>([]);
  const tag = useRef<Group>(null);
  const anim = useRef({
    placed: false,
    phase: 0,
    walk: 0,
    crouch: 0,
    seq: -1,
    action: '',
    at: -1e9,
  });
  const color = playerColor(slot);

  // One material per part, shared by both sides; fades out while they reconnect.
  const mats = useMemo(
    () => ({
      cloth: new MeshStandardMaterial({ color, flatShading: true }),
      skin: new MeshStandardMaterial({ color: PALETTE.skin, flatShading: true }),
      pants: new MeshStandardMaterial({ color: PALETTE.pants, flatShading: true }),
      leather: new MeshStandardMaterial({ color: PALETTE.deerDark, flatShading: true }),
      fur: new MeshStandardMaterial({ color: PALETTE.bear, flatShading: true }),
      boot: new MeshStandardMaterial({ color: PALETTE.woodDark, flatShading: true }),
      bag: new MeshStandardMaterial({ color: PALETTE.cacheWood, flatShading: true }),
    }),
    [color],
  );
  useEffect(() => {
    for (const m of Object.values(mats)) {
      m.transparent = !connected;
      m.opacity = connected ? 1 : 0.35;
    }
  }, [mats, connected]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(({ camera }, rawDt) => {
    const state = room.state.players.get(sessionId);
    if (!state || !body.current || !pose.current || !head.current || !tag.current) return;
    const g = body.current;
    const a = anim.current;
    const now = performance.now();

    if (!a.placed) {
      g.position.set(state.x, 0, state.z);
      g.rotation.y = state.yaw;
      a.placed = true;
    }
    // A new action (the counter changes even when it's the same one again).
    if (state.actionSeq !== a.seq) {
      if (a.seq !== -1) {
        a.action = state.action;
        a.at = now;
      }
      a.seq = state.actionSeq;
    }

    const dt = Math.min(rawDt, MAX_FRAME_DT);
    const asleep = state.sleeping;
    const down = state.downed;
    const targetZ = asleep ? state.z + SLEEP_FEET_OFFSET : state.z;
    const prevX = g.position.x;
    const prevZ = g.position.z;
    g.position.x = MathUtils.damp(g.position.x, state.x, REMOTE_SMOOTHING, dt);
    g.position.z = MathUtils.damp(g.position.z, targetZ, REMOTE_SMOOTHING, dt);
    const ground = terrainHeight(g.position.x, g.position.z);
    g.position.y = MathUtils.damp(
      g.position.y,
      asleep ? SLEEP_HEIGHT : down ? ground + DOWNED_HEIGHT : ground,
      REMOTE_SMOOTHING,
      dt,
    );
    // The name tag stays upright above wherever the body is (it doesn't tip over with it).
    tag.current.position.set(
      g.position.x,
      ground + (asleep || down ? TAG_LOW : TAG_HIGH),
      g.position.z,
    );
    // Right next to them the tag would fill the screen; the [E] prompt says it all.
    tag.current.visible = camera.position.distanceTo(tag.current.position) > TAG_HIDE_DISTANCE;
    // Downed: slumped on the ground, tipped forward.
    g.rotation.x = MathUtils.damp(
      g.rotation.x,
      asleep ? SLEEP_TILT : down ? DOWNED_TILT : 0,
      REMOTE_SMOOTHING,
      dt,
    );
    const t = 1 - Math.exp(-REMOTE_SMOOTHING * dt);
    g.rotation.y += angleDelta(g.rotation.y, asleep ? 0 : state.yaw) * t;
    head.current.rotation.x = MathUtils.lerp(head.current.rotation.x, state.pitch, t);

    // --- walk cycle from the distance actually covered ---
    const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ);
    const still = asleep || down;
    a.walk = MathUtils.damp(
      a.walk,
      still ? 0 : Math.min(1.5, moved / (PLAYER_WALK_SPEED * dt + 1e-6)),
      10,
      dt,
    );
    a.phase += moved * STRIDE;
    const swing = Math.sin(a.phase);

    // --- action on top of the walk ---
    const elapsed = now - a.at;
    const action = a.action as PlayerAction | '';
    const playing = action !== '' && !still && elapsed < ACTION_MS[action];
    const p = playing ? actionPose(action, elapsed / ACTION_MS[action], holding) : REST;
    const [left, right] = arms.current;
    const [legL, legR] = legs.current;
    if (right) right.rotation.set(p.rightX || -swing * ARM_SWING * a.walk, 0, -p.rightZ);
    if (left) left.rotation.set(p.leftX || swing * ARM_SWING * a.walk, 0, -p.leftZ);
    const tuck = action === 'jump' && playing ? 0.5 : 0;
    if (legL) legL.rotation.x = swing * LEG_SWING * a.walk + tuck;
    if (legR) legR.rotation.x = -swing * LEG_SWING * a.walk - tuck;
    a.crouch = MathUtils.damp(a.crouch, state.crouching && !still ? 1 : 0, 10, dt);
    pose.current.rotation.x = p.roll - p.lean - a.crouch * CROUCH_LEAN;
    pose.current.position.y = HIP + p.lift - a.crouch * CROUCH_DROP;
  });

  return (
    <>
      <group ref={body}>
        {/* Everything pivots at the hips, so a lean or a roll turns around the middle. */}
        <group ref={pose} position-y={HIP}>
          <mesh position-y={0.33} material={mats.cloth}>
            <boxGeometry args={[0.5, 0.66, 0.3]} />
          </mesh>
          <Gear wear={wear} mats={mats} />
          {[-1, 1].map((side, i) => (
            <group
              key={`arm${side}`}
              position={[side * 0.33, SHOULDER, 0]}
              ref={(g) => {
                arms.current[i] = g;
              }}
            >
              <mesh position-y={-ARM / 2} material={mats.cloth}>
                <boxGeometry args={[0.13, ARM, 0.13]} />
              </mesh>
              <group position-y={-ARM}>
                <mesh material={mats.skin}>
                  <boxGeometry args={[0.11, 0.11, 0.11]} />
                </mesh>
                {/* What they hold, in the right hand */}
                {side === 1 && (holding === 'spear' || holding === 'antler_spear') && (
                  <SpearModel />
                )}
                {side === 1 && holding === 'bow' && (
                  <group rotation-z={-0.3} scale={0.8}>
                    <BowModel />
                  </group>
                )}
              </group>
            </group>
          ))}
          {[-1, 1].map((side, i) => (
            <group
              key={`leg${side}`}
              position-x={side * 0.13}
              ref={(g) => {
                legs.current[i] = g;
              }}
            >
              <mesh position-y={-LEG / 2} material={mats.pants}>
                <boxGeometry args={[0.18, LEG, 0.2]} />
              </mesh>
              {wear.split(',')[2] === 'soft_boots' && (
                <mesh position={[0, -LEG + 0.1, -0.02]} material={mats.boot}>
                  <boxGeometry args={[0.22, 0.22, 0.26]} />
                </mesh>
              )}
            </group>
          ))}
          <group ref={head} position-y={0.7}>
            <mesh material={mats.skin}>
              <boxGeometry args={[0.42, 0.38, 0.42]} />
            </mesh>
            <mesh position={[0, 0.04, -0.215]}>
              <boxGeometry args={[0.3, 0.1, 0.02]} />
              <meshStandardMaterial color="#2a3430" />
            </mesh>
            {wear.split(',')[0] === 'leather_cap' && (
              <group position-y={0.23}>
                <mesh material={mats.leather}>
                  <boxGeometry args={[0.46, 0.12, 0.46]} />
                </mesh>
                <mesh position={[0, -0.05, -0.28]} material={mats.leather}>
                  <boxGeometry args={[0.4, 0.03, 0.14]} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>
      <group ref={tag}>
        <NameTag
          y={0}
          text={
            !connected
              ? `${name} (đang kết nối lại…)`
              : downed
                ? `${name} — BỊ GỤC! Giữ E`
                : sleeping
                  ? `${name} 💤`
                  : `${name} · Cấp ${level}`
          }
        />
      </group>
    </>
  );
}
