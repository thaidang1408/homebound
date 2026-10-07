import { MathUtils } from 'three';

const TWO_PI = Math.PI * 2;

/** Shortest signed angle from `from` to `to`, so yaw never unwinds the long way round. */
export function angleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, TWO_PI) - Math.PI;
}
