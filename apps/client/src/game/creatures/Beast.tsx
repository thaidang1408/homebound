import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import type { Room } from '@colyseus/sdk';
import {
  CREATURES,
  CreatureMode,
  terrainHeight,
  type CreatureKind,
  type HomeState,
} from '@homebound/shared';
import { MAX_FRAME_DT, REMOTE_SMOOTHING } from '../../config/controls';
import { playGruntAt, playThudAt } from '../../audio/sounds';
import { angleDelta } from '../angles';
import { emitBurst } from '../fx/Particles';
import { PALETTE } from '../world/palette';

const FLASH_MS = 160;
const LUNGE_MS = 180;
const LUNGE_DISTANCE = 0.25;
/** Leg swing radians per metre walked. */
const STRIDE = 7;
const HEALTH_BAR_WIDTH = 0.8;
/** Idle sniffing: how often (ms per cycle) and how deep the head dips. */
const SNIFF_MS = 900;
const SNIFF_DIP = 0.5;
/** Coiling before a strike, and the squash of a hit. */
const COIL = 0.14;
const HIT_SQUASH = 0.18;
/** Closer than this the world bar would cover the crosshair; the HUD prompt shows health instead. */
const HEALTH_BAR_MIN_DISTANCE = 2.5;

type Vec3 = readonly [number, number, number];

/** What a kind looks like: primitive proportions and colors (the model is data, like the AI). */
interface Look {
  fur: string;
  dark: string;
  snoutColor: string;
  body: Vec3;
  bodyY: number;
  /** A darker ridge along the back (boar mane). */
  ridge: boolean;
  /** Hip height = leg length. */
  hip: number;
  legWidth: number;
  /** Hip offsets; front legs at −Z. */
  legX: number;
  legZ: number;
  head: Vec3;
  /** Neck position (y, z) of the head group. */
  headAt: readonly [number, number];
  snout: Vec3;
  tusks: boolean;
  ears: 'flap' | 'point' | 'long' | 'round';
  /** Branching antlers on the head (deer). */
  antlers: boolean;
  /** A long tail (wolf) or a white puff (deer, rabbit). */
  tail: boolean;
  puffTail: boolean;
  /** Eyes that catch the light at night. */
  glowEyes: boolean;
  barY: number;
}

const LOOKS: Record<CreatureKind, Look> = {
  boar: {
    fur: PALETTE.boar,
    dark: PALETTE.boarDark,
    snoutColor: PALETTE.snout,
    body: [0.7, 0.55, 1.1],
    bodyY: 0.55,
    ridge: true,
    hip: 0.36,
    legWidth: 0.14,
    legX: 0.22,
    legZ: 0.37,
    head: [0.5, 0.44, 0.42],
    headAt: [0.6, -0.55],
    snout: [0.28, 0.22, 0.16],
    tusks: true,
    ears: 'flap',
    antlers: false,
    tail: false,
    puffTail: false,
    glowEyes: false,
    barY: 1.35,
  },
  wolf: {
    fur: PALETTE.wolf,
    dark: PALETTE.wolfDark,
    snoutColor: PALETTE.wolfDark,
    body: [0.42, 0.42, 1.05],
    bodyY: 0.74,
    ridge: false,
    hip: 0.56,
    legWidth: 0.1,
    legX: 0.14,
    legZ: 0.38,
    head: [0.34, 0.32, 0.36],
    headAt: [0.92, -0.58],
    snout: [0.18, 0.15, 0.26],
    tusks: false,
    ears: 'point',
    antlers: false,
    tail: true,
    puffTail: false,
    glowEyes: true,
    barY: 1.45,
  },
  deer: {
    fur: PALETTE.deer,
    dark: PALETTE.deerDark,
    snoutColor: PALETTE.deerNose,
    body: [0.42, 0.48, 1.0],
    bodyY: 0.98,
    ridge: false,
    hip: 0.78,
    legWidth: 0.08,
    legX: 0.14,
    legZ: 0.36,
    head: [0.26, 0.28, 0.34],
    headAt: [1.38, -0.55],
    snout: [0.14, 0.13, 0.18],
    tusks: false,
    ears: 'point',
    antlers: true,
    tail: false,
    puffTail: true,
    glowEyes: false,
    barY: 2.05,
  },
  rabbit: {
    fur: PALETTE.rabbit,
    dark: PALETTE.rabbitDark,
    snoutColor: PALETTE.rabbitNose,
    body: [0.24, 0.22, 0.36],
    bodyY: 0.22,
    ridge: false,
    hip: 0.12,
    legWidth: 0.07,
    legX: 0.08,
    legZ: 0.12,
    head: [0.18, 0.17, 0.18],
    headAt: [0.34, -0.2],
    snout: [0.06, 0.05, 0.04],
    tusks: false,
    ears: 'long',
    antlers: false,
    tail: false,
    puffTail: true,
    glowEyes: false,
    barY: 0.75,
  },
  bear: {
    fur: PALETTE.bear,
    dark: PALETTE.bearDark,
    snoutColor: PALETTE.bearSnout,
    body: [0.95, 0.85, 1.6],
    bodyY: 0.98,
    ridge: true,
    hip: 0.6,
    legWidth: 0.26,
    legX: 0.33,
    legZ: 0.55,
    head: [0.6, 0.55, 0.55],
    headAt: [1.1, -0.85],
    snout: [0.3, 0.24, 0.22],
    tusks: false,
    ears: 'round',
    antlers: false,
    tail: false,
    puffTail: false,
    glowEyes: false,
    barY: 2.1,
  },
};

