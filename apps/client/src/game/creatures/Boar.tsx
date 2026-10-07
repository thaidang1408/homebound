import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import type { Room } from '@colyseus/sdk';
import { CREATURES, CreatureMode, terrainHeight, type HomeState } from '@homebound/shared';
import { MAX_FRAME_DT, REMOTE_SMOOTHING } from '../../config/controls';
import { angleDelta } from '../angles';
import { PALETTE } from '../world/palette';

const DEF = CREATURES.boar;
const FLASH_MS = 160;
const LUNGE_MS = 180;
const LUNGE_DISTANCE = 0.25;
/** Leg swing radians per metre walked. */
const STRIDE = 7;
const HEALTH_BAR_WIDTH = 0.8;
/** Closer than this the world bar would cover the crosshair; the HUD prompt shows health instead. */
const HEALTH_BAR_MIN_DISTANCE = 2.5;
/** Hip positions (x, z); front legs at −Z. */
const LEGS: readonly (readonly [number, number])[] = [
  [-0.22, -0.36],
  [0.22, -0.36],
  [-0.22, 0.38],
  [0.22, 0.38],
];

/**
 * A low-poly boar driven by synced state. Reads the server state every frame, smooths toward it
 * and acts out its mode: trot, snort (alert), wind-up and lunge, flinch, keel over.
 */
