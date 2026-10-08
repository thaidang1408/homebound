import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import type { Room } from '@colyseus/sdk';
import {
  dayPhase,
  isPetKind,
  terrainHeight,
  type HomeState,
  type PetKind,
} from '@homebound/shared';
import { MAX_FRAME_DT, REMOTE_SMOOTHING } from '../../config/controls';
import { playPetAt } from '../../audio/sounds';
import { useSession } from '../../state/session';
import { angleDelta } from '../angles';
import { emitBurst, type BurstKind } from '../fx/Particles';
import { NameTag } from '../player/NameTag';
import { Egg, PetModel, TAG_HEIGHT, findRig, type Rig } from './PetModels';

/** Leg swing radians per metre walked, and how far it swings. */
const STRIDE = 9;
const SWING = 0.7;
/** Ghosts and the alien's saucer float this high, bobbing this much. */
const FLOAT_Y = 0.25;
const FLOAT_BOB = 0.08;
/** Name tags show between these distances: they draw through walls, and up close they'd fill the view. */
const TAG_DISTANCE = 14;
const TAG_MIN_DISTANCE = 3;
/** A happy hop on a pat or a hatch. */
const HOP_MS = 450;
const HOP_HEIGHT = 0.25;
/** The lunge of a fire breath / headbutt. */
const LUNGE_MS = 250;

const BURST: Record<string, BurstKind> = {
  pat: 'hearts',
  fire: 'fire',
  heal: 'sparkle',
  forage: 'sparkle',
  hatch: 'sparkle',
  fetch: 'dust',
};

interface Source {
  x: number;
  z: number;
  yaw: number;
  action?: string;
  actionSeq?: number;
  /** Eggs: 0 → 1. */
  hatch?: number;
}

/**
 * One pet (or egg), from a player's pets or a wild one among the creatures. Smooths toward the
 * synced pose and acts it out: trot or float, flap, wag, hop for a pat, lunge for fire.
 */
