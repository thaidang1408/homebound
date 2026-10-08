import type { Group, Object3D } from 'three';
import type { PetKind } from '@homebound/shared';
import { PALETTE } from '../world/palette';

/**
 * Low-poly fantasy pets built from primitives (cute silhouettes, big heads, no realism). Every
 * model faces −Z and names the parts that animate (see findRig); Pets.tsx moves them.
 */

export interface Rig {
  /** Pivot at the hip; swung while walking. */
  legs: Object3D[];
  /** Pivot at the shoulder; flapped (dragon) or bobbed (ghost arms, little arms). */
  wings: Object3D[];
  tail: Object3D | undefined;
  head: Object3D | undefined;
}

/** Finds a model's moving parts by name (`leg-0`, `wing-1`, `tail`, `head`) once it's mounted. */
export function findRig(model: Group): Rig {
  const parts = (prefix: string) =>
    [0, 1, 2, 3].flatMap((i) => model.getObjectByName(`${prefix}-${i}`) ?? []);
  return {
    legs: parts('leg'),
    wings: parts('wing'),
    tail: model.getObjectByName('tail'),
    head: model.getObjectByName('head'),
  };
}

/** Height of the name tag above the ground, per kind. */
export const TAG_HEIGHT: Record<PetKind | 'egg', number> = {
  dragon: 1.25,
  ghost: 1.5,
  dino: 1.3,
  unicorn: 1.45,
  alien: 1.3,
  egg: 0.8,
};

function Mat({ color, glow = 0 }: { color: string; glow?: number }) {
  return (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} flatShading />
  );
}

function Eyes({ y, z, gap, size = 0.06 }: { y: number; z: number; gap: number; size?: number }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * gap, y, z]}>
          <boxGeometry args={[size, size * 1.3, 0.02]} />
          <meshStandardMaterial color={PALETTE.eye} />
        </mesh>
      ))}
    </>
  );
}

function Leg({
  i,
  at,
  length,
  width,
  color,
}: {
  i: number;
  at: readonly [number, number, number];
  length: number;
  width: number;
  color: string;
}) {
  return (
    <group position={at} name={`leg-${i}`}>
      <mesh position-y={-length / 2}>
        <boxGeometry args={[width, length, width]} />
        <Mat color={color} />
      </mesh>
    </group>
  );
}

function Dragon() {
  return (
    <>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.42, 0.36, 0.6]} />
        <Mat color={PALETTE.dragon} />
      </mesh>
      <mesh position={[0, 0.36, -0.05]}>
        <boxGeometry args={[0.3, 0.26, 0.5]} />
        <Mat color={PALETTE.dragonBelly} />
      </mesh>
      <group position={[0, 0.7, -0.3]} name="head">
        <mesh position={[0, 0.05, -0.08]}>
          <boxGeometry args={[0.4, 0.34, 0.36]} />
          <Mat color={PALETTE.dragon} />
        </mesh>
        <mesh position={[0, -0.02, -0.3]}>
          <boxGeometry args={[0.24, 0.16, 0.16]} />
          <Mat color={PALETTE.dragon} />
        </mesh>
        <Eyes y={0.1} z={-0.265} gap={0.1} size={0.07} />
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.12, 0.3, 0]} rotation={[-0.4, 0, side * -0.3]}>
            <coneGeometry args={[0.045, 0.2, 4]} />
            <Mat color={PALETTE.dragonBelly} />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 0.2, 0.58, 0.02]} name={`wing-${i}`}>
          <mesh position={[side * 0.24, 0.08, 0.04]} rotation-z={side * 0.35}>
            <boxGeometry args={[0.46, 0.03, 0.34]} />
            <Mat color={PALETTE.dragonWing} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.4, 0.3]} name="tail">
        <mesh position={[0, -0.04, 0.24]} rotation-x={Math.PI / 2 + 0.3}>
          <coneGeometry args={[0.1, 0.5, 5]} />
          <Mat color={PALETTE.dragon} />
        </mesh>
      </group>
      {(
        [
          [-0.14, 0.24, -0.2],
          [0.14, 0.24, -0.2],
          [-0.14, 0.24, 0.2],
          [0.14, 0.24, 0.2],
        ] as const
      ).map((at, i) => (
        <Leg key={i} i={i} at={at} length={0.24} width={0.12} color={PALETTE.dragon} />
      ))}
    </>
  );
}

