import { PING_MAX_DISTANCE, PLAYER_EYE_HEIGHT, terrainHeight } from '@homebound/shared';
import { localPose } from './localPose';

const STEP = 0.5; // m

/** Where the crosshair meets the ground, or null when looking at the sky / too far. */
export function pingTarget(): { x: number; z: number } | null {
  const { x, z, yaw, pitch, jumpY } = localPose;
  const eyeY = terrainHeight(x, z) + PLAYER_EYE_HEIGHT + jumpY;
  const flat = Math.cos(pitch);
  const dx = -Math.sin(yaw) * flat;
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * flat;
  for (let d = STEP; d <= PING_MAX_DISTANCE - 1; d += STEP) {
    const px = x + dx * d;
    const pz = z + dz * d;
    if (eyeY + dy * d <= terrainHeight(px, pz)) return { x: px, z: pz };
  }
  return null;
}