export function Boar({ room, id }: { room: Room<HomeState>; id: string }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const bar = useRef<Group>(null);
  const barFill = useRef<Mesh>(null);
  const torsoSkin = useRef<MeshStandardMaterial>(null);
  const headSkin = useRef<MeshStandardMaterial>(null);
  const anim = useRef({ placed: false, phase: 0, mode: '', modeAt: 0, health: -1, flashAt: -1e9 });

  useFrame(({ camera }, rawDt) => {
    const c = room.state.creatures.get(id);
    const g = root.current;
    if (!c || !g || !body.current || !head.current || !bar.current || !barFill.current) return;
    const a = anim.current;
    g.visible = c.present;
    if (!c.present) {
      a.placed = false; // next appearance snaps into place instead of sliding from the carcass
      return;
    }

    const now = performance.now();
    const dt = Math.min(rawDt, MAX_FRAME_DT);
    if (c.mode !== a.mode) {
      a.mode = c.mode;
      a.modeAt = now;
    }
    if (a.health >= 0 && c.health < a.health) a.flashAt = now;
    a.health = c.health;
    const inMode = now - a.modeAt;

    // --- position and heading ---
    if (!a.placed) {
      g.position.set(c.x, terrainHeight(c.x, c.z), c.z);
      // Yaw last, so rearing (X) and keeling over (Z) happen in the boar's own frame.
      body.current.rotation.order = 'YXZ';
      body.current.rotation.y = c.yaw;
      a.placed = true;
    }
    const prevX = g.position.x;
    const prevZ = g.position.z;
    g.position.x = MathUtils.damp(g.position.x, c.x, REMOTE_SMOOTHING, dt);
    g.position.z = MathUtils.damp(g.position.z, c.z, REMOTE_SMOOTHING, dt);
    g.position.y = terrainHeight(g.position.x, g.position.z);
    const t = 1 - Math.exp(-REMOTE_SMOOTHING * dt);
    const b = body.current;
    b.rotation.y += angleDelta(b.rotation.y, c.yaw) * t;

    // --- gait: legs swing with distance travelled ---
    const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ);
    a.phase += moved * STRIDE;
    const swing = Math.min(1, moved / (DEF.walkSpeed * dt + 1e-6)) * 0.6;
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = Math.sin(a.phase + (i % 2 === 0 ? 0 : Math.PI)) * swing;
    });

    // --- mode poses ---
    const dead = c.mode === CreatureMode.Dead;
    let pitch = 0; // + = rear back
    let lunge = 0;
    let headPitch = 0;
    let hop = Math.abs(Math.sin(a.phase)) * 0.04;
    if (c.mode === CreatureMode.Alert) {
      headPitch = 0.4; // snout up: "it noticed you"
      hop = Math.abs(Math.sin(inMode / 90)) * 0.08;
    } else if (c.mode === CreatureMode.Attack) {
      if (inMode < DEF.attackWindupMs) {
        pitch = 0.22 * (inMode / DEF.attackWindupMs); // the tell: rearing back
        headPitch = -0.2;
      } else if (inMode < DEF.attackWindupMs + LUNGE_MS) {
        lunge = Math.sin(((inMode - DEF.attackWindupMs) / LUNGE_MS) * Math.PI) * LUNGE_DISTANCE;
        headPitch = -0.35;
      }
    } else if (c.mode === CreatureMode.Hurt) {
      pitch = 0.15;
    }
    b.rotation.x = MathUtils.damp(b.rotation.x, dead ? 0 : -pitch, 18, dt);
    b.rotation.z = MathUtils.damp(b.rotation.z, dead ? Math.PI / 2 : 0, 8, dt);
    b.position.y = MathUtils.damp(b.position.y, dead ? 0.3 : hop, 12, dt);
    // Lunge forward along the facing direction (−Z in body space).
    b.position.x = -Math.sin(b.rotation.y) * lunge;
    b.position.z = -Math.cos(b.rotation.y) * lunge;
    head.current.rotation.x = MathUtils.damp(head.current.rotation.x, headPitch, 14, dt);

    // --- hit flash ---
    const flash = Math.max(0, 1 - (now - a.flashAt) / FLASH_MS);
    for (const m of [torsoSkin.current, headSkin.current]) if (m) m.emissiveIntensity = flash * 1.4;

    // --- health bar: only once hurt, always facing the camera ---
    const share = c.health / DEF.maxHealth;
    const near = camera.position.distanceTo(g.position) < HEALTH_BAR_MIN_DISTANCE;
    bar.current.visible = !dead && share < 1 && !near;
    bar.current.quaternion.copy(camera.quaternion);
    barFill.current.scale.x = Math.max(0.001, share);
    barFill.current.position.x = (-(1 - share) * HEALTH_BAR_WIDTH) / 2;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* torso + mane */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.7, 0.55, 1.1]} />
          <meshStandardMaterial
            ref={torsoSkin}
            color={PALETTE.boar}
            emissive={PALETTE.hurtFlash}
            emissiveIntensity={0}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.87, 0.05]}>
          <boxGeometry args={[0.22, 0.12, 0.95]} />
          <meshStandardMaterial color={PALETTE.boarDark} flatShading />
        </mesh>
        {/* head looks toward −Z */}
        <group ref={head} position={[0, 0.6, -0.55]}>
          <mesh position={[0, 0, -0.18]}>
            <boxGeometry args={[0.5, 0.44, 0.42]} />
            <meshStandardMaterial
              ref={headSkin}
              color={PALETTE.boar}
              emissive={PALETTE.hurtFlash}
              emissiveIntensity={0}
              flatShading
            />
          </mesh>
          <mesh position={[0, -0.07, -0.45]}>
            <boxGeometry args={[0.28, 0.22, 0.16]} />
            <meshStandardMaterial color={PALETTE.snout} flatShading />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.13, -0.08, -0.5]} rotation={[-0.5, 0, side * -0.3]}>
                <coneGeometry args={[0.035, 0.18, 4]} />
                <meshStandardMaterial color={PALETTE.tusk} flatShading />
              </mesh>
              <mesh position={[side * 0.15, 0.1, -0.4]}>
                <boxGeometry args={[0.06, 0.06, 0.02]} />
                <meshStandardMaterial color={PALETTE.eye} />
              </mesh>
              <mesh position={[side * 0.19, 0.26, -0.08]} rotation={[0.3, 0, side * 0.4]}>
                <boxGeometry args={[0.1, 0.16, 0.05]} />
                <meshStandardMaterial color={PALETTE.boarDark} flatShading />
              </mesh>
            </group>
          ))}
        </group>
        {/* legs pivot at the hip */}
        {LEGS.map(([x, z], i) => (
          <group
            key={i}
            position={[x, 0.36, z]}
            ref={(leg) => {
              legs.current[i] = leg;
            }}
          >
            <mesh position={[0, -0.18, 0]}>
              <boxGeometry args={[0.14, 0.36, 0.14]} />
              <meshStandardMaterial color={PALETTE.boarDark} flatShading />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={bar} position={[0, 1.35, 0]} visible={false}>
        <mesh>
          <planeGeometry args={[HEALTH_BAR_WIDTH + 0.06, 0.12]} />
          <meshBasicMaterial color={PALETTE.healthBack} transparent opacity={0.8} />
        </mesh>
        <mesh ref={barFill} position={[0, 0, 0.001]}>
          <planeGeometry args={[HEALTH_BAR_WIDTH, 0.07]} />
          <meshBasicMaterial color={PALETTE.health} />
        </mesh>
      </group>
    </group>
  );
}