function Ghost({ glow }: { glow: number }) {
  return (
    <>
      <group name="head" position-y={0.9}>
        <mesh>
          <icosahedronGeometry args={[0.32, 1]} />
          <meshStandardMaterial
            color={PALETTE.ghost}
            emissive={PALETTE.ghostGlow}
            emissiveIntensity={glow}
            transparent
            opacity={0.88}
            flatShading
          />
        </mesh>
        <Eyes y={0.05} z={-0.29} gap={0.1} size={0.08} />
        <mesh position={[0, -0.1, -0.29]}>
          <boxGeometry args={[0.08, 0.05, 0.02]} />
          <meshStandardMaterial color={PALETTE.eye} />
        </mesh>
      </group>
      <group name="tail" position-y={0.62}>
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.3, 0.42, 7, 1, true]} />
          <meshStandardMaterial
            color={PALETTE.ghost}
            emissive={PALETTE.ghostGlow}
            emissiveIntensity={glow}
            transparent
            opacity={0.8}
            flatShading
          />
        </mesh>
      </group>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 0.3, 0.8, 0]} name={`wing-${i}`}>
          <mesh position-x={side * 0.08}>
            <boxGeometry args={[0.16, 0.08, 0.08]} />
            <meshStandardMaterial color={PALETTE.ghost} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Dino() {
  return (
    <>
      <mesh position={[0, 0.55, 0.05]} rotation-x={-0.25}>
        <boxGeometry args={[0.4, 0.46, 0.55]} />
        <Mat color={PALETTE.dino} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.82 - i * 0.05, 0.12 + i * 0.16]} rotation-x={-0.3}>
          <coneGeometry args={[0.06, 0.14, 4]} />
          <Mat color={PALETTE.dinoSpike} />
        </mesh>
      ))}
      <group position={[0, 0.92, -0.2]} name="head">
        <mesh position={[0, 0.06, -0.1]}>
          <boxGeometry args={[0.42, 0.36, 0.48]} />
          <Mat color={PALETTE.dino} />
        </mesh>
        <mesh position={[0, -0.1, -0.16]}>
          <boxGeometry args={[0.36, 0.1, 0.38]} />
          <Mat color={PALETTE.dinoDark} />
        </mesh>
        <Eyes y={0.14} z={-0.345} gap={0.12} size={0.07} />
      </group>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 0.2, 0.62, -0.18]} name={`wing-${i}`}>
          <mesh position={[0, -0.06, -0.04]} rotation-x={0.6}>
            <boxGeometry args={[0.06, 0.14, 0.06]} />
            <Mat color={PALETTE.dinoDark} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.48, 0.3]} name="tail">
        <mesh position={[0, -0.04, 0.26]} rotation-x={Math.PI / 2 + 0.25}>
          <coneGeometry args={[0.15, 0.6, 5]} />
          <Mat color={PALETTE.dino} />
        </mesh>
      </group>
      {[-1, 1].map((side, i) => (
        <Leg
          key={side}
          i={i}
          at={[side * 0.13, 0.34, 0.08]}
          length={0.34}
          width={0.14}
          color={PALETTE.dinoDark}
        />
      ))}
    </>
  );
}

