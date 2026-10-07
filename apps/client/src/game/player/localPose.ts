/**
 * The local player's predicted pose, written by LocalPlayer every frame. Shared as a plain mutable
 * object (not React state) so per-frame readers like the compass and the held weapon don't cause
 * re-renders. `attackAt` is the performance.now() of the last swing/shot (viewmodel animation).
 */
export const localPose = { x: 0, z: 0, yaw: 0, pitch: 0, attackAt: -1e9 };
