/**
 * The local player's predicted pose, written by LocalPlayer every frame. Shared as a plain mutable
 * object (not React state) so per-frame readers like the compass don't cause re-renders.
 */
export const localPose = { x: 0, z: 0, yaw: 0 };
