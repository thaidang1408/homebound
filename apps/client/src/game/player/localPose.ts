import type { PlayerAction } from '@homebound/shared';

/**
 * The local player's predicted pose, written by LocalPlayer every frame. Shared as a plain mutable
 * object (not React state) so per-frame readers like the compass and the arms don't cause
 * re-renders. `action`/`actionAt` (performance.now()) drive the first-person arm animation.
 */
export const localPose = {
  x: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  /** Height above the ground while jumping (m). */
  jumpY: 0,
  /** 0 = standing still … 1 = walking; and the step phase (radians) for the arms' bob. */
  walking: 0,
  bobPhase: 0,
  action: '' as PlayerAction | '',
  actionAt: -1e9,
};

/** Start a first-person arm animation right away (the server confirms it to the partner). */
export function localAction(action: PlayerAction): void {
  localPose.action = action;
  localPose.actionAt = performance.now();
}
