import {
  DOOR_HALF,
  DOORWAYS,
  HOUSE_HALF_DEPTH,
  HOUSE_HALF_WIDTH,
  HOUSE_WALLS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  type Box,
} from '@homebound/shared';
import { Furniture } from './Furniture';
import { PALETTE } from './palette';

const LINTEL_HEIGHT = 0.45;
const ROOF_HEIGHT = 2.2;
const ROOF_OVERHANG = 0.5;

function size(b: Box) {
  return {
    w: b.maxX - b.minX,
    d: b.maxZ - b.minZ,
    x: (b.minX + b.maxX) / 2,
    z: (b.minZ + b.maxZ) / 2,
  };
}

function Wall({ box }: { box: Box }) {
  const { w, d, x, z } = size(box);
  return (
    <mesh position={[x, WALL_HEIGHT / 2, z]}>
      <boxGeometry args={[w, WALL_HEIGHT, d]} />
      <meshStandardMaterial color={PALETTE.wall} flatShading />
    </mesh>
  );
}

/** Beam over a doorway so openings read as doors, not missing wall. */
function Lintel({ x, z }: { x: number; z: number }) {
  // Doorways on the z = const walls span along X.
  const length = DOOR_HALF * 2 + 0.1;
  return (
    <mesh position={[x, WALL_HEIGHT - LINTEL_HEIGHT / 2, z]}>
      <boxGeometry args={[length, LINTEL_HEIGHT, WALL_THICKNESS + 0.04]} />
      <meshStandardMaterial color={PALETTE.wallTrim} flatShading />
    </mesh>
  );
}

const W = HOUSE_HALF_WIDTH;
const D = HOUSE_HALF_DEPTH;

/** Warm lamp in each room makes the house the cosy, safe place (and readable at night later). */
const LAMPS: readonly [number, number][] = [
  [0, 2.5], // living room
  [-3, -2.5], // kitchen
  [3, -2.5], // bedroom
];

export function House() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W * 2, D * 2]} />
        <meshStandardMaterial color={PALETTE.floor} />
      </mesh>
      <mesh position={[0, 0.03, 2.7]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.6, 8]} />
        <meshStandardMaterial color={PALETTE.rug} flatShading />
      </mesh>

      {HOUSE_WALLS.map((box, i) => (
        <Wall key={i} box={box} />
      ))}
      {DOORWAYS.map((d) => (
        <Lintel key={`${d.x},${d.z}`} x={d.x} z={d.z} />
      ))}

      <mesh position={[0, WALL_HEIGHT, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W * 2, D * 2]} />
        <meshStandardMaterial color={PALETTE.ceiling} />
      </mesh>
      {/* Four-sided pyramid roof. The outer group scales AFTER the 45° turn, so the
          diamond-shaped cone base becomes the rectangular house footprint. */}
      <group
        position={[0, WALL_HEIGHT + ROOF_HEIGHT / 2, 0]}
        scale={[(W + ROOF_OVERHANG) / Math.SQRT1_2, 1, (D + ROOF_OVERHANG) / Math.SQRT1_2]}
      >
        <mesh rotation-y={Math.PI / 4}>
          <coneGeometry args={[1, ROOF_HEIGHT, 4]} />
          <meshStandardMaterial color={PALETTE.roof} flatShading />
        </mesh>
      </group>

      {LAMPS.map(([x, z]) => (
        <pointLight
          key={`${x},${z}`}
          position={[x, WALL_HEIGHT - 0.3, z]}
          color={PALETTE.lamp}
          intensity={6}
          distance={9}
          decay={2}
        />
      ))}

      <Furniture />
    </group>
  );
}