function Unicorn() {
  return (
    <>
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[0.36, 0.34, 0.7]} />
        <Mat color={PALETTE.unicorn} />
      </mesh>
      <group position={[0, 0.88, -0.32]} name="head">
        <mesh position={[0, 0.12, -0.04]} rotation-x={0.35}>
          <boxGeometry args={[0.2, 0.36, 0.2]} />
          <Mat color={PALETTE.unicorn} />
        </mesh>
        <mesh position={[0, 0.3, -0.16]}>
          <boxGeometry args={[0.24, 0.24, 0.34]} />
          <Mat color={PALETTE.unicorn} />
        </mesh>
        <mesh position={[0, 0.52, -0.22]} rotation-x={-0.35}>
          <coneGeometry args={[0.045, 0.3, 5]} />
          <Mat color={PALETTE.unicornHorn} glow={0.35} />
        </mesh>
        <Eyes y={0.34} z={-0.335} gap={0.08} size={0.06} />
        <mesh position={[0, 0.32, 0.04]}>
          <boxGeometry args={[0.08, 0.3, 0.2]} />
          <Mat color={PALETTE.unicornMane} />
        </mesh>
      </group>
      <group position={[0, 0.74, 0.35]} name="tail">
        <mesh position={[0, -0.14, 0.08]} rotation-x={0.4}>
          <boxGeometry args={[0.1, 0.34, 0.1]} />
          <Mat color={PALETTE.unicornMane} />
        </mesh>
      </group>
      {(
        [
          [-0.12, 0.5, -0.25],
          [0.12, 0.5, -0.25],
          [-0.12, 0.5, 0.25],
          [0.12, 0.5, 0.25],
        ] as const
      ).map((at, i) => (
        <Leg key={i} i={i} at={at} length={0.5} width={0.09} color={PALETTE.unicorn} />
      ))}
    </>
  );
}

function Alien() {
  return (
    <>
      {/* a little hover saucer */}
      <group name="tail" position-y={0.28}>
        <mesh>
          <cylinderGeometry args={[0.36, 0.26, 0.1, 10]} />
          <Mat color={PALETTE.saucer} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i / 6) * Math.PI * 2) * 0.32,
              0,
              Math.sin((i / 6) * Math.PI * 2) * 0.32,
            ]}
          >
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshBasicMaterial color={PALETTE.saucerLight} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.22, 0.3, 0.18]} />
        <Mat color={PALETTE.alien} />
      </mesh>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 0.13, 0.6, 0]} name={`wing-${i}`}>
          <mesh position={[side * 0.04, -0.1, 0]}>
            <boxGeometry args={[0.05, 0.22, 0.05]} />
            <Mat color={PALETTE.alien} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.84, 0]} name="head">
        <mesh>
          <icosahedronGeometry args={[0.24, 1]} />
          <Mat color={PALETTE.alien} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.1, 0.02, -0.2]} rotation-z={side * -0.4}>
              <boxGeometry args={[0.12, 0.08, 0.04]} />
              <meshStandardMaterial color={PALETTE.alienEye} />
            </mesh>
            <mesh position={[side * 0.1, 0.32, 0]} rotation-z={side * -0.3}>
              <cylinderGeometry args={[0.012, 0.012, 0.18, 4]} />
              <Mat color={PALETTE.alien} />
            </mesh>
            <mesh position={[side * 0.13, 0.42, 0]}>
              <icosahedronGeometry args={[0.035, 0]} />
              <meshBasicMaterial color={PALETTE.saucerLight} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

/** A glowing speckled egg; Pets.tsx wobbles it more and more as it gets ready to hatch. */
export function Egg() {
  return (
    <group position-y={0.26}>
      <mesh scale={[1, 1.3, 1]}>
        <icosahedronGeometry args={[0.2, 1]} />
        <Mat color={PALETTE.egg} glow={0.25} />
      </mesh>
      {(
        [
          [0.12, 0.08, -0.14],
          [-0.15, -0.04, -0.1],
          [0.05, -0.12, 0.17],
          [-0.06, 0.16, 0.12],
        ] as const
      ).map((at, i) => (
        <mesh key={i} position={at}>
          <icosahedronGeometry args={[0.05, 0]} />
          <Mat color={PALETTE.eggSpot} glow={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function PetModel({ kind, glow }: { kind: PetKind; glow: number }) {
  switch (kind) {
    case 'dragon':
      return <Dragon />;
    case 'ghost':
      return <Ghost glow={glow} />;
    case 'dino':
      return <Dino />;
    case 'unicorn':
      return <Unicorn />;
    case 'alien':
      return <Alien />;
  }
}