/**
 * A low-poly four-legged creature driven by synced state. Reads the server state every frame,
 * smooths toward it and acts out its mode: trot, alert, wind-up and lunge, flinch, keel over.
 */
export function Beast({
  room,
  id,
  kind,
}: {
  room: Room<HomeState>;
  id: string;
  kind: CreatureKind;
}) {
  const def = CREATURES[kind];
  const look = LOOKS[kind];
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const legRefs = useRef<(Group | null)[]>([]);
  const bar = useRef<Group>(null);
  const barFill = useRef<Mesh>(null);
  const torsoSkin = useRef<MeshStandardMaterial>(null);
  const headSkin = useRef<MeshStandardMaterial>(null);
  const anim = useRef({ placed: false, phase: 0, mode: '', modeAt: 0, health: -1, flashAt: -1e9 });
  // Each creature sniffs on its own beat.
  const seed = useMemo(() => [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0), [id]);

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
      // Voice the moments that matter: it noticed you, it's about to strike, it fell.
      if (a.mode && (c.mode === CreatureMode.Alert || c.mode === CreatureMode.Attack)) {
        playGruntAt(kind, c.x, c.z);
      } else if (a.mode && c.mode === CreatureMode.Dead) {
        playThudAt(c.x, c.z);
        emitBurst('dust', c.x, terrainHeight(c.x, c.z) + 0.2, c.z);
      }
      a.mode = c.mode;
      a.modeAt = now;
    }
    if (a.health >= 0 && c.health < a.health) {
      a.flashAt = now;
      emitBurst('hit', g.position.x, g.position.y + look.bodyY, g.position.z);
    }
    a.health = c.health;
    const inMode = now - a.modeAt;

    // --- position and heading ---
    if (!a.placed) {
      g.position.set(c.x, terrainHeight(c.x, c.z), c.z);
      // Yaw last, so rearing (X) and keeling over (Z) happen in the creature's own frame.
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
    const swing = Math.min(1, moved / (def.walkSpeed * dt + 1e-6)) * 0.6;
    legRefs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = Math.sin(a.phase + (i % 2 === 0 ? 0 : Math.PI)) * swing;
    });

    // --- mode poses ---
    const dead = c.mode === CreatureMode.Dead;
    let pitch = 0; // + = rear back
    let lunge = 0;
    let headPitch = 0;
    let hop = Math.abs(Math.sin(a.phase)) * 0.04;
    let coil = 0;
    const calm = c.mode === CreatureMode.Idle || c.mode === CreatureMode.Patrol;
    if (calm && moved < 0.002) {
      // Standing still: now and then the head dips to sniff the grass.
      headPitch = -SNIFF_DIP * Math.max(0, Math.sin(now / SNIFF_MS + seed)) ** 6;
    }
    if (c.mode === CreatureMode.Alert) {
      headPitch = 0.4; // head up: "it noticed you"
      hop = Math.abs(Math.sin(inMode / 90)) * 0.08;
    } else if (c.mode === CreatureMode.Attack) {
      if (inMode < def.attackWindupMs) {
        pitch = 0.22 * (inMode / def.attackWindupMs); // the tell: rearing back
        coil = COIL * (inMode / def.attackWindupMs); // …and coiling up
        headPitch = -0.2;
      } else if (inMode < def.attackWindupMs + LUNGE_MS) {
        lunge = Math.sin(((inMode - def.attackWindupMs) / LUNGE_MS) * Math.PI) * LUNGE_DISTANCE;
        headPitch = -0.35;
      }
    } else if (c.mode === CreatureMode.Hurt) {
      pitch = 0.15;
    }
    b.rotation.x = MathUtils.damp(b.rotation.x, dead ? 0 : -pitch, 18, dt);
    b.rotation.z = MathUtils.damp(b.rotation.z, dead ? Math.PI / 2 : 0, 8, dt);
    // Keeled over around its feet the torso centre sits at ground level: lift it to rest on its side.
    const deadY = look.body[0] / 2 - 0.05;
    b.position.y = MathUtils.damp(b.position.y, dead ? deadY : hop, 12, dt);
    // Lunge forward along the facing direction (−Z in body space).
    b.position.x = -Math.sin(b.rotation.y) * lunge;
    b.position.z = -Math.cos(b.rotation.y) * lunge;
    head.current.rotation.x = MathUtils.damp(head.current.rotation.x, headPitch, 14, dt);

    // --- hit flash and squash ---
    const flash = Math.max(0, 1 - (now - a.flashAt) / FLASH_MS);
    const squash = dead ? 0 : coil + flash * HIT_SQUASH;
    b.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    if (torsoSkin.current) torsoSkin.current.emissiveIntensity = flash * 1.4;
    if (headSkin.current) headSkin.current.emissiveIntensity = flash * 1.4;

    // --- health bar: only once hurt, always facing the camera ---
    const share = c.health / def.maxHealth;
    const near = camera.position.distanceTo(g.position) < HEALTH_BAR_MIN_DISTANCE;
    bar.current.visible = !dead && share < 1 && !near;
    bar.current.quaternion.copy(camera.quaternion);
    barFill.current.scale.x = Math.max(0.001, share);
    barFill.current.position.x = (-(1 - share) * HEALTH_BAR_WIDTH) / 2;
  });

  const [bw, bh, bl] = look.body;
  const [hw, hh, hl] = look.head;
  const [sw, sh, sl] = look.snout;
  const legs = [
    [-look.legX, -look.legZ],
    [look.legX, -look.legZ],
    [-look.legX, look.legZ],
    [look.legX, look.legZ],
  ] as const;

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh position={[0, look.bodyY, 0]}>
          <boxGeometry args={[bw, bh, bl]} />
          <meshStandardMaterial
            ref={torsoSkin}
            color={look.fur}
            emissive={PALETTE.hurtFlash}
            emissiveIntensity={0}
            flatShading
          />
        </mesh>
        {look.ridge && (
          <mesh position={[0, look.bodyY + bh / 2 + 0.04, 0.05]}>
            <boxGeometry args={[bw * 0.32, 0.12, bl * 0.86]} />
            <meshStandardMaterial color={look.dark} flatShading />
          </mesh>
        )}
        {look.puffTail && (
          <mesh position={[0, look.bodyY + bh * 0.2, bl / 2 + 0.04]}>
            <icosahedronGeometry args={[Math.max(0.06, bw * 0.22), 0]} />
            <meshStandardMaterial color={PALETTE.puffTail} flatShading />
          </mesh>
        )}
        {look.tail && (
          <mesh position={[0, look.bodyY + 0.08, bl / 2 + 0.2]} rotation-x={-0.9}>
            <coneGeometry args={[0.07, 0.5, 4]} />
            <meshStandardMaterial color={look.dark} flatShading />
          </mesh>
        )}
        {/* head looks toward −Z */}
        <group ref={head} position={[0, look.headAt[0], look.headAt[1]]}>
          <mesh position={[0, 0, -hl / 2 + 0.03]}>
            <boxGeometry args={[hw, hh, hl]} />
            <meshStandardMaterial
              ref={headSkin}
              color={look.fur}
              emissive={PALETTE.hurtFlash}
              emissiveIntensity={0}
              flatShading
            />
          </mesh>
          <mesh position={[0, -hh * 0.16, -hl - sl / 2 + 0.06]}>
            <boxGeometry args={[sw, sh, sl]} />
            <meshStandardMaterial color={look.snoutColor} flatShading />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              {look.tusks && (
                <mesh position={[side * 0.13, -0.08, -0.5]} rotation={[-0.5, 0, side * -0.3]}>
                  <coneGeometry args={[0.035, 0.18, 4]} />
                  <meshStandardMaterial color={PALETTE.tusk} flatShading />
                </mesh>
              )}
              <mesh position={[side * hw * 0.3, hh * 0.22, -hl + 0.02]}>
                <boxGeometry args={[0.06, 0.05, 0.02]} />
                {look.glowEyes ? (
                  <meshBasicMaterial color={PALETTE.wolfEye} />
                ) : (
                  <meshStandardMaterial color={PALETTE.eye} />
                )}
              </mesh>
              {look.ears === 'flap' && (
                <mesh position={[side * 0.19, 0.26, -0.08]} rotation={[0.3, 0, side * 0.4]}>
                  <boxGeometry args={[0.1, 0.16, 0.05]} />
                  <meshStandardMaterial color={look.dark} flatShading />
                </mesh>
              )}
              {look.ears === 'point' && (
                <mesh position={[side * hw * 0.32, hh / 2 + 0.08, -0.06]}>
                  <coneGeometry args={[0.06, 0.18, 4]} />
                  <meshStandardMaterial color={look.dark} flatShading />
                </mesh>
              )}
              {look.ears === 'long' && (
                <mesh position={[side * hw * 0.22, hh / 2 + 0.13, 0]} rotation-z={side * -0.15}>
                  <boxGeometry args={[0.045, 0.26, 0.035]} />
                  <meshStandardMaterial color={look.fur} flatShading />
                </mesh>
              )}
              {look.ears === 'round' && (
                <mesh position={[side * hw * 0.38, hh / 2, -0.05]}>
                  <boxGeometry args={[0.13, 0.13, 0.07]} />
                  <meshStandardMaterial color={look.dark} flatShading />
                </mesh>
              )}
              {look.antlers && (
                <group position={[side * hw * 0.25, hh / 2, -0.1]} rotation-z={side * -0.35}>
                  <mesh position-y={0.2}>
                    <cylinderGeometry args={[0.018, 0.025, 0.4, 4]} />
                    <meshStandardMaterial color={PALETTE.antler} flatShading />
                  </mesh>
                  <mesh position={[side * 0.07, 0.3, -0.06]} rotation={[-0.6, 0, side * -0.7]}>
                    <coneGeometry args={[0.018, 0.2, 4]} />
                    <meshStandardMaterial color={PALETTE.antler} flatShading />
                  </mesh>
                  <mesh position={[0, 0.42, 0.04]} rotation-x={0.5}>
                    <coneGeometry args={[0.016, 0.16, 4]} />
                    <meshStandardMaterial color={PALETTE.antler} flatShading />
                  </mesh>
                </group>
              )}
            </group>
          ))}
        </group>
        {/* legs pivot at the hip */}
        {legs.map(([x, z], i) => (
          <group
            key={i}
            position={[x, look.hip, z]}
            ref={(leg) => {
              legRefs.current[i] = leg;
            }}
          >
            <mesh position={[0, -look.hip / 2, 0]}>
              <boxGeometry args={[look.legWidth, look.hip, look.legWidth]} />
              <meshStandardMaterial color={look.dark} flatShading />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={bar} position={[0, look.barY, 0]} visible={false}>
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