function Pet({
  read,
  kind,
  name,
  glow,
  seed,
}: {
  read: () => Source | undefined;
  /** '' = still an egg. */
  kind: PetKind | '';
  /** Shown above it; '' = no tag (wild ones). */
  name: string;
  glow: number;
  seed: number;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const tag = useRef<Group>(null);
  const rig = useRef<Rig | null>(null);
  const anim = useRef({ placed: false, phase: 0, seq: -1, action: '', at: -1e9 });
  const floats = kind === 'ghost' || kind === 'alien';

  useFrame(({ camera, clock }, rawDt) => {
    const s = read();
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    g.visible = !!s;
    if (!s) {
      anim.current.placed = false;
      return;
    }
    const a = anim.current;
    const dt = Math.min(rawDt, MAX_FRAME_DT);
    const now = performance.now();
    const t = clock.elapsedTime + seed;
    if (!a.placed) {
      g.position.set(s.x, terrainHeight(s.x, s.z), s.z);
      b.rotation.y = s.yaw;
      a.placed = true;
      a.seq = s.actionSeq ?? 0;
    }
    if (s.actionSeq !== undefined && s.actionSeq !== a.seq) {
      a.seq = s.actionSeq;
      a.action = s.action ?? '';
      a.at = now;
      const burst = BURST[a.action];
      if (burst) emitBurst(burst, g.position.x, g.position.y + 0.8, g.position.z);
      playPetAt(a.action, g.position.x, g.position.z);
    }

    const prevX = g.position.x;
    const prevZ = g.position.z;
    g.position.x = MathUtils.damp(g.position.x, s.x, REMOTE_SMOOTHING, dt);
    g.position.z = MathUtils.damp(g.position.z, s.z, REMOTE_SMOOTHING, dt);
    g.position.y = terrainHeight(g.position.x, g.position.z);
    b.rotation.y += angleDelta(b.rotation.y, s.yaw) * (1 - Math.exp(-REMOTE_SMOOTHING * dt));
    const moved = Math.hypot(g.position.x - prevX, g.position.z - prevZ);
    a.phase += moved * STRIDE;
    const walking = Math.min(1, moved / (dt * 2 + 1e-6));

    // --- body: hop (pat/hatch), lunge (fire), trot bounce or float bob ---
    const since = now - a.at;
    const hop =
      (a.action === 'pat' || a.action === 'hatch') && since < HOP_MS
        ? Math.sin((since / HOP_MS) * Math.PI) * HOP_HEIGHT
        : 0;
    const lunge =
      a.action === 'fire' && since < LUNGE_MS ? Math.sin((since / LUNGE_MS) * Math.PI) : 0;
    const bounce = floats
      ? FLOAT_Y + Math.sin(t * 2.2) * FLOAT_BOB
      : Math.abs(Math.sin(a.phase)) * 0.06;
    b.position.y = bounce + hop;
    b.position.x = -Math.sin(b.rotation.y) * lunge * 0.2;
    b.position.z = -Math.cos(b.rotation.y) * lunge * 0.2;

    if (kind === '') {
      // The egg wobbles more and more as it gets ready, in little fits.
      const ready = s.hatch ?? 0;
      const fit = Math.max(0, Math.sin(t * 1.3)) ** 4;
      b.rotation.z = Math.sin(t * 18) * (0.04 + ready * 0.3) * fit;
    } else {
      rig.current ??= findRig(b);
      rig.current.legs.forEach((leg, i) => {
        if (leg) leg.rotation.x = Math.sin(a.phase + (i % 2 === 0 ? 0 : Math.PI)) * SWING * walking;
      });
      const flap =
        kind === 'dragon' ? Math.sin(t * (walking > 0.2 ? 14 : 4)) * 0.5 : Math.sin(t * 3) * 0.2;
      rig.current.wings.forEach((wing, i) => {
        if (wing) wing.rotation.z = (i === 0 ? -1 : 1) * flap;
      });
      if (rig.current.tail) {
        rig.current.tail.rotation.y = floats
          ? t * 1.5
          : Math.sin(t * (walking > 0.2 ? 10 : 3)) * 0.35;
      }
      if (rig.current.head) rig.current.head.rotation.x = lunge * -0.4 + Math.sin(t * 1.1) * 0.05;
    }

    if (tag.current) {
      const d = camera.position.distanceTo(g.position);
      tag.current.visible = !!name && d < TAG_DISTANCE && d > TAG_MIN_DISTANCE;
    }
  });

  return (
    <group ref={root}>
      <group ref={body} rotation-order="YXZ">
        {kind === '' ? <Egg /> : <PetModel kind={kind} glow={glow} />}
      </group>
      {name && (
        <group ref={tag}>
          <NameTag text={name} y={TAG_HEIGHT[kind || 'egg']} />
        </group>
      )}
    </group>
  );
}

const seedOf = (id: string) => [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0);

/** Players' pets and eggs. Re-renders with the HUD when one hatches, is named or befriended. */
export function Pets({ room }: { room: Room<HomeState> }) {
  useSession(); // re-render on state changes (roomWatcher bumps the version)
  const glow = dayPhase(room.state.timeOfDay) === 'night' ? 0.9 : 0.25;
  return (
    <>
      {[...room.state.pets.entries()].map(([id, p]) => {
        const kind = isPetKind(p.kind) ? p.kind : '';
        return (
          <Pet
            key={`${id}:${kind}`}
            read={() => room.state.pets.get(id)}
            kind={kind}
            name={kind ? p.name : ''}
            glow={glow}
            seed={seedOf(id)}
          />
        );
      })}
    </>
  );
}

/** A wild pet roaming the world (it's one of the creatures until someone befriends it). */
export function WildPet({ room, id, kind }: { room: Room<HomeState>; id: string; kind: PetKind }) {
  const night = dayPhase(room.state.timeOfDay) === 'night';
  return (
    <Pet
      read={() => {
        const c = room.state.creatures.get(id);
        return c?.present ? c : undefined;
      }}
      kind={kind}
      name=""
      glow={night ? 0.9 : 0.25}
      seed={seedOf(id)}
    />
  );
}
