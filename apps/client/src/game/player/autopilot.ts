import type { Point } from '@homebound/shared';

/**
 * Dev-only bot steering for automated playtests (`scripts/e2e`). It drives the real local
 * controller (same speed, collision, sending and server validation), it does not teleport.
 */
export const autopilot = {
  path: [] as Point[],
  /** Face this point once the path is done. */
  lookAt: null as Point | null,
};

export function walkTo(path: Point[], lookAt: Point | null = null): void {
  autopilot.path = [...path];
  autopilot.lookAt = lookAt;
}

/** yaw that faces from `from` toward `to` (yaw 0 looks toward −Z). */
export function yawToward(from: Point, to: Point): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}
