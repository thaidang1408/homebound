import { FURNITURE, type FurnitureDefinition } from '@homebound/shared';
import { playerColor } from '../player/playerColors';
import { PALETTE } from './palette';
import { Stove } from './Stove';

/** Box helper: size + centre of a piece's footprint. */
function footprint(f: FurnitureDefinition) {
  const { minX, maxX, minZ, maxZ } = f.box;
  return { w: maxX - minX, d: maxZ - minZ, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}

function Block({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}

function Table({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const leg = 0.08;
  const top = 0.08;
  const legs: [number, number][] = [
    [-w / 2 + leg, -d / 2 + leg],
    [w / 2 - leg, -d / 2 + leg],
    [-w / 2 + leg, d / 2 - leg],
    [w / 2 - leg, d / 2 - leg],
  ];
  return (
    <>
      <Block position={[0, h - top / 2, 0]} size={[w, top, d]} color={color} />
      {legs.map(([x, z]) => (
        <Block
          key={`${x},${z}`}
          position={[x, (h - top) / 2, z]}
          size={[leg, h - top, leg]}
          color={PALETTE.woodDark}
        />
      ))}
    </>
  );
}

function Bed({ w, d, h }: { w: number; d: number; h: number }) {
  // Head is at the north (−Z) end. Each half of the blanket wears its sleeper's color.
  return (
    <>
      <Block position={[0, h * 0.3, 0]} size={[w, h * 0.6, d]} color={PALETTE.woodDark} />
      <Block
        position={[0, h * 0.75, 0]}
        size={[w - 0.1, h * 0.3, d - 0.1]}
        color={PALETTE.mattress}
      />
      <Block position={[0, 0.5, -d / 2 + 0.05]} size={[w, 1, 0.1]} color={PALETTE.wood} />
      {[-1, 1].map((side, i) => (
        <group key={side}>
          <Block
            position={[(side * w) / 4, h + 0.02, -d / 2 + 0.35]}
            size={[w / 2 - 0.25, 0.14, 0.4]}
            color={PALETTE.pillow}
          />
          <Block
            position={[(side * w) / 4, h + 0.01, d * 0.12]}
            size={[w / 2 - 0.08, 0.08, d * 0.7]}
            color={playerColor(i + 1)}
          />
        </group>
      ))}
    </>
  );
}

function Chest({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <>
      <Block position={[0, h * 0.4, 0]} size={[w, h * 0.8, d]} color={PALETTE.wood} />
      <Block
        position={[0, h * 0.9, 0]}
        size={[w + 0.04, h * 0.2, d + 0.04]}
        color={PALETTE.woodDark}
      />
      <Block
        position={[0, h * 0.62, d / 2 + 0.01]}
        size={[0.14, 0.18, 0.04]}
        color={PALETTE.ironLight}
      />
    </>
  );
}

function Workbench({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <>
      <Table w={w} d={d} h={h} color={PALETTE.wood} />
      {/* A few tools so it reads as a workbench. */}
      <Block position={[-w * 0.2, h + 0.04, 0]} size={[0.5, 0.06, 0.08]} color={PALETTE.woodDark} />
      <Block
        position={[-w * 0.2 + 0.25, h + 0.07, 0]}
        size={[0.1, 0.12, 0.2]}
        color={PALETTE.iron}
      />
      <Block
        position={[w * 0.22, h + 0.1, -d * 0.2]}
        size={[0.3, 0.2, 0.25]}
        color={PALETTE.ironLight}
      />
    </>
  );
}

function Sofa({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <>
      <Block position={[0, h * 0.25, 0]} size={[w, h * 0.5, d]} color={PALETTE.fabric} />
      <Block
        position={[0, h * 0.65, -d / 2 + 0.12]}
        size={[w, h * 0.7, 0.24]}
        color={PALETTE.fabric}
      />
      {[-1, 1].map((s) => (
        <Block
          key={s}
          position={[(s * (w - 0.2)) / 2, h * 0.45, 0]}
          size={[0.2, h * 0.5, d]}
          color={PALETTE.fabric}
        />
      ))}
    </>
  );
}

function Piece({ f }: { f: FurnitureDefinition }) {
  const { w, d, x, z } = footprint(f);
  const h = f.height;
  let body;
  switch (f.id) {
    case 'stove':
      body = <Stove w={w} d={d} h={h} />;
      break;
    case 'bed':
      body = <Bed w={w} d={d} h={h} />;
      break;
    case 'chest':
      body = <Chest w={w} d={d} h={h} />;
      break;
    case 'workbench':
      body = <Workbench w={w} d={d} h={h} />;
      break;
    case 'sofa':
      body = <Sofa w={w} d={d} h={h} />;
      break;
    default:
      body = <Table w={w} d={d} h={h} color={PALETTE.wood} />;
  }
  return <group position={[x, 0, z]}>{body}</group>;
}

export function Furniture() {
  return (
    <>
      {FURNITURE.map((f) => (
        <Piece key={f.id} f={f} />
      ))}
    </>
  );
}
