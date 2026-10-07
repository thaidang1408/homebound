/** Axis-aligned box on the ground plane (y is ignored for movement). */
export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Point {
  x: number;
  z: number;
}

/** Penetration of a circle into a box: the push needed to separate them, or null if clear. */
function penetration(p: Point, radius: number, b: Box): Point | null {
  const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const distSq = dx * dx + dz * dz;

  if (distSq > 0) {
    if (distSq >= radius * radius) return null;
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    return { x: (dx / dist) * push, z: (dz / dist) * push };
  }

  // Center inside the box: leave through the nearest face.
  const exits = [
    { x: b.minX - radius - p.x, z: 0 },
    { x: b.maxX + radius - p.x, z: 0 },
    { x: 0, z: b.minZ - radius - p.z },
    { x: 0, z: b.maxZ + radius - p.z },
  ];
  return exits.reduce((best, e) => (Math.hypot(e.x, e.z) < Math.hypot(best.x, best.z) ? e : best));
}

/** True if a circle at `p` overlaps any box. */
export function collides(p: Point, radius: number, boxes: readonly Box[]): boolean {
  return boxes.some((b) => penetration(p, radius, b) !== null);
}

/**
 * Pushes a circle out of every box it overlaps. Applied to the desired position each frame,
 * this makes the player slide along walls instead of stopping dead.
 */
export function resolveCircle(p: Point, radius: number, boxes: readonly Box[]): Point {
  const out = { x: p.x, z: p.z };
  // Two passes settle corners where pushing out of one box enters another.
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      const push = penetration(out, radius, b);
      if (push) {
        out.x += push.x;
        out.z += push.z;
      }
    }
  }
  return out;
}
